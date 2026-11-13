import type {ChatEvent} from './types';
export type Runner=(onText:(t:string)=>void)=>Promise<void>;
export async function withFallback(options:{primary?:Runner;backup?:Runner;confidential:boolean;reason:string;emit:(e:ChatEvent)=>void;retryable:(e:unknown)=>boolean;signal:AbortSignal}) {
 const {emit,signal}=options;
 if(options.primary){
  for(let attempt=0;attempt<2;attempt++){
   signal.throwIfAborted();
   emit({type:'provider',provider:'GPT-6.1 Sol',reason:attempt?'Nova tentativa após indisponibilidade temporária.':'Modelo principal.'});
   try{await options.primary(t=>emit({type:'delta',text:t}));return;}
   catch(e){
    if(signal.aborted)throw e;
    if(!options.retryable(e))throw e;
    emit({type:'reset',reason:'A resposta incompleta foi descartada.'});
    if(attempt===0){await new Promise(r=>setTimeout(r,250));continue;}
   }
  }
 }
 if(options.confidential)throw new Error('CONFIDENTIAL_BLOCKED');
 if(!options.backup)throw new Error('GEMINI_NOT_CONFIGURED');
 await options.backup(t=>emit({type:'delta',text:t}));
}
