import {NextRequest} from 'next/server';
import {z} from 'zod';
import {readAiRequest,aiError} from '@/lib/ai-request';
import {modelGenerator} from '@/lib/model-call';
import {withinDeadline} from '@/lib/deadline';
import {memoryInstructions,verifiedMemorySelection} from '@/lib/project-memory';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=120;
const memoryRequestSchema=z.object({confidential:z.boolean(),turns:z.array(z.object({id:z.string().min(1).max(200),role:z.enum(['user','assistant']),content:z.string().min(1).max(16000)})).min(1).max(100)}).superRefine((v,ctx)=>{if(v.turns.reduce((n,t)=>n+t.content.length,0)>48000)ctx.addIssue({code:'custom',message:'Conversas acima do limite.'});if(new Set(v.turns.map(t=>t.id)).size!==v.turns.length)ctx.addIssue({code:'custom',message:'Turnos duplicados.'});});
export async function POST(req:NextRequest){try{
 const data=await readAiRequest(req,memoryRequestSchema),abort=new AbortController();const signal=AbortSignal.any([req.signal,abort.signal]);
 const text=await withinDeadline(()=>modelGenerator({confidential:data.confidential,deep:false,signal})(memoryInstructions,[{role:'user',content:JSON.stringify(data.turns)}],4096),90000,req.signal,()=>abort.abort());
 const summary=verifiedMemorySelection(text,data.turns);return Response.json({summary,coveredIds:data.turns.map(t=>t.id)},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return aiError(error);}}
