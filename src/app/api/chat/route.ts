import {modelGenerator} from '@/lib/model-call';
import {chatInstructions} from '@/lib/chat-instructions';
import {providerFailure,providerFailureMessage} from '@/lib/provider-failure';
import {NextRequest} from 'next/server';
import {withinDeadline} from '@/lib/deadline';
import {chatSchema} from '@/lib/chat-schema';
import {retrieveContext,skillInstructions} from '@/lib/corpus';

import {ProviderError} from '@/lib/providers';

import {completedHistory} from '@/lib/conversation';
import {groundedAnswer} from '@/lib/grounding';
import type {ChatEvent,Message} from '@/lib/types';
export const runtime='nodejs';
export const maxDuration=120;
export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
 const origin=req.headers.get('origin');if(origin&&origin!==req.nextUrl.origin)return Response.json({error:'Origem não permitida.'},{status:403});
 if(Number(req.headers.get('content-length')??0)>800000)return Response.json({error:'Conteúdo acima do limite.'},{status:413});
 let data;try{const text=await req.text();if(Buffer.byteLength(text)>800000)return Response.json({error:'Conteúdo acima do limite.'},{status:413});const parsed=chatSchema.safeParse(JSON.parse(text));if(!parsed.success)return Response.json({error:parsed.error.issues[0]?.message??'Pedido inválido.'},{status:400});data=parsed.data;}catch{return Response.json({error:'Pedido inválido.'},{status:400});}
 const history=completedHistory(data.history);
 const context=retrieveContext(data.message+(data.context&&(/\b(isso|isto|projeto|próximo passo)\b/i.test(data.message)||data.message.length<30)?' '+data.context.summary.slice(0,2500):'')+(data.context?.journey?' '+({prioritize:'priorizar backlog',discovery:'discovery hipótese risco',direction:'estratégia posicionamento'}[data.context.journey]):''),history);
 const instructions=chatInstructions(skillInstructions(),context.text,data.mode==='deep');
 const last=data.message+(data.context?'\n\n<contexto_do_usuario>\n'+JSON.stringify(data.context)+'\n</contexto_do_usuario>':'')+(data.attachment?'\n\n<documento nome='+JSON.stringify(data.attachment.name)+'>\n'+data.attachment.text+'\n</documento>':'');
 const messages:Message[]=[...history,{role:'user',content:last}];
 // Allow room for reasoning plus multiple subjects; the prompt still limits visible length.
 const maxOutput=data.mode==='quick'?4096:8192;
 const encoder=new TextEncoder();const abort=new AbortController();const disconnect=()=>abort.abort();
 if(req.signal.aborted)abort.abort();else req.signal.addEventListener('abort',disconnect,{once:true});
 const startedAt=Date.now();
 const stream=new ReadableStream<Uint8Array>({async start(controller){
  let output='',closed=false;const progress:{phase:'generating'|'validating'}={phase:'generating'};
  const emit=(e:ChatEvent)=>{if(closed||abort.signal.aborted)return;if(e.type==='delta')output+=e.text;if(e.type==='reset')output='';try{controller.enqueue(encoder.encode(JSON.stringify(e)+'\n'));}catch{closed=true;abort.abort();}};
  const heartbeat=setInterval(()=>emit({type:'heartbeat'}),10000);
  try{

   // One deadline includes generation, validation and the optional single revision.
   const result=await withinDeadline(async()=>{
    const generate=modelGenerator({confidential:data.confidential,deep:data.mode==='deep',signal:abort.signal,emit});
    return groundedAnswer({instructions,messages,sourceText:context.text,sources:context.sources,generate,maxOutput,allowContextOnly:!!data.context,onPhase:phase=>{progress.phase=phase;emit({type:'phase',phase});}});
   },90000,req.signal,()=>abort.abort());
   console.info(JSON.stringify({event:'chat_grounding',validated:result.validated,revisions:result.revisions,audit:result.audit,sourceCount:result.sources.length,durationMs:Date.now()-startedAt}));
   emit({type:'delta',text:result.text});emit({type:'sources',sources:result.sources});emit({type:'done'});
  }catch(error){
   const code=error instanceof ProviderError?error.code:error instanceof Error?error.message:'UNKNOWN';
   console.warn(JSON.stringify({event:'chat_failure',phase:progress.phase,...providerFailure(error),durationMs:Date.now()-startedAt}));
   const message=(code==='REQUEST_TIMEOUT'||abort.signal.aborted)?'O provedor excedeu o prazo de resposta. Tente Ajuda rápida ou aguarde alguns minutos.':code==='CONFIDENTIAL_BLOCKED'?'Sessão confidencial: o envio ao Gemini está bloqueado. Ative o Sol com orçamento disponível ou remova o conteúdo confidencial.':code==='GEMINI_INVALID_KEY_FORMAT'?'GEMINI_API_KEY deve conter somente a chave da API, sem código, aspas ou quebras de linha.':code==='GEMINI_NOT_CONFIGURED'?'A IA ainda não está conectada. Configure GEMINI_API_KEY na Vercel. O guia e a biblioteca já estão disponíveis.':providerFailureMessage(error);
   if(output&&!closed){try{controller.enqueue(encoder.encode(JSON.stringify({type:'reset',reason:'A resposta incompleta foi descartada.'})+'\n'));}catch{}}
   if(!closed){try{controller.enqueue(encoder.encode(JSON.stringify({type:'error',message:progress.phase==='validating'?'Não foi possível concluir a validação nas fontes. A resposta não foi publicada. '+message:message})+'\n'));}catch{}}
  }finally{clearInterval(heartbeat);req.signal.removeEventListener('abort',disconnect);if(!closed){closed=true;try{controller.close();}catch{}}}
 },cancel(){abort.abort();}});
 return new Response(stream,{headers:{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
