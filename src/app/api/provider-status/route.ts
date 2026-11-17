import {budgetStatus} from '@/lib/budget';
import {geminiKeyState} from '@/lib/config';
import {geminiModels} from '@/lib/gemini-rotation';
export const dynamic='force-dynamic';
export async function GET(){const budget=await budgetStatus();const state=geminiKeyState(process.env.GEMINI_API_KEY);let models:string[]=[],configurationError=state==='invalid'?'GEMINI_API_KEY deve conter somente a chave da API, sem código, aspas ou quebras de linha.':undefined;try{models=geminiModels();}catch{configurationError='GEMINI_MODELS deve conter uma sequência compatível de modelos Gemini.';}return Response.json({gemini:{configured:state==='ready'&&!configurationError,state,configurationError,model:models[0],initialModel:models[0],models},openai:{model:process.env.OPENAI_MODEL||'gpt-6.1-sol',...budget},timezone:'America/Sao_Paulo'},{headers:{'Cache-Control':'private, no-store'}});}
