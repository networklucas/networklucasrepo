export type FailureKind='rate_limit'|'unavailable'|'timeout'|'incomplete'|'output_limit'|'authentication'|'model_not_found'|'configuration'|'unknown';
export function providerFailure(error:unknown):{kind:FailureKind;status?:number}{
 const e=error as {status?:unknown;statusCode?:unknown;code?:unknown;name?:string;message?:string};
 const raw=e?.status??e?.statusCode;
 const code=typeof e?.code==='string'?e.code:'';
 const mapped=/service_unavailable|UNAVAILABLE/.test(code)?503:/resource_exhausted|RESOURCE_EXHAUSTED|rate_limit_exceeded/.test(code)?429:undefined;
 const status=typeof raw==='number'?raw:mapped;
 const kind:FailureKind=status===429?'rate_limit':status&&[500,502,503,504].includes(status)?'unavailable':status&&[401,403].includes(status)?'authentication':status===404?'model_not_found':code==='OUTPUT_LIMIT'?'output_limit':code==='STREAM_INCOMPLETE'?'incomplete':status===408||/timeout|timed out|REQUEST_TIMEOUT/i.test((e?.name??'')+' '+(e?.message??''))?'timeout':status===400?'configuration':'unknown';
 return {kind,status};
}
export function providerFailureMessage(error:unknown){
 const {kind,status}=providerFailure(error);
 if(kind==='rate_limit')return 'O Gemini informou limite de uso (HTTP 429). Confira os limites do projeto no AI Studio antes de tentar novamente.';
 if(kind==='unavailable')return 'O Gemini está temporariamente indisponível (HTTP '+status+'). Não foi possível concluir após a recuperação automática. Tente novamente em alguns minutos.';
 if(kind==='timeout')return 'O provedor demorou além do prazo de resposta. Tente Ajuda rápida ou aguarde alguns minutos.';
 if(kind==='incomplete')return 'O provedor encerrou a transmissão sem concluir a resposta. A tentativa incompleta foi descartada.';
 if(kind==='output_limit')return 'A resposta excedeu o limite de geração do provedor e foi descartada. Tente uma pergunta mais específica ou use Análise aprofundada.';
 if(kind==='authentication')return 'O provedor recusou a credencial ou a permissão do projeto (HTTP '+status+'). Verifique a configuração na Vercel.';
 if(kind==='model_not_found')return 'O modelo configurado não está disponível nesta API (HTTP 404). Verifique a configuração do modelo.';
 if(kind==='configuration')return 'O provedor rejeitou a configuração do pedido (HTTP 400).';
 return 'Não foi possível concluir a resposta. Tente novamente ou confira a configuração do provedor.';
}
// Retry once only for short-lived server failures before any answer text.
// Rate limits, timeouts, authentication and partial answers are never replayed.
export async function retryTransient<T>(run:(onText:(text:string)=>void)=>Promise<T>,options:{signal:AbortSignal;onText:(text:string)=>void;onRetry:()=>void;wait?:(ms:number,signal:AbortSignal)=>Promise<void>;now?:()=>number}):Promise<T>{
 if(options.signal.aborted)throw new DOMException('Aborted','AbortError');
 const now=options.now??Date.now;const started=now();let hasText=false;
 const text=(value:string)=>{if(value)hasText=true;options.onText(value);};
 try{return await run(text);}catch(error){
  const {kind,status}=providerFailure(error);
  if(options.signal.aborted||hasText||kind!=='unavailable'||status===504||now()-started>20000)throw error;
  options.onRetry();
  const wait=options.wait??(async(ms:number,signal:AbortSignal)=>{const {setTimeout}=await import('node:timers/promises');await setTimeout(ms,undefined,{signal});});
  await wait(1000+Math.floor(Math.random()*500),options.signal);
  if(options.signal.aborted)throw new DOMException('Aborted','AbortError');
  return run(text);
 }
}
