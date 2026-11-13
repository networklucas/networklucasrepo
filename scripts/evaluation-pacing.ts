import {setTimeout} from 'node:timers/promises';

/** Test-only pacing below the observed project's 15 requests/minute allowance. */
export function evaluationPacer(){
 let nextStart=0;
 return async(signal:AbortSignal)=>{
  signal.throwIfAborted();
  const remaining=nextStart-Date.now();
  if(remaining>0)await setTimeout(remaining,undefined,{signal});
  signal.throwIfAborted();nextStart=Date.now()+6000;
 };
}
