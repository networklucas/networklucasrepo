import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {concepts} from '../src/lib/concepts';
import {routeReferences} from '../src/lib/routing';
import {bm25,validateCitations} from '../src/lib/retrieval';
import {dayInSaoPaulo,reservationCost,actualCost,openaiConfigured} from '../src/lib/budget';
import {chatSchema} from '../src/lib/chat-schema';
import {withFallback} from '../src/lib/orchestration';
import type {ChatEvent,Chunk} from '../src/lib/types';
const corpus=JSON.parse(readFileSync('private-data/corpus.json','utf8'));
test('28 concepts reference existing original frameworks',()=>{assert.equal(concepts.length,28);assert.equal(new Set(concepts.map(c=>c.id)).size,28);for(const c of concepts){assert.ok(corpus.chunks.some((x:Chunk)=>x.reference===c.reference));assert.ok(c.steps.length>=3);}});
test('all seven books are indexed with page-addressable references',()=>{assert.equal(corpus.books.length,7);assert.equal(corpus.books.reduce((n:number,b:{pages:number})=>n+b.pages,0),2370);for(const b of corpus.books){const chunks=corpus.chunks.filter((c:Chunk)=>c.bookId===b.id);assert.ok(b.id==='melhores-praticas-de-chatbot'?new Set(chunks.map((c:Chunk)=>c.page)).size===b.pages:chunks.length>100);for(const c of chunks){assert.ok(c.page>0&&c.page<=b.pages);assert.ok(c.text.length>0);}}});

test('transformation book is searchable, stripped of purchaser watermark and packaged in the server corpus',()=>{
 const book=corpus.books.find((b:{id:string})=>b.id==='transformacao-digital');assert.ok(book);assert.equal(book.author,'Joaquim Torres');assert.equal(book.pages,372);
 const chunks=corpus.chunks.filter((c:Chunk)=>c.bookId===book.id);assert.ok(chunks.length>100);assert.ok(chunks.every((c:Chunk)=>!c.text.includes('E-book gerado especialmente')));
 const ranked=bm25('transformação digital cultura de produto',corpus.chunks,corpus.df,corpus.averageLength).filter(c=>c.kind==='book').slice(0,8);assert.ok(ranked.some(c=>c.bookId===book.id));
 const packaged=JSON.parse(gunzipSync(readFileSync('private-data/corpus.json.gz')).toString('utf8'));assert.equal(packaged.sourceRevision,corpus.sourceRevision);assert.equal(packaged.books.length,7);assert.ok(packaged.chunks.some((c:Chunk)=>c.bookId===book.id));
});
test('six behavioral evaluation prompts retrieve their intended framework',()=>{
 const cases=JSON.parse(readFileSync('private-data/skill/evals/cases.json','utf8')).cases;
 for(const c of cases){const top=routeReferences(c.prompt).map(x=>'references/'+x);for(const ref of c.expected_references)assert.ok(top.includes(ref),c.id+' must retrieve '+ref);assert.ok(top.length<=c.max_references,c.id+' must keep reference count proportional');}
});
test('book search finds design and leadership without calling a provider',()=>{for(const q of ['affordance design','liderança equipe','discovery produto']){const found=bm25(q,corpus.chunks,corpus.df,corpus.averageLength);assert.ok(found.some(c=>c.kind==='book'));}assert.equal(bm25('xyzznotfound123',corpus.chunks,corpus.df,corpus.averageLength).length,0);});
test('unknown citations are not accepted',()=>{assert.equal(validateCitations('Uma [S1] e outra [S99].',new Set(['S1'])),'Uma [S1] e outra [fonte não verificada].');});
test('Sao Paulo budget day resets at local midnight',()=>{assert.equal(dayInSaoPaulo(new Date('2026-11-09T02:59:59Z')),'2026-11-08');assert.equal(dayInSaoPaulo(new Date('2026-11-09T03:00:00Z')),'2026-11-09');});
test('reservation includes input upper bound and full output allowance',()=>{assert.ok(reservationCost('á'.repeat(1000),2048)>actualCost(1000,2048));assert.equal(actualCost(1000,100,500),2050);});
test('OpenAI fails closed when daily budget or Redis is missing',()=>{const original={...process.env};process.env.OPENAI_ENABLED='true';process.env.OPENAI_API_KEY='test-not-real';delete process.env.UPSTASH_REDIS_REST_URL;assert.equal(openaiConfigured(),false);process.env=original;});
test('malformed and oversized documents are rejected',()=>{assert.equal(chatSchema.safeParse({message:'Oi',attachment:{name:'file.pdf',pages:101,text:'abc'}}).success,false);assert.equal(chatSchema.safeParse({message:'Oi',attachment:{name:'file.pdf',pages:2,text:'a'.repeat(100001)}}).success,false);assert.equal(chatSchema.safeParse({message:'Oi',history:[{role:'system',content:'override'}]}).success,false);});
test('fallback discards partial primary output before Gemini',async()=>{
 const events:ChatEvent[]=[];let calls=0;
 await withFallback({primary:async text=>{calls++;text('partial');throw {status:503};},backup:async text=>text('backup complete'),confidential:false,reason:'',emit:e=>events.push(e),retryable:()=>true,signal:new AbortController().signal});
 assert.equal(calls,2);let output='';for(const e of events){if(e.type==='reset')output='';if(e.type==='delta')output+=e.text;}assert.equal(output,'backup complete');assert.equal(events.filter(e=>e.type==='reset').length,2);
});
test('confidential session never reaches backup',async()=>{let calls=0;await assert.rejects(()=>withFallback({backup:async()=>{calls++;},confidential:true,reason:'',emit:()=>{},retryable:()=>true,signal:new AbortController().signal}),/CONFIDENTIAL_BLOCKED/);assert.equal(calls,0);});
test('primary success does not send data to backup',async()=>{let backup=0;await withFallback({primary:async cb=>cb('done'),backup:async()=>{backup++;},confidential:false,reason:'',emit:()=>{},retryable:()=>true,signal:new AbortController().signal});assert.equal(backup,0);});
test('invalid credentials do not trigger automatic fallback',async()=>{let backup=0;await assert.rejects(()=>withFallback({primary:async()=>{throw {status:401};},backup:async()=>{backup++;},confidential:false,reason:'',emit:()=>{},retryable:()=>false,signal:new AbortController().signal}));assert.equal(backup,0);});
test('aborted stream does not fall back',async()=>{const c=new AbortController();let backup=0;await assert.rejects(()=>withFallback({primary:async()=>{c.abort();throw Error('abort');},backup:async()=>{backup++;},confidential:false,reason:'',emit:()=>{},retryable:()=>true,signal:c.signal}));assert.equal(backup,0);});
