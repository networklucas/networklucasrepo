'use client';
import {useEffect,useRef,useState} from 'react';
import {History,ArrowDown,ArrowRight,ArrowUp,BookOpen,Check,ChevronRight,Compass,Copy,FileText,Layers3,Library,LoaderCircle,LockKeyhole,MessageSquare,Paperclip,Plus,Search,ShieldCheck,Sparkles,Square,X,Menu,ExternalLink,AlertCircle} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type {Concept,Book,Source,ChatEvent,Message} from '@/lib/types';
import {extractPdf} from '@/lib/pdf';
import {completedHistory} from '@/lib/conversation';
import {Appearance} from './appearance';
import {DetailDialog} from './detail-dialog';
import {release} from '@/lib/release';
import {Projects} from './projects';
import {Repertoire} from './repertoire';
import {useWorkspace} from './use-workspace';
import {conceptGuidance} from '@/lib/concept-guidance';
import {newProject,newSession,decisionDraft,type Project,type Session,type SavedReply,type RequestSnapshot} from '@/lib/workspace-model';
import {ProblemPaths} from './problem-paths';
import type {ProblemPath} from '@/lib/problem-path';
import {memoryBatch,projectConfidential,sharedProjectContext} from '@/lib/project-memory';
import {bookPdfUrl} from '@/lib/book-files';
import {ChatHistory} from './chat-history';
import {conversationHistory,type HistoryEntry} from '@/lib/chat-history';
type Tab='projects'|'chat'|'paths'|'repertoire'|'history';
type Reply=SavedReply;
type Status={gemini:{configured:boolean;model:string;configurationError?:string};openai:{enabled:boolean;available:boolean;model:string;dailyBudget:number;used:number|null;day:string}};
export default function Home(){
 const [tab,setTab]=useState<Tab>('chat'),[mobile,setMobile]=useState(false),[mode,setMode]=useState<'quick'|'deep'>('quick'),[confidential,setConfidential]=useState(false);
 const [messages,setMessages]=useState<Reply[]>([]),[input,setInput]=useState(''),[busy,setBusy]=useState(false),[pdfBusy,setPdfBusy]=useState(false),[notice,setNotice]=useState(''),[status,setStatus]=useState<Status|null>(null);
 const [attachment,setAttachment]=useState<{name:string;text:string;pages:number}|undefined>();
 const [selected,setSelected]=useState<Concept|null>(null);
 const [books,setBooks]=useState<Book[]>([]);
 const [copied,setCopied]=useState(''),[sourceModal,setSourceModal]=useState<Source|null>(null);
 const local=useWorkspace();
 const [projectId,setProjectId]=useState<string>(),[sessionId,setSessionId]=useState<string>(),[contextSummary,setContextSummary]=useState(''),[keepAttachment,setKeepAttachment]=useState(false);
 const project=local.workspace.projects.find(p=>p.id===projectId);
 const historyEntries=conversationHistory(local.workspace);
 const activeHistoryKey=sessionId?(projectId?'project:'+projectId+':'+sessionId:'chat:'+sessionId):undefined;
 const [activePathId,setActivePathId]=useState<string>(),[memoryFailed,setMemoryFailed]=useState(false),[memoryBusy,setMemoryBusy]=useState(false),[settings,setSettings]=useState(false);
 const workspaceRef=useRef(local.workspace);useEffect(()=>{workspaceRef.current=local.workspace;},[local.workspace]);
 async function prepareProject(initial:Project,signal:AbortSignal):Promise<Project>{
  const baseline=initial.memory.text;let working=initial;
  for(let round=0;round<5;round++){
   const batch=memoryBatch(working);if(!batch.pending)break;if(!batch.turns.length)throw Error('Revise a memória do projeto: uma conversa excede o limite de síntese.');
   const response=await fetch('/api/project-memory',{method:'POST',headers:{'Content-Type':'application/json'},signal,body:JSON.stringify({confidential:projectConfidential(working),turns:batch.turns})});const data=await response.json();if(!response.ok)throw Error(data.error||'Não foi possível atualizar o contexto.');
   if(typeof data.summary!=='string'||!Array.isArray(data.coveredIds)||data.coveredIds.length!==batch.turns.length||!batch.turns.every(t=>data.coveredIds.includes(t.id)))throw Error('A atualização da memória retornou dados inválidos.');
   const text=[working.memory.text,data.summary].filter(Boolean).join('\n\n');if(text.length>14000)throw Error('A memória está cheia. Revise e compacte o texto em Contexto do projeto.');
   working={...working,memory:{text,coveredIds:[...working.memory.coveredIds,...data.coveredIds],updatedAt:new Date().toISOString()}};
  }
  if(memoryBatch(working).pending)throw Error('Há muitas conversas pendentes. Revise o contexto do projeto antes de continuar.');
  const current=workspaceRef.current.projects.find(p=>p.id===initial.id);if(!current||current.memory.text!==baseline)throw Error('O contexto foi editado durante a atualização. Tente novamente.');
  if(working.memory!==initial.memory)local.updateProject(initial.id,p=>({...p,memory:working.memory}));return working;
 }
 function savePath(path:ProblemPath,owner?:string){local.setWorkspace(w=>({...w,trails:owner?w.trails.filter(t=>t.id!==path.id):[...w.trails.filter(t=>t.id!==path.id),path],projects:w.projects.map(p=>({...p,trails:p.id===owner?[...p.trails.filter(t=>t.id!==path.id),path]:p.trails.filter(t=>t.id!==path.id)}))}));}
 function makePathProject(path:ProblemPath){const p=newProject();p.name=path.plan?.title||path.problem.slice(0,120);p.objective=path.outcome||path.problem;p.trails=[path];local.setWorkspace(w=>({...w,projects:[...w.projects,p],trails:w.trails.filter(t=>t.id!==path.id)}));loadSession(p);navigate('projects');}
 useEffect(()=>{if(!sessionId)return;const value={messages:messages.map(m=>({...m,request:undefined})),draft:input,context:contextSummary,includeContext:true,confidential,attachment:keepAttachment?attachment:undefined};if(projectId)local.saveSession(projectId,sessionId,value);else local.saveLooseSession(sessionId,value);},[messages,input,contextSummary,confidential,attachment,keepAttachment,projectId,sessionId,local.saveSession,local.saveLooseSession]);
 function loadSession(p:Project,session?:Session){
  reset();const target=session??p.sessions.at(-1);setProjectId(p.id);setSessionId(target?.id);setMessages((target?.messages??[]).map(m=>m.role==='assistant'&&!m.completed&&!m.error?{...m,error:true,content:'Geração interrompida ao sair. Envie novamente a pergunta.'}:m));setInput(target?.draft??'');setContextSummary(target?.context??'');setConfidential(target?.confidential??false);setAttachment(target?.attachment);setKeepAttachment(!!target?.attachment);setMemoryFailed(false);
 }
 function openHistory(entry:HistoryEntry){if(entry.projectId){const owner=local.workspace.projects.find(p=>p.id===entry.projectId);if(!owner)return;loadSession(owner,entry.session);}else{reset();setProjectId(undefined);setSessionId(entry.session.id);setMessages(entry.session.messages.map(m=>m.role==='assistant'&&!m.completed&&!m.error?{...m,error:true,content:'Geração interrompida ao sair. Envie novamente a pergunta.'}:m));setInput(entry.session.draft);setContextSummary('');setConfidential(entry.session.confidential);setAttachment(entry.session.attachment);setKeepAttachment(!!entry.session.attachment);}navigate('chat');}
 function deleteLooseChat(id:string){local.setWorkspace(w=>({...w,chats:(w.chats||[]).filter(s=>s.id!==id)}));if(!projectId&&sessionId===id){reset();setSessionId(undefined);}}
 function createProject(name:string,objective:string){const p=newProject();p.name=name;p.objective=objective;local.setWorkspace(w=>({...w,projects:[...w.projects,p]}));loadSession(p);navigate('chat');}
 function selectProject(p:Project,session?:Session){loadSession(p,session);navigate(session?'chat':'projects');}
 function startSession(p:Project){if(p.sessions.length>=200){setNotice('Limite de conversas atingido. Exporte o projeto para preservar seus dados.');return;}const session=newSession();local.updateProject(p.id,value=>({...value,sessions:[...value.sessions,session]}));loadSession(p,session);navigate('chat');}
 function looseChat(){reset();setProjectId(undefined);setSessionId(undefined);setContextSummary('');navigate('chat');}
 function applyToChat(text:string){setInput(text);navigate('chat');setTimeout(()=>textRef.current?.focus(),50);}
 const requestVersion=useRef(0);
 const detailOpener=useRef<HTMLElement|null>(null);
 const menuRef=useRef<HTMLButtonElement>(null),menuCloseRef=useRef<HTMLButtonElement>(null);
 const ctrl=useRef<AbortController|null>(null),fileRef=useRef<HTMLInputElement>(null),textRef=useRef<HTMLTextAreaElement>(null),bottom=useRef<HTMLDivElement>(null);
 useEffect(()=>{fetch('/api/provider-status').then(r=>r.json()).then(d=>{setStatus(d);if(d.gemini?.configurationError)setNotice(d.gemini.configurationError);}).catch(()=>{});fetch('/api/library/search').then(r=>r.json()).then(d=>setBooks(d.books)).catch(()=>setNotice('Não foi possível carregar a biblioteca.'));return()=>ctrl.current?.abort();},[]);
 useEffect(()=>{bottom.current?.scrollIntoView({behavior:busy||window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'end'});},[messages,busy]);
 useEffect(()=>{const close=(e:KeyboardEvent)=>{if(e.key==='Escape'){setSourceModal(null);setSelected(null);setMobile(false);}};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[]);
 useEffect(()=>{if(!mobile)return;const opener=menuRef.current;menuCloseRef.current?.focus();return()=>{requestAnimationFrame(()=>opener?.focus());};},[mobile]);
 function navigate(next:Tab){setTab(next);setSelected(null);setMobile(false);}
 function reset(){requestVersion.current++;ctrl.current?.abort();setMessages([]);setInput('');setAttachment(undefined);setNotice('');setBusy(false);setConfidential(false);setKeepAttachment(false);}
 function useConcept(c:Concept){setInput('Use '+c.title+' para me ajudar com este problema: ');setTab('chat');setSelected(null);setTimeout(()=>textRef.current?.focus(),50);}
 async function attach(file?:File){if(!file)return;setPdfBusy(true);setNotice('');try{setKeepAttachment(false);setAttachment(await extractPdf(file));}catch(e){setNotice((e as Error).message);}finally{setPdfBusy(false);if(fileRef.current)fileRef.current.value='';}}
 async function copy(m:Reply){try{await navigator.clipboard.writeText(m.content);setCopied(m.id);setTimeout(()=>setCopied(''),2000);}catch{setNotice('Não foi possível copiar. Selecione o texto e copie manualmente.');}}
 async function send(retryId?:string,usePreviousMemory=false){
  const retry=retryId?messages.find(m=>m.id===retryId&&m.error):undefined;
  let request:RequestSnapshot=retry?.request??{message:input.trim(),mode,confidential:confidential||!!project&&projectConfidential(project),attachment};
  if(!local.ready||busy||pdfBusy||request.message.length<2||retryId&&!retry)return;
  if(request.confidential&&!status?.openai.available){setNotice('Sessão confidencial: o Gemini gratuito não recebe este conteúdo. O Sol precisa estar ativado e com orçamento disponível.');return;}
  const history=completedHistory(retry?messages.slice(0,messages.indexOf(retry)-1):messages).slice(-12);
  while(history.length&&history.reduce((n,m)=>n+m.content.length,0)>40000)history.splice(0,2);

  const version=++requestVersion.current;const abort=new AbortController();ctrl.current=abort;setBusy(true);setNotice('');setMemoryFailed(false);
  try{
   if(project&&!retry?.request){let prepared=project;if(!usePreviousMemory){setMemoryBusy(true);try{prepared=await prepareProject(project,abort.signal);}catch(e){setMemoryFailed(true);throw e;}finally{setMemoryBusy(false);}}request={...request,context:{project:prepared.name,summary:sharedProjectContext(prepared)}};}
  }catch(e){if(version===requestVersion.current&&!abort.signal.aborted){setNotice(e instanceof Error?e.message:'Não foi possível atualizar o contexto.');setBusy(false);}return;}
  if(version!==requestVersion.current)return;
  if(!project&&!sessionId){if((local.workspace.chats?.length??0)>=500){setNotice('O histórico atingiu o limite. Exporte um backup e exclua conversas que não precisa manter.');setBusy(false);return;}const session=newSession();session.title=request.message.replace(/\s+/g,' ').slice(0,100);local.setWorkspace(w=>({...w,chats:[...(w.chats||[]),session]}));setSessionId(session.id);}
  const id=retry?.id??crypto.randomUUID();if(!retry)setInput('');setNotice('');setBusy(true);
  const reply:Reply={id,role:'assistant',content:'',completed:false,phase:'generating',confidential:request.confidential,request};
  setMessages(prev=>retry?prev.map(m=>m.id===id?reply:m):[...prev,{id:crypto.randomUUID(),role:'user',content:request.message,confidential:request.confidential},reply]);

  let successful=false;
  function update(fn:(m:Reply)=>Reply){if(version!==requestVersion.current)return;setMessages(prev=>prev.map(m=>m.id===id?fn(m):m));}
  try{
   const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...request,history}),signal:abort.signal});
   if(!res.ok){const data=await res.json();throw Error(data.error||'Não foi possível enviar.');}
   if(!res.body)throw Error('Resposta vazia.');
   const reader=res.body.getReader(),decoder=new TextDecoder();let pending='';
   const handle=(e:ChatEvent)=>{if(e.type==='phase')update(m=>({...m,phase:e.phase}));if(e.type==='delta')update(m=>({...m,content:m.content+e.text}));if(e.type==='provider'){update(m=>({...m,provider:e.provider}));setNotice(e.reason);}if(e.type==='reset')update(m=>({...m,content:'',sources:[]}));if(e.type==='sources')update(m=>({...m,sources:e.sources}));if(e.type==='error')throw Error(e.message);if(e.type==='done')successful=true;};
   while(true){const {done,value}=await reader.read();if(done)break;pending+=decoder.decode(value,{stream:true});let index;while((index=pending.indexOf('\n'))!==-1){const line=pending.slice(0,index);pending=pending.slice(index+1);if(line.trim())handle(JSON.parse(line));}}
   if(pending.trim())handle(JSON.parse(pending));
   if(!successful)throw Error('A conexão terminou antes de concluir. Tente novamente.');
   update(m=>({...m,completed:true,request:undefined}));
  }catch(e){const stopped=abort.signal.aborted;update(m=>({...m,error:true,completed:false,sources:[],content:stopped?'Resposta interrompida.':(e as Error).message}));}
  finally{if(version===requestVersion.current){setBusy(false);ctrl.current=null;}fetch('/api/provider-status').then(r=>r.json()).then(setStatus).catch(()=>{});}
 }
 const activeModel=status?.openai.available?'GPT-6.1 Sol':status?.gemini.configured?status.gemini.model:'Conectar IA';
 return <div className="app-shell">
  <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
  {mobile&&<button className="sidebar-overlay" onClick={()=>setMobile(false)} aria-label="Fechar navegação"/>}
  <aside id="navigation" role={mobile?'dialog':undefined} aria-modal={mobile?true:undefined} aria-label={mobile?'Navegação':undefined} inert={!!(selected||sourceModal)} className={'sidebar '+(mobile?'is-open':'')} onKeyDown={e=>{if(mobile&&e.key==='Tab'){const nodes=e.currentTarget.querySelectorAll<HTMLElement>('a[href],button:not(:disabled)');const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}>
   <button className="mobile-close" ref={menuCloseRef} onClick={()=>setMobile(false)} aria-label="Fechar navegação"><X size={20}/></button>
   <a className="brand" href="/" aria-label="Bússola de Produto, início"><span className="brand-mark"><Compass size={25} strokeWidth={1.5}/></span><span>Bússola<span className="brand-sub">DE PRODUTO</span></span></a>
   <button className="new-chat" onClick={()=>{if(project)startSession(project);else looseChat();}}><Plus size={17}/> Nova conversa</button>

   <nav aria-label="Principal">
    <button aria-current={tab==='chat'?'page':undefined} className={tab==='chat'?'active':''} onClick={()=>navigate('chat')}><MessageSquare size={18}/>Conversar</button>
    <button aria-current={tab==='history'?'page':undefined} className={tab==='history'?'active':''} onClick={()=>navigate('history')}><History size={18}/>Histórico</button>
    <button aria-current={tab==='projects'?'page':undefined} className={tab==='projects'?'active':''} onClick={()=>navigate('projects')}><Compass size={18}/>Projetos</button>
    <button aria-current={tab==='paths'?'page':undefined} className={tab==='paths'?'active':''} onClick={()=>navigate('paths')}><Layers3 size={18}/>Trilha de resolução de problemas</button>
    <button aria-current={tab==='repertoire'?'page':undefined} className={tab==='repertoire'?'active':''} onClick={()=>navigate('repertoire')}><BookOpen size={18}/>Repertório</button>
   </nav>
   <div className="sidebar-projects">{local.workspace.projects.slice(0,12).map(p=><button key={p.id} aria-current={p.id===projectId?'true':undefined} onClick={()=>selectProject(p)}>{p.name}</button>)}</div><section className="sidebar-history" aria-label="Conversas recentes"><button className="sidebar-history-heading" onClick={()=>navigate('history')}>Conversas recentes</button>{historyEntries.slice(0,8).map(entry=><button key={entry.key} title={entry.title} aria-current={entry.key===activeHistoryKey&&tab==='chat'?'true':undefined} onClick={()=>openHistory(entry)}><span>{entry.title}</span>{entry.projectName&&<small>{entry.projectName}</small>}</button>)}</section><div className="sidebar-bottom"><button className="text-button" onClick={looseChat}>Conversa avulsa</button><p className="subtle">Projetos salvos neste navegador.</p></div>
  </aside>
  <div className="main-shell" inert={!!(selected||sourceModal)||mobile}>
   <header className="topbar"><div className="breadcrumb"><button ref={menuRef} className="mobile-toggle" onClick={()=>setMobile(true)} aria-label="Abrir navegação" aria-expanded={mobile} aria-controls="navigation"><Menu size={20}/></button><strong>{tab==='chat'?(project?.name||'Conversar'):tab==='projects'?'Projetos':tab==='paths'?'Trilha de resolução de problemas':tab==='history'?'Histórico':'Repertório'}</strong></div>
    <div className="topbar-right"><button className="outline-button" aria-expanded={settings} onClick={()=>setSettings(!settings)}>Aparência</button>{settings&&<Appearance/>}</div>
   </header>
   <main id="main-content" tabIndex={-1}>{local.error&&tab!=='projects'&&<div className="notice" role="alert">{local.error}<button className="text-button" onClick={local.backup}>Exportar backup</button></div>}
    {tab==='history'&&<ChatHistory entries={historyEntries} activeKey={activeHistoryKey} ready={local.ready} onOpen={openHistory} onDelete={deleteLooseChat}/>}
    {tab==='projects'&&<Projects workspace={local.workspace} project={project} ready={local.ready} status={local.status} error={local.error} onCreate={createProject} onSelect={selectProject} onUpdate={local.updateProject} onBackup={local.backup} onRestore={local.restore} onBack={()=>{reset();setProjectId(undefined);setSessionId(undefined);}} onNewSession={startSession} onPath={id=>{setActivePathId(id);navigate('paths');}} onDelete={id=>{local.setWorkspace(w=>({...w,projects:id?w.projects.filter(p=>p.id!==id):[],trails:id?w.trails:[],chats:id?w.chats:[]}));if(!id||id===projectId){reset();setProjectId(undefined);setSessionId(undefined);}}}/>}
    {tab==='paths'&&<ProblemPaths ready={local.ready} workspace={local.workspace} activeId={activePathId} defaultProjectId={projectId} onSelect={setActivePathId} onSave={savePath} onMakeProject={makePathProject} prepareProject={prepareProject}/>}
    {tab==='repertoire'&&<Repertoire books={books} onConcept={(c,el)=>{detailOpener.current=el;setSelected(c);}} onSource={(source,el)=>{detailOpener.current=el;setSourceModal(source);}} onApply={applyToChat}/>} 
    {tab==='chat'&&<div className={'chat-view '+(messages.length?'has-messages':'')}>
     {!messages.length?<div className="welcome minimal-welcome"><Compass size={32} strokeWidth={1.3}/><h1>{project?'Nova conversa':'Bússola de Produto'}</h1>{project&&<p className="intro">{project.objective||'Defina o objetivo em Contexto do projeto.'}</p>}</div>:<div className="conversation" role="log" aria-label="Conversa com o copiloto">{messages.map(m=><article key={m.id} className={'message '+m.role+(m.error?' has-error':'')}>
       <div className="message-avatar">{m.role==='assistant'?<Compass size={18}/>:<span>EU</span>}</div>
       <div className="message-body"><div className="message-label">{m.role==='assistant'?'Bússola':'Você'}{m.provider&&<span>{m.provider}</span>}</div>
       {m.content&&(m.completed||m.error||m.role==='user')?<div className="prose"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown></div>:<div className="thinking" role="status"><LoaderCircle size={15} className="spin"/>{m.phase==='validating'?'Validando a resposta nas fontes…':'Consultando contexto e gerando resposta…'}</div>}
       {!!m.sources?.length&&<details className="sources"><summary><Library size={14}/>Fontes utilizadas <span>{m.sources.length}</span></summary><div className="source-list">{m.sources.map(s=><button key={s.id} onClick={e=>{detailOpener.current=e.currentTarget;setSourceModal(s);}}><span>{s.id}</span><div>{s.title}<small>{s.kind==='book'?'Página PDF '+s.page:s.kind==='editorial'?'Síntese editorial':'Referência de conceito'}</small></div><ExternalLink size={13}/></button>)}</div></details>}
       {m.role==='assistant'&&m.completed&&<button className="copy-button" onClick={()=>copy(m)}>{copied===m.id?<Check size={13}/>:<Copy size={13}/>} {copied===m.id?'Copiado':'Copiar resposta'}</button>}
       {project&&m.role==='assistant'&&m.completed&&<button className="copy-button" onClick={()=>{local.updateProject(project.id,p=>({...p,decisions:[...p.decisions,decisionDraft({...p,sessions:[{...p.sessions.find(s=>s.id===sessionId)!,messages:[m]}]})]}));setNotice('Proposta salva em Resultados do projeto.');}}>Salvar resultado</button>}
       {m.error&&m.request&&m.id===messages.at(-1)?.id&&<button className="retry-button" disabled={busy} onClick={()=>void send(m.id)}>Tentar novamente</button>}
       </div>
      </article>)}<div ref={bottom}/></div>}
     <div className="composer-area">
      {project&&<div className="session-project-bar"><span className="subtle">Contexto compartilhado · {project.name}</span><button className="text-button" onClick={()=>navigate('projects')}>Contexto do projeto</button></div>}
      {memoryBusy&&<p className="subtle" role="status">Atualizando contexto do projeto…</p>}
      {memoryFailed&&<div className="project-toolbar"><button className="outline-button" disabled={busy} onClick={()=>void send()}>Tentar atualizar novamente</button><button className="outline-button" disabled={busy} onClick={()=>void send(undefined,true)}>Continuar com memória anterior</button></div>}

      {notice&&<div className="notice" role="status"><AlertCircle size={14}/><span>{notice}</span><button onClick={()=>setNotice('')} aria-label="Fechar aviso"><X size={13}/></button></div>}
      <div className="composer">
       <label htmlFor="problem" className="sr-only">Descreva seu problema de produto</label>
       <textarea id="problem" ref={textRef} value={input} onChange={e=>setInput(e.target.value)} maxLength={12000} placeholder="Qual decisão de produto está na sua mesa hoje?" onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send();}}}/>
       {attachment&&<div className="attachment"><FileText size={14}/><span>{attachment.name} · {attachment.pages} pág.</span>{<label className="confirmation"><input type="checkbox" checked={keepAttachment} disabled={busy} onChange={e=>setKeepAttachment(e.target.checked)}/>Guardar texto nesta conversa</label>}<button onClick={()=>setAttachment(undefined)} aria-label="Remover PDF"><X size={13}/></button></div>}
       <div className="composer-toolbar"><div className="composer-tools"><button className="attach-button" disabled={busy||pdfBusy} onClick={()=>fileRef.current?.click()} aria-label="Anexar PDF" title="PDF textual, até 10 MB e 100 páginas">{pdfBusy?<LoaderCircle size={18} className="spin"/>:<Paperclip size={18}/>}</button><input type="file" accept=".pdf,application/pdf" ref={fileRef} hidden onChange={e=>void attach(e.target.files?.[0])}/><span className="toolbar-divider"/><div className="mode-switch" aria-label="Profundidade"><button aria-pressed={mode==='quick'} className={mode==='quick'?'selected':''} onClick={()=>setMode('quick')}>Ajuda rápida</button><button aria-pressed={mode==='deep'} className={mode==='deep'?'selected':''} onClick={()=>setMode('deep')}>Análise aprofundada</button></div></div><button className={'send-button '+(busy?'stop':'')} disabled={!busy&&(!local.ready||input.trim().length<2||pdfBusy)} onClick={()=>busy?ctrl.current?.abort():void send()} aria-label={busy?'Interromper resposta':'Enviar mensagem'}>{busy?<Square size={15}/>:<ArrowUp size={19}/>}</button></div>
      </div>
      <div className="composer-footer"><label className="confidential"><input type="checkbox" checked={confidential||!!project&&projectConfidential(project)} disabled={busy||!!project&&projectConfidential(project)} onChange={e=>setConfidential(e.target.checked)}/><LockKeyhole size={12}/>Sessão confidencial</label><span>Enter para enviar <span className="footer-dot">·</span> Shift + Enter para nova linha</span></div>
      <p className="privacy-caption">O contexto selecionado é enviado à IA. Conteúdo confidencial exige Sol.</p>
     </div>
    </div>}

   </main>
   <footer className="app-footer"><span>Bússola de Produto</span><span>Versão {release.version}</span></footer>
  </div>
  {(selected||sourceModal)&&<DetailDialog opener={detailOpener.current} title={selected?.title??sourceModal?.title??'Detalhes'} onClose={()=>{setSelected(null);setSourceModal(null);}}>
   {selected?<><span className="eyebrow">{selected.category}</span><h2>{selected.title}</h2><p className="modal-intro">{selected.summary}</p><h3>Quando usar</h3><p>{selected.when}</p><h3>Como aplicar</h3><ol>{selected.steps.map(s=><li key={s}>{s}</li>)}</ol><div className="limitation"><AlertCircle size={17}/><div><strong>Cuidado com a aplicação</strong><p>{selected.limit}</p></div></div>{conceptGuidance(selected)&&<div className="concept-guidance"><h3>Dados necessários</h3><p>{conceptGuidance(selected)!.inputs}</p><h3>Erro comum</h3><p>{conceptGuidance(selected)!.mistake}</p><h3>Resultado esperado</h3><p>{conceptGuidance(selected)!.output}</p><h3>Exemplo comentado pela Bússola</h3><p>{conceptGuidance(selected)!.example}</p></div>}<h3>Na prática</h3><p>{selected.example}</p><button className="primary-button" onClick={()=>useConcept(selected)}>Aplicar ao meu problema <ArrowRight size={16}/></button><p className="attribution">Fonte: Product Guru’s · PM Especialista · {selected.reference}</p></>:sourceModal&&<><span className="eyebrow">{sourceModal.kind==='book'?'LIVRO · PÁGINA PDF '+sourceModal.page:sourceModal.kind==='editorial'?'SÍNTESE EDITORIAL':'REFERÊNCIA DE CONCEITO'}</span><h2>{sourceModal.title}</h2>{sourceModal.author&&<p className="source-author">{sourceModal.author}</p>}{sourceModal.chapter&&<p className="source-author">{sourceModal.chapter}</p>}<blockquote>{sourceModal.excerpt}</blockquote>{bookPdfUrl(sourceModal)&&<a className="outline-button" href={bookPdfUrl(sourceModal)} target="_blank" rel="noreferrer">Abrir PDF completo</a>}{sourceModal.url&&<a href={sourceModal.url} target="_blank" rel="noreferrer">Artigo original · {sourceModal.publishedAt}</a>}<p className="source-explanation">{sourceModal.kind==='editorial'?'Síntese editorial da Bússola sobre artigo de '+sourceModal.author+', Product Guru’s. Não é uma transcrição do artigo.':'Trecho da fonte consultada. Em livros, a numeração corresponde à página do PDF e pode diferir da edição impressa.'}</p><button className="primary-button" onClick={()=>{setInput('Ajude-me a aplicar as ideias sobre '+sourceModal.title+' ao seguinte problema: ');setTab('chat');setSourceModal(null);}}>Levar ao copiloto <ArrowRight size={16}/></button></>}
  </DetailDialog>}
 </div>;
}
