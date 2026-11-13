import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newProject,newSession,parseBackup,projectBackup,portableWorkspace,mergeBackup,decisionDraft} from '../src/lib/workspace-model';
import {projectTurns,memoryBatch,verifiedMemorySelection,projectConfidential,sharedProjectContext} from '../src/lib/project-memory';
import {newProblemPath,parsePathPlan,type PathPlan} from '../src/lib/problem-path';
import {books,pdfRange,bookPdfUrl} from '../src/lib/book-files';
import {groundedAnswer} from '../src/lib/grounding';
import type {Source} from '../src/lib/types';

test('v1 migration retains conversations, documents, explicit objectives and old questionnaire records',()=>{
 const p=newProject('prioritize');p.answers={objective:'Reduzir abandono',evidence:'Suporte relatou dúvidas',capacity:'Uma equipe'};p.sessions[0].context='Não há orçamento novo';p.decisions=[decisionDraft(p)];
 const raw={version:1,projects:[p]};const migrated=parseBackup(JSON.stringify(raw));assert.equal(migrated.version,2);const next=migrated.projects[0];assert.equal(next.objective,'Reduzir abandono');assert.deepEqual(next.sessions,p.sessions);assert.deepEqual(next.decisions,p.decisions);assert.equal(next.trails.length,1);assert.match(next.trails[0].legacy!,/Uma equipe/);assert.match(next.memory.text,/Não há orçamento novo/);assert.equal(next.memory.coveredIds.length,0);
 assert.equal(parseBackup(JSON.stringify({version:1,projects:[newProject()]})).projects[0].objective,'');
});
test('individual project export restores objective, shared memory, conversations, sources and paths',()=>{
 const p=newProject();p.name='Projeto A';p.objective='Aumentar ativação';p.memory={text:'Restrição relatada: orçamento limitado',coveredIds:['s:u']};p.sessions.push(newSession());p.trails=[newProblemPath('Investigar abandono')];
 const restored=parseBackup(projectBackup(p));assert.equal(restored.projects.length,1);assert.deepEqual(restored.projects[0],portableWorkspace({version:2,projects:[p],trails:[]}).projects[0]);
 const duplicate=mergeBackup(restored,restored);assert.notEqual(duplicate.projects[0].id,duplicate.projects[1].id);assert.notEqual(duplicate.projects[0].trails[0].id,duplicate.projects[1].trails[0].id);assert.equal(restored.projects[0].name,'Projeto A');
});
test('project context never includes conversations or paths from another project',()=>{
 const a=newProject(),b=newProject();a.objective='Objetivo A';b.objective='Segredo B';a.memory.text='Informação A';b.memory.text='Outra informação B';b.trails=[newProblemPath('Problema secreto B')];
 const context=sharedProjectContext(a);assert.match(context,/Objetivo A/);assert.match(context,/Informação A/);assert.ok(!context.includes('Segredo B'));assert.ok(!context.includes('secreto B'));
});
test('memory includes only completed turn pairs and skips already incorporated turns',()=>{
 const p=newProject();p.sessions[0].messages=[{id:'u',role:'user',content:'Há uma equipe.'},{id:'a',role:'assistant',content:'Proponho um teste.',completed:true},{id:'bad-u',role:'user',content:'Não incorporar'},{id:'bad-a',role:'assistant',content:'Falha',error:true}];
 const turns=projectTurns(p);assert.equal(turns.length,2);p.memory.coveredIds=[turns[0].id];assert.equal(memoryBatch(p).turns.length,1);assert.equal(memoryBatch(p).turns[0].role,'assistant');
});
test('memory fidelity gate rejects fabricated quotes, wrong turn IDs and proposals promoted to facts',()=>{
 const turns=[{id:'u',role:'user' as const,content:'Há uma equipe e o orçamento é limitado.'},{id:'a',role:'assistant' as const,content:'Proponho entrevistar clientes.'}];
 const good=verifiedMemorySelection(JSON.stringify({items:[{turnId:'u',quote:'Há uma equipe e o orçamento é limitado.',kind:'constraint'},{turnId:'a',quote:'Proponho entrevistar clientes.',kind:'proposal'}]}),turns);assert.match(good,/Restrição relatada/);assert.match(good,/Proposta da IA — não confirmada/);
 for(const item of [{turnId:'u',quote:'Há dez equipes.',kind:'information'},{turnId:'other',quote:'Há uma equipe',kind:'information'},{turnId:'a',quote:'Proponho entrevistar clientes.',kind:'evidence'},{turnId:'u',quote:'Há uma equipe',kind:'proposal'}])assert.throws(()=>verifiedMemorySelection(JSON.stringify({items:[item]}),turns));
});
test('memory quotes cannot drop negations or promote questions into facts',()=>{
 const turns=[{id:'u',role:'user' as const,content:'Não precisamos aumentar preços. Há orçamento disponível?'}];
 assert.throws(()=>verifiedMemorySelection(JSON.stringify({items:[{turnId:'u',quote:'precisamos aumentar preços.',kind:'information'}]}),turns),/cortou/);
 assert.throws(()=>verifiedMemorySelection(JSON.stringify({items:[{turnId:'u',quote:'Há orçamento disponível?',kind:'information'}]}),turns),/pergunta/);
 assert.match(verifiedMemorySelection(JSON.stringify({items:[{turnId:'u',quote:'Não precisamos aumentar preços.',kind:'information'},{turnId:'u',quote:'Há orçamento disponível?',kind:'question'}]}),turns),/Questão aberta/);
});
test('context carries proposals as proposals, only explicitly confirmed results as decisions, and fails rather than truncating',()=>{
 const p=newProject();p.objective='Resolver abandono';const d=decisionDraft(p);d.fields.Recomendação='Proposta ainda não confirmada';p.decisions=[d];assert.match(sharedProjectContext(p),/Proposta salva — não confirmada/);assert.ok(!sharedProjectContext(p).includes('Decisão confirmada pelo usuário'));d.status='decided';assert.match(sharedProjectContext(p),/Decisão confirmada pelo usuário/);p.memory.text='x'.repeat(18000);assert.throws(()=>sharedProjectContext(p),/limite/);
});
test('confidentiality propagates from historical messages and problem paths',()=>{
 const p=newProject();assert.equal(projectConfidential(p),false);p.sessions[0].messages=[{id:'secret',role:'user',content:'Dado privado',confidential:true}];assert.equal(projectConfidential(p),true);p.sessions[0].messages=[];const path=newProblemPath('Problema');path.confidential=true;p.trails=[path];assert.equal(projectConfidential(p),true);
});
const sources:Source[]=[{id:'S1',title:'Discovery',kind:'skill',reference:'continuous-discovery.md',excerpt:'Teste hipóteses com evidências.'}];
const validPlan:PathPlan={title:'Investigar abandono',stages:['entender','testar','propor'].map(id=>({id,title:id,why:'Reduzir incerteza [S1].',conceptIds:[],tips:['Use evidências [S1].'],questions:['O que foi observado?'],activity:'Investigue a hipótese [S1].',doneWhen:'Uma evidência permitir rever a decisão [S1].'})),proposal:'Plano de investigação [S1].',risks:'Hipótese sem evidência [S1].',nextStep:'Investigar com clientes [S1].',success:'Evidência que altere uma decisão [S1].'};
test('problem paths enforce stages, max three questions, known methods and actual sources',()=>{
 assert.equal(parsePathPlan(JSON.stringify(validPlan),sources).stages.length,3);
 for(const plan of [{...validPlan,stages:[validPlan.stages[0],validPlan.stages[0],validPlan.stages[2]]},{...validPlan,stages:validPlan.stages.map(s=>({...s,questions:['a','b','c','d']}))},{...validPlan,stages:validPlan.stages.map(s=>({...s,conceptIds:['fake']}))},{...validPlan,stages:validPlan.stages.map(s=>({...s,why:'Sem evidência',tips:['Dica sem fonte'],activity:'Ação',doneWhen:'Pronto'}))}])assert.throws(()=>parsePathPlan(JSON.stringify(plan),sources));
 assert.throws(()=>parsePathPlan(JSON.stringify(validPlan).replaceAll('[S1]','[S9]'),sources));
});
test('full PDF URLs use registered IDs or exact known titles, never arbitrary paths',()=>{
 assert.equal(books.length,7);assert.equal(bookPdfUrl({kind:'book',title:'Inspirado',page:12}),'/api/books/inspirado/pdf#page=12');assert.equal(bookPdfUrl({kind:'book',title:'../../segredo'}),undefined);assert.equal(bookPdfUrl({kind:'editorial',title:'Inspirado'}),undefined);
 for(const b of books)assert.equal(readFileSync('private-data/books/'+b.id+'.pdf').subarray(0,5).toString(),'%PDF-');
});
test('PDF partial requests support open ranges, suffixes, clamping and explicit invalid ranges',()=>{
 assert.equal(pdfRange(null,100),null);assert.deepEqual(pdfRange('bytes=0-9',100),{start:0,end:9});assert.deepEqual(pdfRange('bytes=90-',100),{start:90,end:99});assert.deepEqual(pdfRange('bytes=-10',100),{start:90,end:99});assert.deepEqual(pdfRange('bytes=90-999',100),{start:90,end:99});
 for(const value of ['bytes=100-','bytes=10-2','bytes=-0','bytes=0-2,10-20','bytes=-','garbage'])assert.equal(pdfRange(value,100),'invalid');
});
test('context-only recall may be verified without making user context bibliographic authority',async()=>{
 let calls=0;const result=await groundedAnswer({instructions:'Relate apenas o contexto',messages:[{role:'user',content:'Contexto: orçamento limitado. Qual é a restrição?'}],sources:[],sourceText:'',allowContextOnly:true,maxOutput:1000,onPhase:()=>{},generate:async()=>++calls===1?'Você informou que o orçamento é limitado.':'{"supported":true,"issues":[],"contextOnly":true}'});assert.equal(result.validated,true);assert.equal(result.sources.length,0);assert.equal(calls,2);
});
