import {editorialChunks} from './editorial';
import {tokenize} from './retrieval';
import 'server-only';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import type {Book,Chunk} from './types';
import {bm25,publicSource} from './retrieval';
import {selectContext} from './context-selection';
import type {Message} from './types';
type Corpus={books:Book[];chunks:Chunk[];df:Record<string,number>;averageLength:number;sourceRevision:string};
let cached:Corpus|undefined;
export function corpus():Corpus {return cached??=JSON.parse(gunzipSync(readFileSync(join(process.cwd(),'private-data/corpus.json.gz'))).toString('utf8'));}
export function skillInstructions(){return readFileSync(join(process.cwd(),'private-data/skill/SKILL.md'),'utf8');}
export function bookMetadata(){return corpus().books;}
export function searchLibrary(query:string,kind?:string) {
 const c=corpus(); const editorial=editorialChunks().map(x=>({...x,score:tokenize(query).filter(t=>(x.terms?.[t]??0)>0).length})).filter(x=>x.score>0); const ranked=[...bm25(query,c.chunks,c.df,c.averageLength),...editorial];
 const filtered=ranked.filter(x=>!kind||x.kind===kind); return [...filtered.filter(x=>x.kind!=='editorial').slice(0,6),...filtered.filter(x=>x.kind==='editorial').slice(0,2)].map(publicSource);
}
export function retrieveContext(query:string,history:Message[]=[]) {return selectContext(query,history,corpus());}
