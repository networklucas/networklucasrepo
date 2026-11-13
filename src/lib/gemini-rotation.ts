import {providerFailure} from './provider-failure';

export const defaultGeminiModels=[
 'gemini-3.5-flash-lite','gemini-3.1-flash-lite','gemini-2.5-flash-lite',
 'gemini-3.8-flash','gemini-3.6-flash','gemini-3-flash-preview','gemini-2.5-flash'
] as const;
const supported=new Set<string>(defaultGeminiModels);
const dailyExhausted=new Set<string>();
export function geminiThinkingLevel(deep:boolean){return deep?'medium' as const:'low' as const;}

export function geminiModels(environment:{GEMINI_MODELS?:string;GEMINI_MODEL?:string}=process.env as {GEMINI_MODELS?:string;GEMINI_MODEL?:string}):string[]{
 const configured=environment.GEMINI_MODELS??environment.GEMINI_MODEL;
 if(!configured)return [...defaultGeminiModels];
 const models=[...new Set(configured.split(',').map(value=>value.trim()).filter(Boolean))];
 if(!models.length||models.some(model=>!supported.has(model)))throw new Error('GEMINI_MODELS_INVALID');
 return models;
}

type RotationOptions<T>={
 models:string[]; signal:AbortSignal; deadlineMs:number; run:(model:string,remainingMs:number)=>Promise<T>; onModel?:(model:string)=>void; onReset?:()=>void;
 now?:()=>number; wait?:(milliseconds:number,signal:AbortSignal)=>Promise<void>; log?:(record:Record<string,unknown>)=>void;
};

function dailyQuota(error:unknown){return /\b(daily|per day|requests?[_ ]per[_ ]day|rpd)\b/i.test(String((error as {message?:unknown})?.message??''));}
function retryAfter(error:unknown){
 const source=error as {headers?:unknown;retryAfter?:unknown;retry_after?:unknown};
 const raw=source.retryAfter??source.retry_after??(source.headers instanceof Headers?source.headers.get('retry-after'):undefined);
 const seconds=typeof raw==='string'?Number(raw):typeof raw==='number'?raw:NaN;
 return Number.isFinite(seconds)&&seconds>0?Math.ceil(seconds*1000):undefined;
}

/** Runs one complete streamed interaction per model and resets any visible draft before changing model. */
export async function rotateGemini<T>(options:RotationOptions<T>):Promise<{value:T;model:string}>{
 const now=options.now??Date.now;const started=now();let lastError:unknown;
 const candidates=options.models.filter(model=>!dailyExhausted.has(model));
 for(let index=0;index<candidates.length;index++){
  const model=candidates[index];options.signal.throwIfAborted();options.onModel?.(model);
  const remaining=options.deadlineMs-(now()-started);if(remaining<=0)throw new Error('REQUEST_TIMEOUT');
  try{const value=await options.run(model,remaining);options.log?.({event:'gemini_model_attempt',model,result:'completed'});return {value,model};}
  catch(error){
   if(options.signal.aborted)throw error;
   const failure=providerFailure(error);const daily=dailyQuota(error);
   if(daily)dailyExhausted.add(model);
   const retryable=['rate_limit','unavailable','timeout','incomplete'].includes(failure.kind);
   options.log?.({event:'gemini_model_attempt',model,result:'failed',kind:failure.kind,status:failure.status,daily});
   if(!retryable)throw error;
   lastError=error;options.onReset?.();
   const delay=retryAfter(error);
   const remaining=options.deadlineMs-(now()-started);
   if(!daily&&index===candidates.length-1&&delay!==undefined&&delay<remaining){
    const wait=options.wait??(async(milliseconds,signal)=>{const {setTimeout}=await import('node:timers/promises');await setTimeout(milliseconds,undefined,{signal});});
    options.log?.({event:'gemini_model_wait',model,reason:'rate_limit',milliseconds:delay});
    await wait(delay,options.signal);dailyExhausted.delete(model);index--;continue;
   }
  }
 }
 throw lastError??new Error('GEMINI_MODELS_EXHAUSTED');
}
