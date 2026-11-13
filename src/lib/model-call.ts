import 'server-only';
import {openaiConfigured,reserve,budgetStatus} from './budget';
import {runGemini,runOpenAI,recoverable,ProviderError} from './providers';
import {withFallback} from './orchestration';
import type {Message,ChatEvent} from './types';

/** Shared by chat, memory and problem paths. Never exposes drafts. */
export function modelGenerator(options:{confidential:boolean;deep:boolean;signal:AbortSignal;emit?:(event:ChatEvent)=>void}){
 return async(instructions:string,messages:Message[],maxOutput:number)=>{
  const {signal,deep,confidential}=options;signal.throwIfAborted();let candidate='',reason='Gemini ativo. Sol ainda não foi configurado.';
  const primary=openaiConfigured()?async(onText:(text:string)=>void)=>{
   let hold;try{hold=await reserve(instructions+messages.map(m=>m.content).join('\n'),maxOutput);}catch{throw new ProviderError('BUDGET_UNAVAILABLE');}if(!hold)throw new ProviderError('credit_balance_exhausted');
   try{const result=await runOpenAI({instructions,messages,maxOutput,deep,signal,onText});if(result.cost!==undefined)await hold.settle(result.cost);}catch(e){const status=(e as {status?:number}).status;if(status&&[400,401,403,404,429].includes(status))await hold.settle(0);throw e;}
  }:undefined;
  let safePrimary=primary;if(primary){try{if(!(await budgetStatus()).available){safePrimary=undefined;reason='Sol indisponível ou orçamento atingido.';}}catch{safePrimary=undefined;reason='Controle de consumo Sol indisponível.';}}
  const emit=(event:ChatEvent)=>{if(event.type==='delta')candidate+=event.text;else if(event.type==='reset')candidate='';options.emit?.(event);};
  await withFallback({primary:safePrimary,backup:process.env.GEMINI_API_KEY?async onText=>{await runGemini({instructions,messages,maxOutput,deep,signal,onText,onReset:()=>emit({type:'reset',reason:'A resposta incompleta foi descartada.'}),onModel:model=>emit({type:'provider',provider:model,reason:'Modelo Gemini em uso.'})});}:undefined,confidential,reason,signal,retryable:recoverable,emit});
  signal.throwIfAborted();return candidate;
 };
}
