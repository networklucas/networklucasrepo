import {editorialChunks} from './editorial';
import {concepts} from './concepts';
import {retrievalQueries} from './conversation';
import {bm25,publicSource,tokenize} from './retrieval';
import {routeReferences} from './routing';
import type {Chunk,Message} from './types';

// Instructions about the answer format are not the subject to search in books.
const META=new Set('combine combinar conceito conceitos trecho trechos livro livros disponivel disponiveis base bases conteudo conteudos fonte fontes cite citar citacao citacoes referencia referencias ambos ambas sustentarem sustentar explicacao explicar explique aplicacao aplicar ajude ajuda gostaria preciso quero menos tambem usando fornecidos fornecidas'.split(' '));
export function topicalQuery(query:string){return tokenize(query).filter(t=>!META.has(t)).join(' ');}

export function selectContext(query:string,history:Message[],corpus:{chunks:Chunk[];df:Record<string,number>;averageLength:number}){
 const groups=retrievalQueries(query,history).map(part=>{
  const subject=topicalQuery(part),routed=routeReferences(subject);
  // The existing concept vocabulary bridges short/English terms to Portuguese books.
  const vocabulary=concepts.filter(c=>routed.includes(c.reference)).flatMap(c=>{
   const description=tokenize(c.title+' '+c.summary+' '+c.when);
   // Expand subject aliases, not author names that would favor book endorsements.
   return c.keywords.filter(keyword=>tokenize(keyword).some(term=>description.some(word=>word.startsWith(term))));
  });
  const ranked=bm25([subject,...vocabulary].join(' '),corpus.chunks,corpus.df,corpus.averageLength);
  const refs=routed.length?routed.map(ref=>corpus.chunks.find(c=>c.reference===ref)).filter((c):c is Chunk=>!!c):ranked.filter(c=>c.kind==='skill').slice(0,1);
  const editorial=editorialChunks().map(c=>({...c,score:tokenize(subject).filter(t=>(c.terms?.[t]??0)>0).length})).filter(c=>c.score>=2).sort((a,b)=>b.score-a.score).slice(0,2);
  return {refs,books:ranked.filter(c=>c.kind==='book').slice(0,6),editorial};
 });
 // Round-robin selection keeps a long first question from starving other subjects.
 const selected:Chunk[]=[],seen=new Set<string>();
 for(const key of ['refs','books','editorial'] as const){let count=0;for(let i=0;i<6;i++)for(const group of groups){const c=group[key][i];if(c&&!seen.has(c.id)&&count<12){selected.push(c);seen.add(c.id);count++;}}}
 const sources=selected.map((c,i)=>({...publicSource(c),id:'S'+(i+1)}));
 const text=selected.map((c,i)=>{
  const concept=concepts.find(concept=>concept.reference===c.reference);
  return `[${sources[i].id}] ${c.title}${c.author?' — '+c.author:''}${c.page?' — página PDF '+c.page:''}${c.kind==='editorial'?' — SÍNTESE EDITORIAL, não transcrição; artigo original: '+c.url+'; publicado em '+c.publishedAt+'; revisão '+c.reviewedAt:''}\n${concept?'Conceito disponível: '+concept.title+'\n'+concept.summary+'\nQuando usar: '+concept.when+'\nLimite: '+concept.limit+'\n\n':''}${c.text}`;
 }).join('\n\n---\n\n');
 return {sources,text};
}
