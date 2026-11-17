export type FailureKind='rate_limit'|'unavailable'|'timeout'|'incomplete'|'output_limit'|'authentication'|'model_not_found'|'configuration'|'cancelled'|'unknown';
export type QuotaDimension='minute'|'daily'|undefined;
type FailureSource={status?:unknown;statusCode?:unknown;code?:unknown;name?:unknown;message?:unknown;headers?:unknown;retryAfter?:unknown;retry_after?:unknown;retryInfo?:unknown;retry_info?:unknown;quotaFailure?:unknown;quota_failure?:unknown;error?:unknown;response?:unknown;details?:unknown};
function sources(error:unknown):FailureSource[]{const root=error as FailureSource;return [root,root?.error,root?.response,root?.details].filter((x):x is FailureSource=>!!x);}
function header(source:FailureSource,name:string){const value=source.headers;return value instanceof Headers?value.get(name):value&&typeof value==='object'?((value as Record<string,unknown>)[name]??(value as Record<string,unknown>)[name.toLowerCase()]):undefined;}
function retryAfterMs(items:FailureSource[]){for(const item of items){const value=item.retryAfter??item.retry_after??header(item,'retry-after');const seconds=typeof value==='number'?value:typeof value==='string'?Number(value):NaN;if(Number.isFinite(seconds)&&seconds>0)return Math.ceil(seconds*1000);}return undefined;}
function quota(items:FailureSource[]):QuotaDimension{const text=items.map(item=>JSON.stringify({message:item.message,retryInfo:item.retryInfo??item.retry_info,quotaFailure:item.quotaFailure??item.quota_failure,details:item.details})).join(' ');return /daily|per[ _-]?day|requests?[ _-]?per[ _-]?day|\brpd\b/i.test(text)?'daily':/per[ _-]?(minute|min)|\brpm\b|rate/i.test(text)?'minute':undefined;}
export function providerFailure(error:unknown):{kind:FailureKind;status?:number;retryAfterMs?:number;quota:QuotaDimension}{
 const items=sources(error);const first=items[0]??{};const raw=items.map(item=>item.status??item.statusCode).find(value=>typeof value==='number');const code=items.map(item=>typeof item.code==='string'?item.code:'').join(' ');const message=items.map(item=>String(item.message??'')).join(' ');const mapped=/service_unavailable|UNAVAILABLE/i.test(code)?503:/resource_exhausted|RESOURCE_EXHAUSTED|rate_limit_exceeded/i.test(code)?429:undefined;const status=typeof raw==='number'?raw:mapped;const isCancelled=first.name==='AbortError'||/abort|cancelled/i.test(code+' '+message);const kind:FailureKind=isCancelled?'cancelled':status===429?'rate_limit':status&&[500,502,503,504].includes(status)?'unavailable':status&&[401,403].includes(status)?'authentication':status===404?'model_not_found':code.includes('OUTPUT_LIMIT')?'output_limit':code.includes('STREAM_INCOMPLETE')?'incomplete':status===408||/timeout|timed out|REQUEST_TIMEOUT/i.test(String(first.name??'')+' '+message)?'timeout':status===400?'configuration':'unknown';return {kind,status,retryAfterMs:retryAfterMs(items),quota:kind==='rate_limit'?quota(items):undefined};
}
export function providerFailureMessage(error:unknown){
 const {kind,status,quota}=providerFailure(error);
 if(kind==='rate_limit')return quota==='daily'?'O Gemini informou que a cota diária foi esgotada. Tente após a renovação informada pelo provedor.':'O Gemini informou limite de uso (HTTP 429). Confira os limites do projeto no AI Studio antes de tentar novamente.';
 if(kind==='unavailable')return 'O Gemini está temporariamente indisponível (HTTP '+status+'). Não foi possível concluir após a recuperação automática. Tente novamente em alguns minutos.';
 if(kind==='timeout')return 'O provedor demorou além do prazo de resposta. Tente Ajuda rápida ou aguarde alguns minutos.';
 if(kind==='incomplete')return 'O provedor encerrou a transmissão sem concluir a resposta. A tentativa incompleta foi descartada.';
 if(kind==='output_limit')return 'A resposta excedeu o limite de geração do provedor e foi descartada. Tente uma pergunta mais específica ou use Análise aprofundada.';
 if(kind==='authentication')return 'O provedor recusou a credencial ou a permissão do projeto (HTTP '+status+'). Verifique a configuração na Vercel.';
 if(kind==='model_not_found')return 'O modelo configurado não está disponível nesta API (HTTP 404). Verifique a configuração do modelo.';
 if(kind==='configuration')return 'O provedor rejeitou a configuração do pedido (HTTP 400).';
 if(kind==='cancelled')return 'A solicitação foi cancelada.';
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
