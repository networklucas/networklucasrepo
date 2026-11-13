import {emptyWorkspace,parseBackup,portableWorkspace,type Workspace} from './workspace-model';
const DATABASE='bussola-workspace-v1',STORE='workspace',KEY='personal';
type RecordValue={revision:number;workspace:Workspace};
let connection:Promise<IDBDatabase>|undefined;
function database(){return connection??=new Promise<IDBDatabase>((resolve,reject)=>{
 if(typeof indexedDB==='undefined'){reject(Error('Armazenamento local indisponível.'));return;}
 const req=indexedDB.open(DATABASE,1);
 req.onupgradeneeded=()=>req.result.createObjectStore(STORE);
 req.onerror=()=>{connection=undefined;reject(req.error);};
 req.onblocked=()=>{connection=undefined;reject(Error('Feche outras abas da Bússola para abrir o armazenamento.'));};
 req.onsuccess=()=>{const db=req.result;db.onversionchange=()=>{db.close();connection=undefined;};resolve(db);};
});}
export async function readWorkspace():Promise<RecordValue>{const db=await database();return new Promise((resolve,reject)=>{
 const tx=db.transaction(STORE,'readonly'),req=tx.objectStore(STORE).get(KEY);
 let result:RecordValue;
 req.onsuccess=()=>{try{result=req.result?{revision:req.result.revision,workspace:parseBackup(JSON.stringify(req.result.workspace))}:{revision:0,workspace:emptyWorkspace()};}catch(e){reject(e);}};
 tx.oncomplete=()=>{if(result)resolve(result);};tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
});}
export async function writeWorkspace(workspace:Workspace,expectedRevision:number):Promise<number>{
 const snapshot=portableWorkspace(workspace);const db=await database();return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE),req=store.get(KEY);let conflict=false;
  req.onsuccess=()=>{if((req.result?.revision??0)!==expectedRevision){conflict=true;tx.abort();return;}store.put({revision:expectedRevision+1,workspace:snapshot},KEY);};
  tx.oncomplete=()=>resolve(expectedRevision+1);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(conflict?Error('Outra aba alterou os projetos. Exporte este trabalho e recarregue antes de continuar.'):tx.error||Error('Não foi possível salvar.'));
 });
}
