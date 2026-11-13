const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),books=require('../src/data/book-files.json');
const destination=path.join(root,'private-data','books');fs.mkdirSync(destination,{recursive:true});
const partsDirectory=path.join(root,'private-data','book-parts');
const manifestPath=path.join(partsDirectory,'manifest.json');
const manifest=fs.existsSync(manifestPath)?JSON.parse(fs.readFileSync(manifestPath,'utf8')):[];
for(const book of books){
 const source=path.resolve(root,'..','Livros',book.file),target=path.join(destination,book.id+'.pdf');
 if(fs.existsSync(source)&&!process.argv.includes('--from-parts'))fs.copyFileSync(source,target);
 else if(!fs.existsSync(target)||process.argv.includes('--from-parts')){
  const entry=manifest.find(item=>item.id===book.id);if(!entry)throw Error('Partes do PDF privado ausentes: '+book.id);
  const parts=entry.parts.map(name=>{if(!new RegExp('^'+book.id+'\\.\\d{3}\\.part$').test(name))throw Error('Nome de parte inválido.');return fs.readFileSync(path.join(partsDirectory,name));});
  const data=Buffer.concat(parts);if(data.length!==entry.size||crypto.createHash('sha256').update(data).digest('hex')!==entry.sha256)throw Error('Integridade do PDF privado inválida: '+book.id);
  fs.writeFileSync(target,data);
 }
 if(!fs.existsSync(target)||fs.statSync(target).size===0)throw Error('PDF privado ausente: '+book.id);
}
console.log(books.length+' PDFs privados preparados.');
