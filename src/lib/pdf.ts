export async function extractPdf(file:File){
 if(file.size>10*1024*1024)throw new Error('O PDF excede 10 MB. Escolha um arquivo menor.');
 if(file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf'))throw new Error('Escolha um arquivo PDF.');
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';
 let pdf;
 const loading=pdfjs.getDocument({data:await file.arrayBuffer()});
 try{pdf=await loading.promise;}
 catch(e){if((e as Error).name==='PasswordException')throw new Error('O PDF está protegido por senha. Use uma cópia desbloqueada.');throw new Error('Não foi possível ler este PDF. Confira se o arquivo é válido.');}
 try{
  if(pdf.numPages>100)throw new Error('O PDF excede 100 páginas. Selecione um trecho menor.');
  let text='',empty=0;
  for(let i=1;i<=pdf.numPages;i++){
   const page=await pdf.getPage(i);const content=await page.getTextContent();
   const line=content.items.map(x=>'str' in x?x.str:'').join(' ').trim();
   if(line.length<20)empty++;
   text+='\n[Página PDF '+i+']\n'+line;
   if(text.length>100000)throw new Error('O texto excede 100 mil caracteres. Selecione um trecho menor.');
  }
  if(empty===pdf.numPages||text.replace(/\[Página PDF \d+\]/g,'').trim().length<60)throw new Error('Este PDF não possui texto utilizável. Documentos digitalizados precisam de OCR, não disponível nesta versão.');
  if(empty>0)throw new Error('O PDF tem '+empty+' página(s) sem texto utilizável. Para evitar uma análise incompleta, envie apenas as páginas textuais ou uma versão com OCR.');
  return {name:file.name,text,pages:pdf.numPages};
 }finally{await loading.destroy();}
}
