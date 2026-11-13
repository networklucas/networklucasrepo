const key=process.env.GEMINI_API_KEY?.trim();
if(!key){console.log('GEMINI_TRANSPORT missing_key');process.exit(0);}
try{
 const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',{method:'POST',headers:{'x-goog-api-key':key,'content-type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts:[{text:'Responda apenas OK.'}]}],generationConfig:{maxOutputTokens:256,thinkingConfig:{thinkingLevel:'LOW'}}}),signal:AbortSignal.timeout(25000)});
 const data=await res.json();console.log('GEMINI_TRANSPORT',JSON.stringify({transport:'generateContent',status:res.status,errorCode:data.error?.status,hasText:!!data.candidates?.some(c=>c.content?.parts?.some(p=>p.text))}));
}catch(e){console.log('GEMINI_TRANSPORT',JSON.stringify({errorType:e.name}));}
