import type {GoogleGenAI} from '@google/genai';
export class ProviderError extends Error {constructor(public code:string){super(code);}}
type Item<T>=T extends AsyncIterable<infer E>?E:never;
export type GeminiEvent=Item<Awaited<ReturnType<GoogleGenAI['interactions']['create']>>>;

/** Uses the installed SDK's discriminated event union, without coercing events. */
export async function consumeGeminiStream(stream:AsyncIterable<GeminiEvent>,signal:AbortSignal,onText:(text:string)=>void){
 let completed=false,hasText=false,lastEventType='',terminalStatus='';
 for await(const event of stream){
  signal.throwIfAborted();lastEventType=event.event_type;
  if(event.event_type==='step.delta'&&event.delta.type==='text'&&event.delta.text){hasText=true;onText(event.delta.text);}
  if(event.event_type==='error')throw new ProviderError(event.error?.code??'GEMINI_FAILED');
  if(event.event_type==='interaction.status_update'||event.event_type==='interaction.completed'){
   terminalStatus=event.event_type==='interaction.completed'?event.interaction.status:event.status;
   if(['incomplete','requires_continuation','budget_exceeded'].includes(terminalStatus))throw new ProviderError('OUTPUT_LIMIT');
   if(terminalStatus==='failed'||terminalStatus==='cancelled')throw new ProviderError('GEMINI_FAILED');
   if(terminalStatus==='requires_action')throw new ProviderError('GEMINI_REQUIRES_ACTION');
   if(event.event_type==='interaction.completed')completed=terminalStatus==='completed';
  }
 }
 signal.throwIfAborted();
 if(!completed||!hasText){console.warn(JSON.stringify({event:'gemini_incomplete',completed,hasText,lastEventType,terminalStatus}));throw new ProviderError('STREAM_INCOMPLETE');}
}
