import {GoogleGenAI} from '@google/genai';
const key=process.env.GEMINI_API_KEY?.trim();
if(!key){console.log('GEMINI_DIAG missing_key');process.exit(0);}
const client=new GoogleGenAI({apiKey:key});
const started=Date.now();
async function bounded(work,ms){let timer;try{return await Promise.race([work(),new Promise((_,reject)=>{timer=setTimeout(()=>{const e=new Error('deadline');e.name='DeadlineError';reject(e);},ms);})]);}finally{clearTimeout(timer);}}
setTimeout(()=>{console.log('GEMINI_DIAG process_deadline');process.exit(0);},65000).unref();
try {
 const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models',{headers:{'x-goog-api-key':key},signal:AbortSignal.timeout(10000)});
 const data=await res.json(); console.log('GEMINI_MODELS',JSON.stringify({status:res.status,models:data.models?.filter(m=>/flash/.test(m.name)&&!/image|audio|tts|live/.test(m.name)).map(m=>({name:m.name,methods:m.supportedGenerationMethods}))}));
}catch(e){console.log('GEMINI_MODELS',JSON.stringify({name:e.name}));}
for(const model of ['gemini-3.7-flash','gemini-3.5-flash-lite']){
 const start=Date.now();let firstMs=null,textLength=0,completed=false;
 try{
  await bounded(async()=>{const stream=await client.interactions.create({model,store:false,stream:true,automatic_continuation:false,input:'Responda apenas OK.',generation_config:{max_output_tokens:256,thinking_level:'low'}},{timeout_ms:20000,signal:AbortSignal.timeout(22000),retries:{strategy:'none'}});
  for await(const e of stream){if(firstMs===null)firstMs=Date.now()-start;if(e.delta?.text)textLength+=e.delta.text.length;if(e.delta?.content?.text)textLength+=e.delta.content.text.length;if(e.event_type==='interaction.completed')completed=e.interaction?.status==='completed';if(e.error)console.log('GEMINI_EVENT_ERROR',JSON.stringify({model,code:e.error.code}));}
  console.log('GEMINI_DIAG',JSON.stringify({model,ms:Date.now()-start,firstMs,textLength,completed}));},12000);
 }catch(e){console.log('GEMINI_DIAG',JSON.stringify({model,ms:Date.now()-start,name:e.name,status:e.status,code:e.code,errorType:e.error?.type,errorCode:e.error?.code}));}
}
console.log('GEMINI_DIAG_TOTAL_MS',Date.now()-started);

for(const model of ['gemini-2.5-flash','gemini-3.8-flash']){const start=Date.now();try{const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent',{method:'POST',headers:{'x-goog-api-key':key,'content-type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts:[{text:'Responda apenas OK.'}]}],generationConfig:{maxOutputTokens:256}}),signal:AbortSignal.timeout(15000)});const data=await res.json();console.log('GEMINI_REST',JSON.stringify({model,status:res.status,ms:Date.now()-start,errorCode:data.error?.status,hasText:!!data.candidates?.some(c=>c.content?.parts?.some(p=>p.text))}));}catch(e){console.log('GEMINI_REST',JSON.stringify({model,ms:Date.now()-start,name:e.name}));}}

process.exit(0);
