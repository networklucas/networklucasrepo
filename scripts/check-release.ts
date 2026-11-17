import assert from 'node:assert/strict';
import {corpus,retrieveContext} from '../src/lib/corpus';
import {release} from '../src/lib/release';

/** Release gate deliberately has no provider call; live validation happens once after deployment. */
function check(question:string,page:number){
 const data=corpus(),book=data.books.find(b=>b.id==='melhores-praticas-de-chatbot');
 assert.ok(book);assert.equal(book.pages,104);assert.ok(data.books.length>=6);
 const selected=retrieveContext(question).sources.find(s=>s.kind==='book'&&s.title===book.title&&s.page===page);
 assert.ok(selected,'Expected guide page missing from retrieval.');
 console.log('RELEASE_SOURCE_CHECK '+JSON.stringify({version:release.version,books:data.books.length,newBookId:book.id,page,selected:true,providerCalls:0}));
}
for(const item of [
 {question:'Como calcular resolução confirmada?',page:5},
 {question:'Como redesenhar uma conversa que entra em repetição?',page:3},
 {question:'O que o atendente precisa receber na transferência?',page:4},
 {question:'Na auditoria de resolução inferida com 48 confirmações e 22 inferências, como interpretar o painel agregado de 70%?',page:26},
])check(item.question,item.page);
