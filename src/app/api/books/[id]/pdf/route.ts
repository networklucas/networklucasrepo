import {stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {books,pdfRange} from '@/lib/book-files';
export const runtime='nodejs';export const dynamic='force-dynamic';
async function serve(req:Request,params:Promise<{id:string}>,head=false){
 const {id}=await params;const book=books.find(b=>b.id===id);if(!book)return new Response('Livro não encontrado.',{status:404});
 const file=join(process.cwd(),'private-data','books',book.id+'.pdf');let size:number;try{size=(await stat(file)).size;}catch{return new Response('PDF indisponível neste ambiente.',{status:404});}
 const range=pdfRange(req.headers.get('range'),size);if(range==='invalid')return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+size,'Cache-Control':'private, no-store'}});
 const start=range?.start??0,end=range?.end??size-1;
 const headers:Record<string,string>={'Content-Type':'application/pdf','Content-Disposition':`inline; filename="${book.id}.pdf"`,'Content-Length':String(end-start+1),'Accept-Ranges':'bytes','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
 if(range)headers['Content-Range']=`bytes ${start}-${end}/${size}`;
 const stream=head?null:createReadStream(file,{start,end});if(stream){const cancel=()=>stream.destroy();req.signal.addEventListener('abort',cancel,{once:true});stream.on('close',()=>req.signal.removeEventListener('abort',cancel));}
 return new Response(stream?Readable.toWeb(stream) as ReadableStream<Uint8Array>:null,{status:range?206:200,headers});
}
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){return serve(req,params);}
export async function HEAD(req:Request,{params}:{params:Promise<{id:string}>}){return serve(req,params,true);}
