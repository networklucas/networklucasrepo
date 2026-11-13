import {NextRequest} from 'next/server';
import {z} from 'zod';
import {readAiRequest,aiError} from '@/lib/ai-request';
import {modelGenerator} from '@/lib/model-call';
import {withinDeadline} from '@/lib/deadline';
import {retrieveContext,skillInstructions} from '@/lib/corpus';
import {chatInstructions} from '@/lib/chat-instructions';
import {groundedAnswer} from '@/lib/grounding';
import {pathInstructions,parsePathPlan} from '@/lib/problem-path';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=120;
const schema=z.object({finalize:z.boolean().default(false),problem:z.string().min(2).max(4000),audience:z.string().max(2000),outcome:z.string().max(2000),evidence:z.string().max(4000),answers:z.record(z.string().max(100),z.string().max(4000)),context:z.string().max(18000).default(''),confidential:z.boolean(),previous:z.string().max(24000).optional()});
export async function POST(req:NextRequest){try{
 const data=await readAiRequest(req,schema);const context=retrieveContext(data.problem+' '+data.outcome,[]);if(!context.sources.length)throw Error('Não há fontes suficientes para montar uma trilha sobre este problema.');
 const abort=new AbortController(),signal=AbortSignal.any([req.signal,abort.signal]);
 const result=await withinDeadline(()=>groundedAnswer({instructions:chatInstructions(skillInstructions(),context.text,true)+'\n'+pathInstructions(context.sources)+(data.finalize?'\nAgora conclua a proposta com base nas respostas coletadas. Se faltarem evidências, entregue um plano de validação, sem afirmar resolução.':''),messages:[{role:'user',content:JSON.stringify(data)}],sources:context.sources,sourceText:context.text,generate:modelGenerator({confidential:data.confidential,deep:true,signal}),maxOutput:8192,onPhase:()=>{}}),90000,req.signal,()=>abort.abort());
 if(!result.validated)throw Error('Não foi possível validar a trilha nas fontes. Tente novamente.');
 const plan=parsePathPlan(result.text,result.sources);return Response.json({plan,sources:result.sources},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return aiError(error);}}
