import {providerFailure} from './provider-failure';

/** Models presently documented as eligible for the Interactions API in this project. */
export const defaultGeminiModels=[
 'gemini-3.5-flash-lite','gemini-3.1-flash-lite','gemini-2.5-flash-lite',
 'gemini-3.8-flash','gemini-3.6-flash','gemini-3-flash-preview'
] as const;
const supported=new Set<string>(defaultGeminiModels);
const dailyExhausted=new Map<string,number>();
export function geminiThinkingLevel(deep:boolean){return deep?'medium' as const:'low' as const;}

export function geminiModels(environment:{GEMINI_MODELS?:string;GEMINI_MODEL?:string}=process.env as {GEMINI_MODELS?:string;GEMINI_MODEL?:string}):string[]{
 const configured=environment.GEMINI_MODELS??environment.GEMINI_MODEL;
 if(!configured)return [...defaultGeminiModels];
 const models=[...new Set(configured.split(',').map(value=>value.trim()).filter(Boolean))];
 if(!models.length||models.some(model=>!supported.has(model)))throw new Error('GEMINI_MODELS_INVALID');
 return models;
}

type RotationOptions<T>={
 models:string[]; signal:AbortSignal; deadlineMs:number; run:(model:string,remainingMs:number,reportDelta:()=>void)=>Promise<T>; onModel?:(model:string)=>void; onReset?:()=>void;
 now?:()=>number; wait?:(milliseconds:number,signal:AbortSignal)=>Promise<void>; log?:(record:Record<string,unknown>)=>void;
};

function sleep(milliseconds:number,signal:AbortSignal){return import('node:timers/promises').then(({setTimeout})=>setTimeout(milliseconds,undefined,{signal}));}

/** Runs one complete streamed interaction per model and resets any visible draft before changing model. */
export async function rotateGemini<T>(options:RotationOptions<T>):Promise<{value:T;model:string}>{
 const now=options.now??Date.now;const started=now();let lastError:unknown;let waitedForMinuteLimit=false;
 const candidates=options.models.filter(model=>{
  const until=dailyExhausted.get(model);if(!until)return true;
  if(until<=now()){dailyExhausted.delete(model);return true;}return false;
 });
 for(let index=0;index<candidates.length;index++){
  const model=candidates[index];let emitted=false;options.signal.throwIfAborted();
  const remaining=options.deadlineMs-(now()-started);if(remaining<=0)throw new Error('REQUEST_TIMEOUT');
  try{const value=await options.run(model,remaining,()=>{emitted=true;});options.onModel?.(model);options.log?.({event:'gemini_model_attempt',model,result:'completed'});return {value,model};}
  catch(error){
   if(options.signal.aborted)throw error;
   const failure=providerFailure(error);const daily=failure.quota==='daily';
   // Share a daily suppression only while the provider's own renewal time is valid.
   if(daily&&failure.retryAfterMs!==undefined)dailyExhausted.set(model,now()+failure.retryAfterMs);
   const retryable=['rate_limit','unavailable','timeout','incomplete'].includes(failure.kind);
   options.log?.({event:'gemini_model_attempt',model,result:'failed',kind:failure.kind,status:failure.status,quota:failure.quota,retryAfterMs:failure.retryAfterMs});
   if(!retryable)throw error;
   lastError=error;if(emitted)options.onReset?.();
   const remainingAfterFailure=options.deadlineMs-(now()-started);
   if(failure.quota==='minute'&&!waitedForMinuteLimit&&failure.retryAfterMs!==undefined&&failure.retryAfterMs<remainingAfterFailure){
    waitedForMinuteLimit=true;options.log?.({event:'gemini_model_wait',model,reason:'minute_limit',milliseconds:failure.retryAfterMs});
    await (options.wait??sleep)(failure.retryAfterMs,options.signal);options.signal.throwIfAborted();index--;continue;
   }
  }
 }
 throw lastError??new Error('GEMINI_MODELS_EXHAUSTED');
}
