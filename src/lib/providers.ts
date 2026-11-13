import {withinDeadline} from './deadline';
import 'server-only';
import {GoogleGenAI} from '@google/genai';
import OpenAI from 'openai';
import {actualCost} from './budget';
import {geminiKeyState} from './config';
import type {Message} from './types';
import {ProviderError,consumeGeminiStream} from './provider-stream';
import {geminiModels,geminiThinkingLevel,rotateGemini} from './gemini-rotation';
export {ProviderError} from './provider-stream';
type RunOptions={instructions:string;messages:Message[];maxOutput:number;deep:boolean;signal:AbortSignal;onText:(text:string)=>void;onModel?:(model:string)=>void;onReset?:()=>void};
type Result={cost?:number};
export function recoverable(error:unknown) {
 const e=error as {status?:number;code?:string;name?:string};
 return ['APIConnectionError','APIConnectionTimeoutError','RequestTimeoutError','ConnectionError'].includes(e.name??'')||[408,429,500,502,503,504].includes(e.status??0)||['insufficient_quota','credit_balance_exhausted','rate_limit_exceeded','STREAM_INCOMPLETE','TIMEOUT','BUDGET_UNAVAILABLE'].includes(e.code??(error instanceof ProviderError?error.code:''));
}
export async function runOpenAI(o:RunOptions):Promise<Result>{
 const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY,maxRetries:0,timeout:90000});
 const stream=await client.responses.create({model:process.env.OPENAI_MODEL||'gpt-6.1-sol',store:false,stream:true,instructions:o.instructions,input:o.messages.map(m=>({role:m.role,content:m.content})),max_output_tokens:o.maxOutput,reasoning:{effort:o.deep?'medium':'low'}},{signal:o.signal});
 let completed=false,cost:number|undefined;
 for await(const e of stream){
  if(e.type==='response.output_text.delta')o.onText(e.delta);
  if(e.type==='response.failed')throw new ProviderError(e.response.error?.code??'OPENAI_FAILED');
  if(e.type==='response.incomplete')throw new ProviderError(e.response.incomplete_details?.reason==='max_output_tokens'?'OUTPUT_LIMIT':'STREAM_INCOMPLETE');
  if(e.type==='response.completed'){completed=true;const u=e.response.usage;if(u)cost=actualCost(u.input_tokens,u.output_tokens,u.input_tokens_details.cached_tokens);}
 }
 o.signal.throwIfAborted();if(!completed)throw new ProviderError('STREAM_INCOMPLETE');
 return {cost};
}
export async function runGemini(o:RunOptions):Promise<Result>{
 const models=geminiModels();
 const result=await rotateGemini({models,signal:o.signal,deadlineMs:o.deep?60000:30000,onModel:o.onModel,onReset:o.onReset,log:record=>console.info(JSON.stringify(record)),run:(model,remainingMs)=>runGeminiAttempt({...o,model,timeoutMs:remainingMs})});
 return result.value;
}
async function runGeminiAttempt(o:RunOptions&{model:string;timeoutMs:number}):Promise<Result>{
 const controller=new AbortController();const signal=AbortSignal.any([o.signal,controller.signal]);
 return withinDeadline(()=>runGeminiStream({...o,signal}),Math.min(o.timeoutMs,o.deep?60000:30000),o.signal,()=>controller.abort());
}
async function runGeminiStream(o:RunOptions&{model:string;timeoutMs:number}):Promise<Result>{
 const state=geminiKeyState(process.env.GEMINI_API_KEY);
 if(state==='missing')throw new ProviderError('GEMINI_NOT_CONFIGURED');
 if(state==='invalid')throw new ProviderError('GEMINI_INVALID_KEY_FORMAT');
 const client=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY!.trim()});
 const stream=await client.interactions.create({
  model:o.model,store:false,stream:true,automatic_continuation:false,
  system_instruction:o.instructions,
  input:o.messages.map(m=>({type:m.role==='assistant'?'model_output' as const:'user_input' as const,content:[{type:'text' as const,text:m.content}]})),
  generation_config:{max_output_tokens:o.maxOutput,thinking_level:geminiThinkingLevel(o.deep)}
 },{signal:o.signal,timeout_ms:Math.min(o.timeoutMs,30000),retries:{strategy:'none'}});
 await consumeGeminiStream(stream,o.signal,o.onText);
 return {};
}
