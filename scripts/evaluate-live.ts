import {providerFailure} from '../src/lib/provider-failure';
import {chatInstructions} from '../src/lib/chat-instructions';
import {readFileSync,writeFileSync} from 'node:fs';
import {runGemini} from '../src/lib/providers';
import {geminiKeyState} from '../src/lib/config';
import {corpus,retrieveContext,skillInstructions} from '../src/lib/corpus';
import {groundedAnswer,groundingInstructions,parseVerdict,citationIssues} from '../src/lib/grounding';
import {withinDeadline} from '../src/lib/deadline';
import {completedHistory} from '../src/lib/conversation';
import type {Message} from '../src/lib/types';
import {loadEnvConfig} from '@next/env';
import {evaluationPacer} from './evaluation-pacing';
type EvalCase={id:string;prompt:string;sequence?:boolean;sourceKind?:'skill'|'book'|'both';deep?:boolean};
async function main(){
loadEnvConfig(process.cwd());
const pace=evaluationPacer();
const allCases:EvalCase[]=[...JSON.parse(readFileSync('private-data/skill/evals/cases.json','utf8')).cases,
 {id:'two_distinct_questions',prompt:'Como priorizar meu backlog? Como definir OKRs trimestrais?'},
 {id:'two_distinct_questions_deep',prompt:'Como priorizar meu backlog? Como definir OKRs trimestrais?',deep:true},
 {id:'conversation_seed',prompt:'Como priorizar meu backlog usando RICE sem dados de alcance ou esforço?',sequence:true},
 {id:'subject_change',prompt:'Como definir OKRs trimestrais?',sequence:true},
 {id:'short_followup',prompt:'Como aplico isso no meu time?',sequence:true},
 {id:'concept_only',prompt:'Quais dados preciso levantar antes de usar RICE?',sourceKind:'skill'},
 {id:'book_only',prompt:'Como investigar problemas e entrevistar usuários em discovery?',sourceKind:'book'},
 {id:'combined_sources',prompt:'Combine conceitos e trechos dos livros disponíveis para explicar como investigar problemas em discovery. Cite pelo menos um conceito e um livro, se ambos sustentarem a aplicação.',sourceKind:'both'},
 {id:'no_evidence',prompt:'xyzznotfound123'}];
const filter=process.env.EVAL_CASE_ID;
const dependencies=filter==='short_followup'?['conversation_seed','subject_change',filter]:filter==='subject_change'?['conversation_seed',filter]:[filter];
const cases=filter?allCases.filter(c=>dependencies.includes(c.id)):allCases;
const results=[];
let liveHistory:Message[]=[],sequenceReady=true,providerBlocked=false;
if(!cases.length){console.log('LIVE_EVAL: UNKNOWN_CASE');process.exitCode=1;return;}
if(!process.env.GEMINI_API_KEY){console.log('LIVE_EVAL: SKIPPED — GEMINI_NOT_CONFIGURED (nenhum teste real foi executado)');process.exitCode=1;return;}
if(geminiKeyState(process.env.GEMINI_API_KEY)!=='ready'){console.log('LIVE_EVAL: GEMINI_INVALID_KEY_FORMAT');process.exitCode=1;return;}
for(const c of cases){
 if(c.sequence&&!sequenceReady){results.push({caseId:c.id,completed:false,passed:false,reason:'previous_live_turn_failed'});continue;}
 const history=c.sequence?completedHistory(liveHistory):[];
 let context=retrieveContext(c.prompt,history);
 if(c.sourceKind&&c.sourceKind!=='both'){
  const sources=context.sources.filter(s=>s.kind===c.sourceKind);
  context={sources,text:sources.map(s=>{const chunk=corpus().chunks.find(chunk=>chunk.kind===s.kind&&chunk.title===s.title&&chunk.page===s.page&&chunk.reference===s.reference&&chunk.text.slice(0,340)===s.excerpt);if(!chunk)throw Error('EVAL_SOURCE_NOT_FOUND');return `[${s.id}] ${s.title}${s.page?' — página PDF '+s.page:''}\n${chunk.text}`;}).join('\n\n---\n\n')};
 }
 let response='';const started=Date.now();let publicationMs:number|undefined;let providerCalls=0;
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),90000);
 try{
  const result=await withinDeadline(()=>groundedAnswer({instructions:chatInstructions(skillInstructions(),context.text,!!c.deep),messages:[...history,{role:'user',content:c.prompt}],sourceText:context.text,sources:context.sources,maxOutput:c.deep?8192:4096,onPhase:()=>{},generate:async(instructions,messages,maxOutput)=>{
   await pace(controller.signal);providerCalls++;let text='';await runGemini({instructions,messages,maxOutput,deep:!!c.deep,signal:controller.signal,onText:t=>{text+=t;}});return text;
  }}),90000,controller.signal,()=>controller.abort());
  response=result.text;publicationMs=Date.now()-started;
  const t=response.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const checks:Record<string,boolean>={nonEmpty:response.length>40,grounded:result.validated};
  if(c.id.startsWith('two_distinct_questions'))checks.bothSubjects=/prioriz|backlog|rice/.test(t)&&/okr|objetivo/.test(t)&&result.sources.some(s=>s.reference==='okr-frameworks.md')&&result.sources.some(s=>s.reference==='prioritization-craft.md');
  if(c.id==='subject_change')checks.newSubject=/okr|objetivo/.test(t)&&!context.sources.some(s=>s.reference==='prioritization-craft.md');
  if(c.id==='short_followup')checks.retainsSubject=/okr|objetivo|resultado.chave/.test(t)&&context.sources.some(s=>s.reference==='okr-frameworks.md');
  if(c.sourceKind==='skill'||c.sourceKind==='book')checks.sourceKind=result.sources.length>0&&result.sources.every(s=>s.kind===c.sourceKind);
  if(c.sourceKind==='both')checks.combinesSources=result.sources.some(s=>s.kind==='skill')&&result.sources.some(s=>s.kind==='book');
  if(c.id==='no_evidence')checks.abstains=result.sources.length===0&&/evidencia suficiente/.test(t);
  if(c.id==='rice_missing_inputs'){checks.missingInputs=/alcance|reach/.test(t)&&/impact/.test(t)&&/esforco|effort/.test(t)&&/evidencia|pesquisa|dados/.test(t);checks.noNumericRanking=!/\|[^\n]*\d+[.,]\d+[^\n]*\|/.test(t);}
  if(c.id==='positioning_missing_competitor')checks.asksContext=/publico|segmento|cliente/.test(t)&&/alternativa|concorr|hoje/.test(t);
  if(c.id==='prd_sparse_context')checks.contextBeforePRD=/problema/.test(t)&&/publico|usuario/.test(t)&&/hipotese|evidencia|metrica/.test(t);
  if(c.id==='ai_feature_launch')checks.qualityAndEconomics=/eval|avaliac|qualidade/.test(t)&&/custo/.test(t)&&/latencia/.test(t);
  if(c.id==='simple_reversible_decision')checks.proportionateDecision=/corrig|direto|ajust/.test(t)&&/revers|revert|baixo/.test(t);
  if(c.id==='decision_tradeoff')checks.costAndCriteria=/custo|risco|perd|adiar/.test(t)&&/se|criterio/.test(t);
  const passed=Object.values(checks).every(Boolean);
  if(c.sequence){sequenceReady=passed;if(passed)liveHistory=[...history,{role:'user',content:c.prompt},{role:'assistant',content:response}];}
  const report={caseId:c.id,provider:process.env.GEMINI_MODEL||'gemini-3.5-flash-lite',completed:true,durationMs:Date.now()-started,publicationMs,providerCalls,revisions:result.revisions,audit:result.audit,historyMessages:history.length,sourceKinds:[...new Set(result.sources.map(s=>s.kind))],checks,passed};results.push(report);console.log('LIVE_EVAL '+JSON.stringify(report));
 }catch(error){if(c.sequence)sequenceReady=false;const e=error as {name?:string;status?:number;code?:string};const failure=providerFailure(error);const result={caseId:c.id,provider:process.env.GEMINI_MODEL||'gemini-3.5-flash-lite',completed:false,passed:false,errorType:e.name??'ProviderError',...failure,publicationMs};results.push(result);console.log('LIVE_EVAL '+JSON.stringify(result));if(['rate_limit','authentication'].includes(failure.kind)){providerBlocked=true;break;}}
 finally{clearTimeout(timer);}
}
const verifierResults=[];
if(!filter&&!providerBlocked){
 const context=retrieveContext('RICE priorização');const reference=context.sources.find(s=>s.reference==='prioritization-craft.md');
 if(!reference)throw Error('EVAL_SOURCE_NOT_FOUND');
 for(const c of [
  {id:'supported_claim',answer:`RICE combina alcance, impacto e confiança divididos pelo esforço [${reference.id}].`,expected:true},
  {id:'unsupported_claim_valid_id',answer:`RICE garante dobrar a receita em 30 dias [${reference.id}].`,expected:false},
  {id:'invented_citation',answer:'RICE garante dobrar a receita em 30 dias [S999].',expected:false}
 ]){
  const started=Date.now();let text='';const controller=new AbortController();
  try{
   await withinDeadline(async()=>{await pace(controller.signal);return runGemini({instructions:groundingInstructions,messages:[{role:'user',content:JSON.stringify({conversation:[{role:'user',content:'Explique RICE.'}],answer:c.answer,sources:context.text})}],maxOutput:2048,deep:false,signal:controller.signal,onText:t=>text+=t});},30000,controller.signal,()=>controller.abort());
   const verdict=parseVerdict(text),idsValid=!citationIssues(c.answer,context.sources).length;
   const accepted=!!verdict?.supported&&!verdict.issues.length&&!verdict.issueTypes.length&&idsValid;
   const result={caseId:c.id,passed:!!verdict&&accepted===c.expected,durationMs:Date.now()-started};verifierResults.push(result);console.log('LIVE_VERIFIER_EVAL '+JSON.stringify(result));
  }catch(error){const result={caseId:c.id,passed:false,...providerFailure(error)};verifierResults.push(result);console.log('LIVE_VERIFIER_EVAL '+JSON.stringify(result));}
 }
}
writeFileSync('private-data/live-eval-report.json',JSON.stringify({runAt:new Date().toISOString(),results,verifierResults,note:'Automated behavioral and semantic checks; no prompts, responses or credentials stored. Conversational cases use actual prior live responses. Not a complete human semantic review.'},null,2));
console.log('LIVE_EVAL_SUMMARY '+JSON.stringify({completed:results.filter(r=>r.completed).length,passed:results.filter(r=>r.passed).length,total:cases.length}));
if(results.length!==cases.length||results.some(r=>!r.passed)||verifierResults.some(r=>!r.passed))process.exitCode=1;

}
main().catch(error=>{console.error("LIVE_EVAL_RUNNER_FAILED", error instanceof Error?error.name:"Unknown");process.exitCode=1;});
