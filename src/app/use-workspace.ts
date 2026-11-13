'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {emptyWorkspace,mergeBackup,parseBackup,portableWorkspace,type Project,type Session,type Workspace} from '@/lib/workspace-model';
import {updateLooseSession} from '@/lib/chat-history';
import {readWorkspace,writeWorkspace} from '@/lib/workspace-storage';

export function downloadFile(name:string,content:string,type='text/markdown;charset=utf-8'){
 const url=URL.createObjectURL(new Blob([content],{type}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function useWorkspace(){
 const [workspace,setWorkspace]=useState<Workspace>(emptyWorkspace),[ready,setReady]=useState(false),[status,setStatus]=useState('Abrindo armazenamento…'),[error,setError]=useState('');
 const latest=useRef(workspace);useEffect(()=>{latest.current=workspace;},[workspace]);
 const revision=useRef(0),queue=useRef<Promise<unknown>>(Promise.resolve()),blocked=useRef(false),first=useRef(true),sequence=useRef(0);
 useEffect(()=>{let live=true;readWorkspace().then(value=>{if(!live)return;revision.current=value.revision;setWorkspace(value.workspace);setReady(true);setStatus('Dados locais carregados');}).catch(()=>{if(!live)return;blocked.current=true;setReady(true);setError('Não foi possível abrir os dados locais. Trabalhe nesta aba e exporte um backup antes de sair. Os dados existentes não serão substituídos.');setStatus('Sem salvamento local');});return()=>{live=false;};},[]);
 useEffect(()=>{
  if(!ready)return;if(first.current){first.current=false;return;}
  const run=++sequence.current;setStatus('Salvando…');
  queue.current=queue.current.then(async()=>{if(blocked.current){setStatus('Alterações apenas nesta aba');return;}try{revision.current=await writeWorkspace(workspace,revision.current);if(run===sequence.current)setStatus('Salvo neste navegador · '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}));}catch(e){blocked.current=true;setError((e instanceof Error?e.message:'Falha ao salvar.')+' Exporte um backup para preservar suas alterações.');setStatus('Alterações não salvas');}});
 },[workspace,ready]);
 const updateProject=useCallback((id:string,update:(project:Project)=>Project)=>setWorkspace(w=>({...w,projects:w.projects.map(p=>p.id===id?{...update(p),updatedAt:new Date().toISOString()}:p)})),[]);
 const saveSession=useCallback((projectId:string,sessionId:string,value:Omit<Session,'id'|'createdAt'>)=>{
  setWorkspace(w=>{const p=w.projects.find(p=>p.id===projectId),s=p?.sessions.find(s=>s.id===sessionId);if(!p||!s||JSON.stringify({...s,...value})===JSON.stringify(s))return w;return {...w,projects:w.projects.map(item=>item.id!==projectId?item:{...item,updatedAt:new Date().toISOString(),sessions:item.sessions.map(session=>session.id===sessionId?{...session,...value,updatedAt:new Date().toISOString()}:session)})};});
 },[]);
 const saveLooseSession=useCallback((id:string,value:Omit<Session,'id'|'createdAt'>)=>setWorkspace(w=>updateLooseSession(w,id,value)),[]);
 function backup(){try{downloadFile('bussola-backup.json',JSON.stringify(portableWorkspace(workspace)),'application/json');}catch{setError('O backup completo excede o limite. Exporte os projetos individualmente.');}}
 async function restore(file:File){if(file.size>20*1024*1024)throw Error('Backup acima de 20 MB.');const incoming=parseBackup(await file.text());const merged=portableWorkspace(mergeBackup(latest.current,incoming));setWorkspace(merged);}
 return {workspace,setWorkspace,ready,status,error,updateProject,saveSession,saveLooseSession,backup,restore};
}
