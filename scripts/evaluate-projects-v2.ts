/** Optional real-model evaluation. Synthetic conversations and curated public
 * summaries only; reports never contain prompts or generated answers. */
import {loadEnvConfig} from '@next/env';
import {mkdirSync,writeFileSync} from 'node:fs';
import {modelGenerator} from '../src/lib/model-call';
import {memoryInstructions,verifiedMemorySelection} from '../src/lib/project-memory';
import {editorialChunks} from '../src/lib/editorial';
import {publicSource} from '../src/lib/retrieval';
import {groundedAnswer} from '../src/lib/grounding';
import {pathInstructions,parsePathPlan} from '../src/lib/problem-path';
import {withinDeadline} from '../src/lib/deadline';
loadEnvConfig(process.cwd());
async function main(){
 const directory='artifacts/projects-1.4';mkdirSync(directory,{recursive:true});
 if(!process.env.GEMINI_API_KEY&&!process.env.OPENAI_API_KEY){writeFileSync(directory+'/model-evaluation.json',JSON.stringify({status:'not_run',reason:'No model credential configured',memory:'not_evaluated',paths:'not_evaluated'},null,2));console.log('Avaliação real não executada: nenhuma credencial de modelo configurada.');process.exitCode=1;return;}
 const cases:{id:string;passed:boolean;durationMs:number;stages?:number;sources?:number}[]=[];
 const controller=new AbortController(),generate=modelGenerator({confidential:false,deep:true,signal:controller.signal});
 const turns=[{id:'u1',role:'user' as const,content:'Nosso público são lojistas. Temos uma equipe e não há orçamento adicional.'},{id:'a1',role:'assistant' as const,content:'Proponho investigar o abandono no cadastro. Esta proposta ainda não foi validada.'}];
 let start=Date.now();const selected=await withinDeadline(()=>generate(memoryInstructions,[{role:'user',content:JSON.stringify(turns)}],4096),90000,controller.signal,()=>controller.abort());const memory=verifiedMemorySelection(selected,turns);cases.push({id:'memory_exact_quotes_and_proposal_separation',passed:/equipe|orçamento/.test(memory)&&/Proposta da IA — não confirmada/.test(memory),durationMs:Date.now()-start});
 const chunks=editorialChunks(),sources=chunks.map((c,i)=>({...publicSource(c),id:'S'+(i+1)})),sourceText=chunks.map((c,i)=>`[S${i+1}] ${c.title}\n${c.text}`).join('\n\n');
 for(const [id,problem] of [['prioritization','Temos uma equipe e três iniciativas, mas faltam estimativas de esforço. Como escolher?'],['discovery','Lojistas abandonam o cadastro. Não sabemos por quê. Como investigar?'],['measurement','Entregamos funcionalidades mas não sabemos se melhoram a retenção. Como medir?']]){
  start=Date.now();const result=await withinDeadline(()=>groundedAnswer({instructions:'Use exclusivamente as fontes fornecidas. Não invente dados.\n'+sourceText+'\n'+pathInstructions(sources),messages:[{role:'user',content:problem}],sources,sourceText,generate,maxOutput:8192,onPhase:()=>{}}),90000,controller.signal,()=>controller.abort());
  const plan=result.validated?parsePathPlan(result.text,result.sources):undefined;cases.push({id,passed:!!plan&&plan.stages.every(s=>s.questions.length<=3),durationMs:Date.now()-start,stages:plan?.stages.length,sources:result.sources.length});
 }
 const passed=cases.every(c=>c.passed);writeFileSync(directory+'/model-evaluation.json',JSON.stringify({status:passed?'passed':'failed',cases,manualReviewRequired:true},null,2));console.log(JSON.stringify({passed,cases}));if(!passed)process.exitCode=1;
}
main().catch(()=>{mkdirSync('artifacts/projects-1.4',{recursive:true});writeFileSync('artifacts/projects-1.4/model-evaluation.json',JSON.stringify({status:'failed',reason:'Model call or quality validation failed',manualReviewRequired:true},null,2));console.error('Falha na avaliação real; conteúdo e credenciais não foram registrados.');process.exitCode=1;});
