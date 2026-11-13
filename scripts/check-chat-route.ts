import {NextRequest} from 'next/server';
import {loadEnvConfig} from '@next/env';
import {setTimeout} from 'node:timers/promises';
import {POST} from '../src/app/api/chat/route';
import {completedHistory} from '../src/lib/conversation';
import {citationIds,citationIssues,groundingInstructions,parseVerdict} from '../src/lib/grounding';
import {retrieveContext} from '../src/lib/corpus';
import {runGemini} from '../src/lib/providers';
import {withinDeadline} from '../src/lib/deadline';
import {evaluationPacer} from './evaluation-pacing';
import type {ChatEvent,Message,Source} from '../src/lib/types';

async function main(){
 loadEnvConfig(process.cwd());
 if(!process.env.GEMINI_API_KEY){console.log('CHAT_ROUTE_CHECK SKIPPED: GEMINI_NOT_CONFIGURED');process.exitCode=1;return;}
 let history:Message[]=[],nextStart=Date.now()+15000;
 const results=[];
 const scenarios=[
  {id:'two_distinct_quick',mode:'quick',message:'Como priorizar meu backlog? Como definir OKRs trimestrais?'},
  {id:'subject_change_combined',mode:'quick',message:'Combine conceitos e trechos dos livros disponíveis para explicar como investigar problemas em discovery. Cite pelo menos um conceito e um livro, se ambos sustentarem a aplicação.'},
  {id:'two_distinct_deep',mode:'deep',message:'Como priorizar meu backlog? Como definir OKRs trimestrais?'},
  {id:'short_followup',mode:'quick',message:'Como aplico esses OKRs no meu time?'}
 ];
 for(const scenario of scenarios){
  // A response may use four provider calls. Space requests below the 15 RPM limit.
  if(nextStart>Date.now())await setTimeout(nextStart-Date.now());nextStart=Date.now()+20000;
  const started=Date.now();let publicationMs:number|undefined;
  const sentHistory=completedHistory(history);
  const req=new NextRequest('https://evaluation.local/api/chat',{method:'POST',headers:{'content-type':'application/json',origin:'https://evaluation.local'},body:JSON.stringify({message:scenario.message,mode:scenario.mode,history:sentHistory,confidential:false})});
  const res=await POST(req);if(!res.body)throw Error('NO_STREAM');
  const reader=res.body.getReader(),decoder=new TextDecoder();let pending='',text='',done=false,failed=false,provider='',validating=false,publishedBeforeValidation=false;let sources:Source[]=[];
  const handle=(event:ChatEvent)=>{
   if(event.type==='phase')validating=event.phase==='validating';
   if(event.type==='delta'){publicationMs??=Date.now()-started;text+=event.text;if(!validating)publishedBeforeValidation=true;}
   if(event.type==='reset')text='';
   if(event.type==='provider')provider=event.provider;
   if(event.type==='done')done=true;
   if(event.type==='sources')sources=event.sources;
   if(event.type==='error')failed=true;
  };
  while(true){const item=await reader.read();if(item.done)break;pending+=decoder.decode(item.value,{stream:true});let index;while((index=pending.indexOf('\n'))>=0){const line=pending.slice(0,index);pending=pending.slice(index+1);if(line)handle(JSON.parse(line));}}
  pending+=decoder.decode();if(pending.trim())handle(JSON.parse(pending));
  const ids=citationIds(text),sourcesMatch=ids.length>0&&ids.every(id=>sources.some(s=>s.id===id))&&sources.every(s=>ids.includes(s.id));
  const normalized=text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const checks:Record<string,boolean>={completed:res.status===200&&done&&!failed,nonEmpty:text.length>40,sourcesMatch,hiddenUntilValidated:!publishedBeforeValidation};
  if(scenario.id.startsWith('two_distinct'))checks.bothSubjects=/prioriz|backlog|rice/.test(normalized)&&/okr|objetivo/.test(normalized);
  if(scenario.id==='subject_change_combined'){checks.combinesSources=sources.some(s=>s.kind==='skill')&&sources.some(s=>s.kind==='book');checks.newSubject=/discovery|descoberta|premissa/.test(normalized)&&!sources.some(s=>s.reference==='prioritization-craft.md');}
  if(scenario.id==='short_followup')checks.retainsSubject=/okr|objetivo|resultado.chave/.test(normalized);
  const passed=Object.values(checks).every(Boolean);
  const report={caseId:scenario.id,mode:scenario.mode,provider,publicationMs,durationMs:Date.now()-started,historyMessages:sentHistory.length,sourceKinds:[...new Set(sources.map(s=>s.kind))],checks,passed};
  results.push(report);console.log('CHAT_ROUTE_CHECK '+JSON.stringify(report));
  if(!passed){process.exitCode=1;break;}
  history=[...sentHistory,{role:'user',content:scenario.message},{role:'assistant',content:text}];
 }
 console.log('CHAT_ROUTE_SUMMARY '+JSON.stringify({passed:results.filter(r=>r.passed).length,completed:results.length,total:scenarios.length}));
 if(results.length!==scenarios.length||results.some(r=>!r.passed))return;
 // Two targeted verifier calls supplement the end-to-end path. Invalid IDs are
 // already covered deterministically, so no extra paid call duplicates that test.
 const context=retrieveContext('RICE priorização'),ref=context.sources.find(s=>s.reference==='prioritization-craft.md');
 if(!ref)throw Error('EVAL_SOURCE_NOT_FOUND');
 const pace=evaluationPacer();
 for(const item of [
  {id:'supported_claim',answer:`RICE combina alcance, impacto e confiança divididos pelo esforço [${ref.id}].`,expected:true},
  {id:'unsupported_claim_valid_id',answer:`RICE garante dobrar a receita em 30 dias [${ref.id}].`,expected:false}
 ]){
  const controller=new AbortController();let output='';const started=Date.now();
  await withinDeadline(async()=>{await pace(controller.signal);return runGemini({instructions:groundingInstructions,messages:[{role:'user',content:JSON.stringify({conversation:[{role:'user',content:'Explique RICE.'}],answer:item.answer,sources:context.text})}],maxOutput:2048,deep:false,signal:controller.signal,onText:t=>output+=t});},30000,controller.signal,()=>controller.abort());
  const verdict=parseVerdict(output),accepted=!!verdict?.supported&&!verdict.issues.length&&!verdict.issueTypes.length&&!citationIssues(item.answer,context.sources).length;
  const passed=!!verdict&&accepted===item.expected;
  console.log('LIVE_VERIFIER_EVAL '+JSON.stringify({caseId:item.id,passed,durationMs:Date.now()-started}));
  if(!passed){process.exitCode=1;break;}
 }
}
main().catch(()=>{console.log('CHAT_ROUTE_CHECK failed');process.exitCode=1;});
