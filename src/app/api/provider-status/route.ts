import {budgetStatus} from '@/lib/budget';
import {geminiKeyState} from '@/lib/config';
export const dynamic='force-dynamic';
export async function GET(){const budget=await budgetStatus();const state=geminiKeyState(process.env.GEMINI_API_KEY);return Response.json({gemini:{configured:state==='ready',state,configurationError:state==='invalid'?'GEMINI_API_KEY deve conter somente a chave da API, sem código, aspas ou quebras de linha.':undefined,model:process.env.GEMINI_MODEL||'gemini-3.5-flash-lite'},openai:{model:process.env.OPENAI_MODEL||'gpt-6.1-sol',...budget},timezone:'America/Sao_Paulo'},{headers:{'Cache-Control':'private, no-store'}});}
