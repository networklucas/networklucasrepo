/* Browser acceptance checks. Chat responses below are explicit transport fixtures,
   never a substitute for eval:live. Library and concept content use the real app. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.argv[2]||'playwright');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3100';
const out=path.resolve('artifacts/improvements');
fs.mkdirSync(out,{recursive:true});

async function inspect(page){return page.evaluate(()=>{
 const rgba=value=>value.match(/[\d.]+/g)?.map(Number)||[0,0,0,0];
 const blend=(a,b)=>{const alpha=a[3]??1;return a.slice(0,3).map((v,i)=>v*alpha+b[i]*(1-alpha));};
 const bg=el=>{const c=rgba(getComputedStyle(el).backgroundColor);return c[3]===1?c.slice(0,3):blend(c,el.parentElement?bg(el.parentElement):[255,255,255]);};
 const lum=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
 const failures=[];let minimum=100,checked=0;
 for(const el of document.querySelectorAll('.app-shell *')){
  const rect=el.getBoundingClientRect(),style=getComputedStyle(el);
  if(!rect.width||!rect.height||style.visibility==='hidden'||el.closest('[inert]')||rect.right<0||rect.left>innerWidth||el.classList.contains('sr-only')||el.classList.contains('skip-link'))continue;
  if(el.matches('button,input:not([type="file"]),textarea,select')&&(rect.left<-.5||rect.right>innerWidth+.5))failures.push({clippedControl:el.className,left:rect.left,right:rect.right});
  if(![...el.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim()))continue;
  const font=parseFloat(style.fontSize),fg=blend(rgba(style.color),bg(el));const a=lum(fg),b=lum(bg(el));const contrast=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  const needed=font>=24||font>=18.66&&parseInt(style.fontWeight)>=700?3:4.5;
  checked++;minimum=Math.min(minimum,contrast);
  if(font<14-.01||contrast<needed)failures.push({selector:el.className,text:el.textContent.trim().slice(0,70),font,contrast,needed});
 }
 return {checked,minimumContrast:minimum,overflow:document.documentElement.scrollWidth>innerWidth+1,failures};
});}

async function navigate(page,label){
 // Wait for the responsive layout rather than using an instantaneous role snapshot.
 if(page.viewportSize().width<=760){await page.getByRole('button',{name:'Abrir navegação'}).click();await page.locator('.sidebar.is-open').waitFor({state:'visible'});}
 await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:label}).click();
}
async function main(){
 const browser=await chromium.launch({channel:process.env.TEST_BROWSER_CHANNEL||'msedge',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const page=await context.newPage(),errors=[],checks=[],zoomChecks=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error'&&/hydrat|didn.t match/i.test(message.text()))errors.push(message.text());});
 try{
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Aparência',exact:true}).click();await page.getByLabel('Tema',{exact:true}).selectOption('dark');await page.getByLabel('Texto',{exact:true}).selectOption('large');
  await page.reload();await page.getByRole('button',{name:'Aparência',exact:true}).click();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');assert.equal(await page.getByLabel('Texto',{exact:true}).inputValue(),'large');
  assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),['bussola:appearance:v1']);
  for(const width of [1440,720,390,320]){
   console.log('Checking viewport',width);
   await page.setViewportSize({width,height:1000});
   for(const theme of ['light','dark'])for(const size of ['standard','large']){
    await page.getByLabel('Tema',{exact:true}).selectOption(theme);await page.getByLabel('Texto',{exact:true}).selectOption(size);
    for(const [label,view] of [['Conversar','chat'],['Projetos','projects'],['Repertório','repertoire']]){
     await navigate(page,label);await page.locator(view==='chat'?'.welcome':view==='projects'?'.simple-projects':'.repertoire-view').waitFor();
     const inspection=await inspect(page);checks.push({width,theme,size,view,...inspection});
     if(inspection.overflow||inspection.failures.length)throw Error(JSON.stringify(checks.at(-1)));
    }
   }
  }
  // Match the effective CSS viewport and pixel density of 1440x1000 at 200%.
  const zoomContext=await browser.newContext({viewport:{width:720,height:500},deviceScaleFactor:2,reducedMotion:'reduce'});
  try{
   const zoomPage=await zoomContext.newPage();await zoomPage.goto(base,{waitUntil:'domcontentloaded'});await zoomPage.getByRole('button',{name:'Aparência',exact:true}).click();
   for(const theme of ['light','dark'])for(const size of ['standard','large']){
    await zoomPage.getByLabel('Tema',{exact:true}).selectOption(theme);await zoomPage.getByLabel('Texto',{exact:true}).selectOption(size);
    for(const [label,view] of [['Conversar','chat'],['Projetos','projects'],['Repertório','repertoire']]){
     await navigate(zoomPage,label);await zoomPage.locator(view==='chat'?'.welcome':view==='projects'?'.simple-projects':'.repertoire-view').waitFor();
     const inspection=await inspect(zoomPage);assert.equal(inspection.overflow,false);assert.deepEqual(inspection.failures,[]);zoomChecks.push({theme,size,view,...inspection});
    }
   }
  }finally{await zoomContext.close();}
  await page.setViewportSize({width:1440,height:1000});await navigate(page,'Repertório');
  const opener=page.locator('.concept-card').first();await opener.click();await page.getByRole('dialog').waitFor();
  assert.equal(await page.getByRole('button',{name:'Fechar detalhe'}).evaluate(el=>el===document.activeElement),true);
  await page.keyboard.press('Shift+Tab');assert.equal(await page.getByRole('button',{name:'Aplicar ao meu problema'}).evaluate(el=>el===document.activeElement),true);
  await page.keyboard.press('Tab');assert.equal(await page.getByRole('button',{name:'Fechar detalhe'}).evaluate(el=>el===document.activeElement),true);
  const modal=await inspect(page);assert.deepEqual(modal.failures,[]);await page.screenshot({path:path.join(out,'conceito-dark-ampliado.png')});
  await page.keyboard.press('Escape');await page.waitForFunction(()=>document.activeElement?.classList.contains('concept-card'));
  await page.getByLabel('Tema',{exact:true}).selectOption('system');await page.emulateMedia({colorScheme:'dark'});
  assert.equal(await page.locator('html').evaluate(el=>getComputedStyle(el).colorScheme),'dark');await page.emulateMedia({colorScheme:'light'});
  assert.equal(await page.locator('html').evaluate(el=>getComputedStyle(el).colorScheme),'light');
  await page.getByLabel('Tema',{exact:true}).selectOption('dark');await page.getByLabel('Texto',{exact:true}).selectOption('standard');await navigate(page,'Conversar');
  await page.screenshot({path:path.join(out,'inicio-dark-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:1000});await page.getByLabel('Tema',{exact:true}).selectOption('light');await page.getByLabel('Texto',{exact:true}).selectOption('large');
  await page.screenshot({path:path.join(out,'inicio-claro-celular-ampliado.png'),fullPage:true});
  await page.getByRole('button',{name:'Abrir navegação'}).click();await page.getByRole('dialog',{name:'Navegação',exact:true}).waitFor();
  assert.equal(await page.locator('.mobile-close').evaluate(el=>el===document.activeElement),true);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Abrir navegação');
  await page.setViewportSize({width:1440,height:1000});
  // Real local API checks below cannot reach an external provider: they use only
  // invalid requests or a query proven to have zero local retrieval matches.
  const invalid=await page.request.post(base+'/api/chat',{data:{message:'x'}});assert.equal(invalid.status(),400);
  const forbidden=await page.request.post(base+'/api/chat',{headers:{origin:'https://invalid.example'},data:{message:'xyzznotfound123'}});assert.equal(forbidden.status(),403);
  const gap=await page.request.post(base+'/api/chat',{data:{message:'xyzznotfound123',history:[]}});
  const gapEvents=(await gap.text()).trim().split('\n').map(line=>JSON.parse(line));
  assert.equal(gap.status(),200);assert.ok(gapEvents.some(e=>e.type==='done'));assert.ok(!gapEvents.some(e=>e.type==='provider'));assert.ok(gapEvents.some(e=>e.type==='sources'&&e.sources.length===0));
  // Browser-native stream fixture verifies that a draft stays hidden until done.
  await page.evaluate(()=>{
   window.testOriginalFetch=window.fetch;
   window.fetch=(url,...args)=>url==='/api/chat'?Promise.resolve(new Response(new ReadableStream({start(controller){window.testStream=controller;controller.enqueue(new TextEncoder().encode(JSON.stringify({type:'phase',phase:'generating'})+'\n'));}}),{headers:{'Content-Type':'application/x-ndjson'}})):window.testOriginalFetch(url,...args);
  });
  await page.getByLabel('Descreva seu problema de produto').fill('Pergunta da fixture de transmissão');await page.getByRole('button',{name:'Enviar mensagem'}).click();
  await page.getByRole('status').filter({hasText:'Consultando contexto e gerando resposta'}).waitFor();
  await page.evaluate(()=>window.testStream.enqueue(new TextEncoder().encode(JSON.stringify({type:'phase',phase:'validating'})+'\n'+JSON.stringify({type:'delta',text:'Texto da fixture concluída.'})+'\n')));
  await page.getByRole('status').filter({hasText:'Validando a resposta nas fontes'}).waitFor();assert.equal(await page.getByText('Texto da fixture concluída.',{exact:true}).count(),0);
  await page.evaluate(()=>{window.testStream.enqueue(new TextEncoder().encode(JSON.stringify({type:'done'})+'\n'));window.testStream.close();window.fetch=window.testOriginalFetch;delete window.testStream;delete window.testOriginalFetch;});
  await page.getByText('Texto da fixture concluída.',{exact:true}).waitFor();await page.getByRole('button',{name:'Nova conversa'}).click();
  const requests=[];let attempt=0;
  await page.route('**/api/chat',async route=>{
   requests.push(route.request().postDataJSON());attempt++;
   const events=attempt===1?[{type:'phase',phase:'generating'},{type:'error',message:'Falha de transmissão simulada.'}]:[{type:'phase',phase:'generating'},{type:'phase',phase:'validating'},{type:'delta',text:'Resposta validada para teste de transporte.'},{type:'sources',sources:[]},{type:'done'}];
   await route.fulfill({status:200,contentType:'application/x-ndjson',body:events.map(e=>JSON.stringify(e)).join('\n')+'\n'});
  });
  const send=async text=>{await page.getByLabel('Descreva seu problema de produto').fill(text);await page.getByRole('button',{name:'Enviar mensagem'}).click();};
  await send('Como priorizar meu backlog?');await page.getByRole('button',{name:'Tentar novamente'}).click();await page.getByRole('button',{name:'Copiar resposta'}).waitFor();
  assert.equal(await page.locator('.message.user').count(),1);assert.equal(await page.locator('.message.assistant').count(),1);assert.equal(requests[0].message,requests[1].message);assert.deepEqual(requests[1].history,[]);
  await send('Como definir OKRs?');await page.locator('.message.assistant .copy-button').nth(1).waitFor();assert.equal(requests[2].history.length,2);
  await send('Como entrevistar usuários? Como definir posicionamento?');await page.locator('.message.assistant .copy-button').nth(2).waitFor();assert.equal(requests[3].history.length,4);
  // A new question after a failed turn excludes both the failed question and reply.
  await page.route('**/api/chat',route=>route.fulfill({status:200,contentType:'application/x-ndjson',body:JSON.stringify({type:'error',message:'Falha simulada'})+'\n'}));
  await send('Pergunta que falha');await page.getByRole('button',{name:'Tentar novamente'}).waitFor();
  await page.unroute('**/api/chat');
  let afterFailure;
  await page.route('**/api/chat',route=>{afterFailure=route.request().postDataJSON();return route.fulfill({status:200,contentType:'application/x-ndjson',body:JSON.stringify({type:'delta',text:'Concluída.'})+'\n'+JSON.stringify({type:'done'})+'\n'});});
  await send('Nova pergunta independente');await page.locator('.message.assistant .copy-button').nth(3).waitFor();
  assert.equal(afterFailure.history.length,6);assert.ok(!afterFailure.history.some(m=>m.content.includes('Pergunta que falha')));
  await page.reload();assert.equal(await page.locator('.message').count(),0);assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),['bussola:appearance:v1']);
  await page.keyboard.press('Tab');assert.equal(await page.getByRole('link',{name:'Pular para o conteúdo'}).evaluate(el=>el===document.activeElement),true);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify({passed:true,layoutChecks:checks,zoom200EquivalentChecks:zoomChecks,modal,checks:['theme and text persistence','system preference changes','keyboard trap and focus restoration','mobile navigation keyboard','invalid request and origin rejection','real local API abstention without provider','generation and validation status','draft hidden until completion','retry without duplication','complete turn history','two subjects transport','failed turn exclusion','conversation not persisted','skip link'],liveProvider:false},null,2));
  console.log(JSON.stringify({passed:true,layouts:checks.length,zoom200Equivalent:zoomChecks.length,minimumContrast:Math.min(...checks.map(c=>c.minimumContrast)),screenshots:out,liveProvider:false}));
 }finally{await context.close();await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
