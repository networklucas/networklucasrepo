const key=process.env.GEMINI_API_KEY?.trim();
if(!key){console.log('GEMINI_SMOKE missing_key');process.exit(0);}
try{
 const models=await fetch('https://generativelanguage.googleapis.com/v1beta/models',{headers:{'x-goog-api-key':key},signal:AbortSignal.timeout(15000)});
 const catalog=await models.json();
 console.log('GEMINI_MODELS',JSON.stringify({status:models.status,requestedAvailable:catalog.models?.some(m=>m.name==='models/gemini-3.8-flash')}));
 const response=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{method:'POST',headers:{'x-goog-api-key':key,'content-type':'application/json'},body:JSON.stringify({model:'gemini-3.8-flash',input:'Responda apenas OK.',store:false,generation_config:{max_output_tokens:256,thinking_level:'low'}}),signal:AbortSignal.timeout(20000)});
 const body=await response.json();
 console.log('GEMINI_SMOKE',JSON.stringify({status:response.status,interactionStatus:body.status,errorCode:body.error?.status,hasOutput:!!(body.steps?.length||body.outputs?.length)}));
}catch(e){console.log('GEMINI_SMOKE',JSON.stringify({errorType:e.name}));}
