const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.argv[2]||'playwright');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3103';
const out=path.resolve('artifacts/release-1.2');fs.mkdirSync(out,{recursive:true});
async function main(){
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const checks=[];
 try{
  for(const profile of [{width:1440,theme:'dark',size:'standard'},{width:320,theme:'light',size:'large'}]){
   const context=await browser.newContext({viewport:{width:profile.width,height:1000},reducedMotion:'reduce'});
   try{
    const page=await context.newPage();await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.getByLabel('Tema',{exact:true}).selectOption(profile.theme);await page.getByLabel('Texto',{exact:true}).selectOption(profile.size);
    await page.getByText('6 livros na base',{exact:false}).waitFor();
    const api=await page.request.get(base+'/api/library/search');const metadata=await api.json();
    assert.equal(metadata.books.length,6);assert.equal(metadata.books.reduce((n,b)=>n+b.pages,0),2266);
    const book=metadata.books.find(b=>b.id==='transformacao-digital');assert.ok(book);assert.equal(book.pages,372);
    if(profile.width<=760)await page.getByRole('button',{name:'Abrir navegação'}).click();
    await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Biblioteca'}).click();
    await page.locator('.book-card').nth(5).waitFor();assert.equal(await page.locator('.book-card').count(),6);
    const card=page.locator('.book-card').filter({hasText:'Transformação Digital e Cultura de Produto'});await card.getByRole('button',{name:'Explorar trechos'}).click();
    const result=page.locator('.result-card').filter({hasText:'Transformação Digital e Cultura de Produto'}).first();await result.waitFor();await result.click();
    const dialog=page.getByRole('dialog');assert.match(await dialog.innerText(),/Joaquim Torres/);assert.match(await dialog.innerText(),/PÁGINA PDF/);
    await page.keyboard.press('Escape');
    const footer=page.locator('.app-footer');await footer.scrollIntoViewIfNeeded();
    const footerText=await footer.innerText();assert.match(footerText,/Versão 1\.2/);assert.match(footerText,/09\/11\/2026/);assert.match(footerText,/Transformação Digital e Cultura de Produto/);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    assert.ok(await page.locator('.release-info').evaluate(el=>[...el.querySelectorAll('span,p,time')].every(node=>parseFloat(getComputedStyle(node).fontSize)>=14)));
    await page.screenshot({path:path.join(out,`rodape-${profile.width}.png`)});
    checks.push({...profile,bookCount:6,pages:2266,version:'1.2',newBookSearch:true,footerVisible:true,passed:true});
   }finally{await context.close();}
  }
 }finally{await browser.close();}
 fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify({passed:true,checks,liveModelCalls:0},null,2));console.log(JSON.stringify({passed:true,profiles:checks.length,liveModelCalls:0}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
