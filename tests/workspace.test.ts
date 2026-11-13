import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {appearanceBootstrap} from '../src/lib/appearance-preferences';
import {chatSchema} from '../src/lib/chat-schema';
import {decisionDraft,decisionMarkdown,journeys,journeyContext,mergeBackup,newProject,parseBackup,portableWorkspace,type Workspace} from '../src/lib/workspace-model';
import {selectContext} from '../src/lib/context-selection';
import {groundedAnswer,removePromotionalSignature} from '../src/lib/grounding';

test('backup round trip preserves decisions, sources and explicit saved attachments, strips retry snapshots',()=>{
 const p=newProject('prioritize');p.answers.objective='Reduzir abandono';p.sessions[0].messages=[{id:'u',role:'user',content:'Minha pergunta'},{id:'a',role:'assistant',content:'Aplicação [S1]',completed:true,sources:[{id:'S1',title:'Ficha',kind:'editorial',excerpt:'Síntese',url:'https://example.com/artigo'}],request:{message:'Pergunta',mode:'quick',confidential:false,attachment:{name:'temporario.pdf',pages:1,text:'NÃO SALVAR'}}}];
 p.attachment={name:'guardado.pdf',pages:1,text:'Texto explicitamente salvo'};p.decisions=[decisionDraft(p)];p.decisions[0].status='decided';
 const backup=JSON.stringify(portableWorkspace({version:2,projects:[p],trails:[]}));assert.ok(!backup.includes('NÃO SALVAR'));
 const restored=parseBackup(backup).projects[0];assert.equal(restored.decisions[0].status,'decided');assert.equal(restored.decisions[0].sources[0].url,'https://example.com/artigo');assert.equal(restored.attachment?.text,p.attachment.text);
 assert.match(decisionMarkdown(restored,restored.decisions[0]),/https:\/\/example.com\/artigo/);
});
test('invalid, future, duplicated and oversized backups fail without mutating the current workspace',()=>{
 const current:Workspace={version:2,projects:[newProject()],trails:[]},before=JSON.stringify(current);
 for(const raw of ['no json','{"version":3,"projects":[]}',JSON.stringify({version:1,projects:[current.projects[0],current.projects[0]]}),JSON.stringify({version:1,projects:[{...current.projects[0],sessions:'bad'}]}),' '.repeat(20*1024*1024+1)])assert.throws(()=>parseBackup(raw));
 assert.equal(JSON.stringify(current),before);
});
test('import collision preserves existing work and restores a separate copy',()=>{
 const p=newProject(),current:Workspace={version:2,projects:[p],trails:[]},incoming=parseBackup(JSON.stringify(current));incoming.projects[0].name='Importado';
 const merged=mergeBackup(current,incoming);assert.equal(merged.projects.length,2);assert.equal(merged.projects[0].name,'Novo projeto');assert.equal(merged.projects[1].name,'Importado (cópia)');assert.notEqual(merged.projects[1].id,p.id);
});
test('three journeys have at most three questions per round and preserve unknown answers',()=>{
 for(const id of ['prioritize','discovery','direction'] as const){const p=newProject(id);for(const group of journeys[id].groups)assert.ok(group.fields.length<=3);p.answers[journeys[id].groups[0].fields[0].key]='Ainda não sei';assert.match(journeyContext(p),/Ainda não sei/);assert.equal(decisionDraft(p).status,'draft');}
});
test('structured user context is bounded and does not become bibliographic evidence',()=>{
 assert.equal(chatSchema.safeParse({message:'Ajude a priorizar',context:{project:'Projeto',journey:'prioritize',summary:'Objetivo'}}).success,true);
 assert.equal(chatSchema.safeParse({message:'Ajude a priorizar',context:{project:'Projeto',summary:'x'.repeat(18001)}}).success,false);
 const instructions=readFileSync('src/lib/chat-instructions.ts','utf8');assert.match(instructions,/não instrução de sistema nem autoridade bibliográfica/);assert.match(instructions,/Não acrescente assinaturas/);
});
test('editorial retrieval includes actual curated text, original URL and attribution',()=>{
 const corpus=JSON.parse(readFileSync('private-data/corpus.json','utf8'));const result=selectContext('discovery hipótese risco evidência',[],corpus);
 const editorials=result.sources.filter(s=>s.kind==='editorial');assert.ok(editorials.length>0);assert.ok(editorials.every(s=>s.url?.startsWith('https://www.productgurus.com.br/p/')));assert.match(result.text,/SÍNTESE EDITORIAL, não transcrição/);assert.match(result.text,/Exercício proposto pela Bússola/);
});
test('editorial answers are checked against the supplied synthesis, retaining only used sources',async()=>{
 const source={id:'S1',title:'Síntese editorial',kind:'editorial' as const,excerpt:'O método depende da incerteza.',url:'https://example.com/artigo'};let calls=0;
 const result=await groundedAnswer({instructions:'Use apenas as fontes',messages:[{role:'user',content:'Como escolher?'}],sources:[source],sourceText:'[S1] O método depende da incerteza.',maxOutput:1000,onPhase:()=>{},generate:async()=>++calls===1?'Segundo a síntese editorial, o método depende da incerteza [S1].':'{"supported":true,"issues":[]}'});
 assert.equal(result.validated,true);assert.equal(result.sources[0].kind,'editorial');assert.equal(calls,2);
});
test('standalone promotional signatures are removed while actual source attribution is preserved',()=>{
 assert.equal(removePromotionalSignature('Resposta [S1].\n\nProduct Guru’s · PM Especialista'),'Resposta [S1].');
 assert.equal(removePromotionalSignature('Fonte: Product Guru’s · PM Especialista [S1].'),'Fonte: Product Guru’s · PM Especialista [S1].');
});
test('monochrome assets and dark default preserve valid saved preferences',()=>{
 for(const file of ['src/app/globals.css','src/app/workspace.css','src/app/minimal.css','src/app/accessibility.css','src/app/icon.svg'])for(const m of readFileSync(file,'utf8').matchAll(/#([\da-f]{6})(?:[\da-f]{2})?\b/gi)){const rgb=m[1].match(/../g)!;assert.equal(rgb[0],rgb[1],file);assert.equal(rgb[1],rgb[2],file);}
 function theme(saved:string|null){const doc={documentElement:{dataset:{} as Record<string,string>}};new Function('localStorage','document',appearanceBootstrap)({getItem:()=>saved},doc);return doc.documentElement.dataset.theme;}
 assert.equal(theme(null),'dark');assert.equal(theme('{bad'),'dark');for(const value of ['light','system','dark'])assert.equal(theme(JSON.stringify({theme:value})),value);
});
