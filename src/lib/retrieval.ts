import type { Chunk, Source } from './types';
const STOP=new Set('a o e de da do das dos em um uma os as para com que por no na nos nas se ao ou como mais seu sua esse essa pelo pela the and to of is it'.split(' '));
export function tokenize(text:string):string[] {return text.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').match(/[a-z0-9]{2,}/g)?.filter(x=>!STOP.has(x))??[];}
export function bm25(query:string,chunks:Chunk[],df:Record<string,number>,average:number): (Chunk & {score:number})[] {
 const tokens=[...new Set(tokenize(query))];const n=chunks.length;
 return chunks.map(c=>{let score=0;for(const t of tokens){const tf=c.terms?.[t]??0;if(!tf)continue;const idf=Math.log(1+(n-(df[t]??0)+.5)/((df[t]??0)+.5));score+=idf*(tf*2.2)/(tf+1.2*(.25+.75*(c.length??1)/average));}return {...c,score};}).filter(c=>c.score>0).sort((a,b)=>b.score-a.score);
}
export function publicSource(c:Chunk):Source {return {id:c.id,bookId:c.bookId,title:c.title,kind:c.kind,author:c.author,page:c.page,chapter:c.chapter,reference:c.reference,excerpt:c.text.slice(0,340),url:c.url,publishedAt:c.publishedAt,reviewedAt:c.reviewedAt};}
export function validateCitations(text:string,validIds:Set<string>) {return text.replace(/\[S(\d+)\]/g,(match,n)=>validIds.has('S'+n)?match:'[fonte não verificada]');}
