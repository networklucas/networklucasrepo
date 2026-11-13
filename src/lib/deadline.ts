export class DeadlineError extends Error {constructor(){super('REQUEST_TIMEOUT');this.name='DeadlineError';}}
export function withinDeadline<T>(work:()=>Promise<T>,milliseconds:number,signal:AbortSignal,onTimeout:()=>void=()=>{}):Promise<T>{
 return new Promise((resolve,reject)=>{
  if(signal.aborted){reject(signal.reason??new DOMException('Aborted','AbortError'));return;}
  let settled=false;
  const finish=(ok:boolean,value:unknown)=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',cancel);if(ok)resolve(value as T);else reject(value);};
  const cancel=()=>finish(false,signal.reason??new DOMException('Aborted','AbortError'));
  const timer=setTimeout(()=>{finish(false,new DeadlineError());onTimeout();},milliseconds);
  signal.addEventListener('abort',cancel,{once:true});
  Promise.resolve().then(work).then(v=>finish(true,v),e=>finish(false,e));
 });
}
