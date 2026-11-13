import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {completedHistory,retrievalQueries} from '../src/lib/conversation';
import {selectContext} from '../src/lib/context-selection';
import {groundedAnswer,parseVerdict,INSUFFICIENT_EVIDENCE,VALIDATION_LIMIT} from '../src/lib/grounding';
import {consumeGeminiStream,type GeminiEvent} from '../src/lib/provider-stream';
import {providerFailure} from '../src/lib/provider-failure';
import type {Source,Message} from '../src/lib/types';

const corpus=JSON.parse(readFileSync('private-data/corpus.json','utf8'));
const sources:Source[]=[{id:'S1',title:'Priorização',kind:'skill',excerpt:'Use dados de alcance, impacto, confiança e esforço.'},{id:'S2',title:'Livro',kind:'book',page:12,excerpt:'Teste suas premissas.'}];
const messages:Message[]=[{role:'user',content:'Como priorizar meu backlog?'}];
const base={instructions:'Use a base.',messages,sourceText:'[S1] Use dados de alcance, impacto, confiança e esforço. [S2] Teste suas premissas.',sources,maxOutput:4096,onPhase:()=>{}};

test('history drops entire failed/interrupted turns and strips old citation IDs',()=>{
 assert.deepEqual(completedHistory([{role:'user',content:'Primeira'},{role:'assistant',content:'Resposta [S1]',completed:true},{role:'user',content:'Falha'},{role:'assistant',content:'Erro',error:true},{role:'user',content:'Interrompida'},{role:'assistant',content:'Parcial',completed:false},{role:'user',content:'Sem resposta'}]),[{role:'user',content:'Primeira'},{role:'assistant',content:'Resposta [referência de outro turno]'}]);
 assert.deepEqual(completedHistory([{role:'user',content:'Falhou'},{role:'user',content:'Nova'},{role:'assistant',content:'Concluída'}]),[{role:'user',content:'Nova'},{role:'assistant',content:'Concluída'}]);
});
test('new subjects do not inherit old retrieval context; follow-ups do',()=>{
 assert.deepEqual(retrievalQueries('Como definir OKRs?',messages),['Como definir OKRs']);
 assert.match(retrievalQueries('Como aplico isso no meu time?',messages)[0],/backlog/);
 const okr=selectContext('Como definir OKRs?',messages,corpus);
 assert.ok(okr.sources.some(s=>s.reference==='okr-frameworks.md'));
 assert.ok(!okr.sources.some(s=>s.reference==='prioritization-craft.md'));
 const followup=selectContext('Como aplico isso?',messages,corpus);
 assert.ok(followup.sources.some(s=>s.reference==='prioritization-craft.md'));
});
test('two distinct questions recover both concepts plus page-addressable books',()=>{
 const result=selectContext('Como priorizar o backlog? Como definir OKRs?',[],corpus);
 for(const ref of ['prioritization-craft.md','okr-frameworks.md'])assert.ok(result.sources.some(s=>s.reference===ref));
 assert.ok(result.sources.some(s=>s.kind==='book'&&s.page));
 assert.equal(new Set(result.sources.map(s=>s.id)).size,result.sources.length);
 assert.match(result.text,/Conceito disponível:/);
});
test('asking for book and concept citations does not replace the retrieval subject with bibliography terms',()=>{
 const direct=selectContext('investigar problemas discovery',[],corpus);
 const formatted=selectContext('Combine conceitos e trechos dos livros disponíveis para explicar como investigar problemas em discovery. Cite pelo menos um conceito e um livro, se ambos sustentarem a aplicação.',[],corpus);
 assert.deepEqual(formatted.sources.map(s=>[s.kind,s.title,s.page]),direct.sources.map(s=>[s.kind,s.title,s.page]));
 assert.ok(formatted.sources.some(s=>s.kind==='book'));
});
test('unknown subject returns an explicit gap without calling a model',async()=>{
 const context=selectContext('xyzznotfound123',[],corpus);
 const result=await groundedAnswer({...base,...context,sourceText:context.text,generate:async()=>assert.fail('must not generate without sources')});
 assert.equal(result.text,INSUFFICIENT_EVIDENCE);assert.equal(result.sources.length,0);
});
test('validated answer only publishes used sources after semantic check',async()=>{
 let calls=0;const phases:string[]=[];
 const result=await groundedAnswer({...base,onPhase:p=>phases.push(p),generate:async()=>++calls===1?'Considere alcance e esforço [S1].':'{"supported":true,"issues":[]}'});
 assert.equal(result.validated,true);assert.deepEqual(result.sources.map(s=>s.id),['S1']);assert.deepEqual(phases,['generating','validating']);assert.equal(calls,2);
});
test('concept-only, book-only and combined answers retain their actual evidence kinds',async()=>{
 for(const selected of [[sources[0]],[sources[1]],sources]){
  let calls=0;const answer=selected.map(s=>`Aplicação baseada no trecho [${s.id}].`).join(' ');
  const result=await groundedAnswer({...base,sources:selected,generate:async()=>++calls===1?answer:'{"supported":true,"issues":[]}'});
  assert.deepEqual(result.sources.map(s=>s.kind),selected.map(s=>s.kind));assert.equal(result.validated,true);
 }
});
test('unsupported claim with existing citation is revised once with candidate and issues',async()=>{
 let calls=0;
 const result=await groundedAnswer({...base,generate:async(_instructions,input)=>{
  calls++;
  if(calls===1)return 'RICE garante sucesso [S1].';
  if(calls===2)return '{"supported":false,"issues":["A fonte não garante sucesso."]}';
  if(calls===3){assert.ok(input.some(m=>m.role==='assistant'&&m.content.includes('garante')));assert.match(input.at(-1)!.content,/não garante/);return 'Use alcance e esforço como dados [S1].';}
  return '{"supported":true,"issues":[]}';
 }});
 assert.equal(calls,4);assert.equal(result.revisions,1);assert.equal(result.validated,true);
 assert.equal(result.audit.length,2);assert.ok(!JSON.stringify(result.audit).includes('garante'));
});
test('invented IDs are never published even when verifier incorrectly approves',async()=>{
 let calls=0;const result=await groundedAnswer({...base,generate:async()=>++calls%2?'Use RICE [S99].':'{"supported":true,"issues":[]}'});
 assert.equal(result.text,VALIDATION_LIMIT);assert.equal(result.validated,false);assert.deepEqual(result.sources,[]);assert.equal(calls,4);
});
test('persistent unsupported content or malformed verdict fails closed',async()=>{
 for(const verdict of ['{"supported":false,"issues":["Não sustentado."]}','not json','{"supported":true}','{"supported":"true","issues":[]}','{"supported":true,"issues":[],"issueTypes":["unsupported_claim"]}']){
  let calls=0;const result=await groundedAnswer({...base,generate:async()=>++calls%2?'Afirmação [S1].':verdict});
  assert.equal(result.text,VALIDATION_LIMIT);assert.ok(calls<=4);
 }
 assert.equal(parseVerdict('```json\n{"supported":true,"issues":[]}\n```')?.supported,true);
});
test('source-limited clarification is allowed without invented citations',async()=>{
 let calls=0;const result=await groundedAnswer({...base,generate:async()=>++calls===1?'Não há evidência suficiente. Qual é seu público?':'{"supported":true,"issues":[],"abstains":true}'});
 assert.equal(result.validated,true);assert.deepEqual(result.sources,[]);
});
test('empty or uncited recommendations cannot pass a positive generic verdict',async()=>{
 for(const draft of ['', 'Use RICE para decidir.']){
  let calls=0;const result=await groundedAnswer({...base,generate:async()=>++calls%2?draft:'{"supported":true,"issues":[]}'});
  assert.equal(result.validated,false);assert.equal(result.text,VALIDATION_LIMIT);
 }
});
test('validator failure never returns the generated candidate',async()=>{
 let calls=0;await assert.rejects(()=>groundedAnswer({...base,generate:async()=>{if(++calls===1)return 'Não publique este rascunho [S1].';throw new Error('REQUEST_TIMEOUT');}}),/REQUEST_TIMEOUT/);
});

async function* events(items:GeminiEvent[]){yield* items;}
const delta:GeminiEvent={event_type:'step.delta',index:0,delta:{type:'text',text:'Resposta'}};
const complete:GeminiEvent={event_type:'interaction.completed',interaction:{id:'test',status:'completed'}};
test('SDK stream requires both text and a completed lifecycle event',async()=>{
 let output='';await consumeGeminiStream(events([delta,complete]),new AbortController().signal,t=>output+=t);assert.equal(output,'Resposta');
 for(const items of [[delta],[complete],[]])await assert.rejects(()=>consumeGeminiStream(events(items),new AbortController().signal,()=>{}),/STREAM_INCOMPLETE/);
});
test('SDK status updates never turn token limit or cancellation into successful output',async()=>{
 for(const status of ['incomplete','requires_continuation','budget_exceeded','failed','cancelled','requires_action']){
  await assert.rejects(()=>consumeGeminiStream(events([delta,{event_type:'interaction.status_update',interaction_id:'test',status}]),new AbortController().signal,()=>{}),/OUTPUT_LIMIT|GEMINI_FAILED|GEMINI_REQUIRES_ACTION/);
 }
 assert.equal(providerFailure({code:'OUTPUT_LIMIT'}).kind,'output_limit');
});
test('SDK errors and aborts propagate without accepting partial response',async()=>{
 await assert.rejects(()=>consumeGeminiStream(events([delta,{event_type:'error',error:{code:'service_unavailable'}}]),new AbortController().signal,()=>{}),/service_unavailable/);
 const controller=new AbortController();controller.abort();await assert.rejects(()=>consumeGeminiStream(events([delta,complete]),controller.signal,()=>assert.fail('aborted')));
});

test('theme tokens meet AA text contrast and 3:1 control boundary contrast',()=>{
 const css=readFileSync('src/app/globals.css','utf8');
 const luminance=(hex:string)=>hex.match(/\w\w/g)!.map(v=>{const s=parseInt(v,16)/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
 const ratio=(a:string,b:string)=>{const x=luminance(a.slice(1)),y=luminance(b.slice(1));return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
 for(const selector of [':root',':root[data-theme="dark"]']){
  const start=css.indexOf(selector+'{'),body=css.slice(start,css.indexOf('}',start));
  const tokens=Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[\da-f]{6})\b/g)].map(m=>[m[1],m[2]]));
  for(const fg of ['ink','muted','action'])for(const bg of ['paper','bg','soft'])assert.ok(ratio(tokens[fg],tokens[bg])>=4.5,`${selector}: ${fg}/${bg}`);
  assert.ok(ratio(tokens['on-accent'],tokens.action)>=4.5);
  assert.ok(ratio(tokens.warning,tokens['warning-bg'])>=4.5);
  for(const bg of ['paper','bg','soft'])assert.ok(ratio(tokens.stroke,tokens[bg])>=3,`${selector}: stroke/${bg}`);
 }
});
