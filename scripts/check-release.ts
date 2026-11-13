import assert from 'node:assert/strict';
import {loadEnvConfig} from '@next/env';
import {NextRequest} from 'next/server';
import {POST} from '../src/app/api/chat/route';
import {corpus,retrieveContext} from '../src/lib/corpus';
import {citationIds} from '../src/lib/grounding';
import {release} from '../src/lib/release';
import type {ChatEvent,Source} from '../src/lib/types';

async function check(question:string,page:number){
 loadEnvConfig(process.cwd());
 const data=corpus(),book=data.books.find(b=>b.id==='melhores-praticas-de-chatbot');
 assert.ok(book);assert.equal(book.pages,104);assert.ok(data.books.length>=6);

 const selected=retrieveContext(question).sources.find(s=>s.kind==='book'&&s.title===book.title&&s.page===page);
 assert.ok(selected,'Expected guide page missing from retrieval.');
 const message=question;
 const req=new NextRequest('https://release-check.local/api/chat',{method:'POST',headers:{origin:'https://release-check.local','content-type':'application/json'},body:JSON.stringify({message,mode:'quick',history:[]})});
 const started=Date.now(),res=await POST(req);assert.equal(res.status,200);assert.ok(res.body);
 const reader=res.body.getReader(),decoder=new TextDecoder();let pending='',answer='',done=false,failed=false;let sources:Source[]=[];
 const handle=(e:ChatEvent)=>{if(e.type==='delta')answer+=e.text;if(e.type==='reset')answer='';if(e.type==='sources')sources=e.sources;if(e.type==='done')done=true;if(e.type==='error')failed=true;};
 while(true){const part=await reader.read();if(part.done)break;pending+=decoder.decode(part.value,{stream:true});let end;while((end=pending.indexOf('\n'))>=0){const line=pending.slice(0,end);pending=pending.slice(end+1);if(line)handle(JSON.parse(line));}}
 pending+=decoder.decode();if(pending.trim())handle(JSON.parse(pending));
 const ids=citationIds(answer),newSourceCited=sources.some(s=>s.kind==='book'&&s.title===book.title&&s.page===page&&ids.includes(s.id));
 const passed=done&&!failed&&answer.length>40&&newSourceCited&&ids.every(id=>sources.some(s=>s.id===id));
 console.log('RELEASE_SOURCE_CHECK '+JSON.stringify({version:release.version,books:data.books.length,newBookId:book.id,page,newSourceCited,done,passed,durationMs:Date.now()-started}));
 assert.ok(passed,'The new book must support a completed, verified answer.');
}
async function main(){
 const cases=[
  {question:'Como calcular resolução confirmada?',page:5},
  {question:'Como redesenhar uma conversa que entra em repetição?',page:3},
  {question:'O que o atendente precisa receber na transferência?',page:4},
  {question:'Na auditoria de resolução inferida com 48 confirmações e 22 inferências, como interpretar o painel agregado de 70%?',page:26},
 ];
 for(const item of cases)await check(item.question,item.page);
}
main().catch(error=>{console.error('RELEASE_SOURCE_CHECK_FAILED',error instanceof Error?error.name:'Unknown');process.exitCode=1;});
