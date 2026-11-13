import {NextRequest} from 'next/server';
import {z} from 'zod';
import {providerFailureMessage} from './provider-failure';
export async function readAiRequest<T>(req:NextRequest,schema:z.ZodType<T>){
 const origin=req.headers.get('origin');if(origin&&origin!==req.nextUrl.origin)throw Error('Origem não permitida.');
 if(Number(req.headers.get('content-length')||0)>800000)throw Error('Conteúdo acima do limite.');
 const raw=await req.text();if(Buffer.byteLength(raw)>800000)throw Error('Conteúdo acima do limite.');return schema.parse(JSON.parse(raw));
}
export function aiError(error:unknown){const code=error instanceof Error?error.message:'';const message=code==='CONFIDENTIAL_BLOCKED'?'Conteúdo confidencial: o envio ao Gemini foi bloqueado. Sol precisa estar disponível.':code==='GEMINI_NOT_CONFIGURED'?'A IA não está configurada neste ambiente.':error instanceof z.ZodError?'Pedido ou resposta inválidos.':/Origem|limite|síntese|trilha|Etapa|proposta|fontes/.test(code)?code:providerFailureMessage(error);return Response.json({error:message},{status:code==='Origem não permitida.'?403:code==='Conteúdo acima do limite.'?413:error instanceof z.ZodError||error instanceof SyntaxError?400:422,headers:{'Cache-Control':'private, no-store'}});}
