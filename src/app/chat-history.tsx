'use client';
import {useState} from 'react';
import {Search,MessageSquare,Trash2,ArrowUpRight} from 'lucide-react';
import {filterHistory,historyGroup,type HistoryEntry} from '@/lib/chat-history';
export function ChatHistory({entries,activeKey,ready,onOpen,onDelete}:{entries:HistoryEntry[];activeKey?:string;ready:boolean;onOpen:(entry:HistoryEntry)=>void;onDelete:(id:string)=>void}){
 const [query,setQuery]=useState(''),[scope,setScope]=useState<'all'|'projects'|'loose'>('all');
 const filtered=filterHistory(entries,query,scope);const groups=[...new Set(filtered.map(row=>historyGroup(row.updatedAt)))];
 return <div className="content-view history-view"><div className="page-heading"><h1>Histórico de conversas</h1></div><div className="search-field"><Search size={18}/><input aria-label="Buscar conversas" placeholder="Buscar conversas…" value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="filter-list" aria-label="Tipos de conversa">{([['all','Todas'],['projects','Projetos'],['loose','Avulsas']] as const).map(([value,label])=><button key={value} aria-pressed={scope===value} className={scope===value?'selected':''} onClick={()=>setScope(value)}>{label}</button>)}</div>
  {!ready?<p role="status" className="subtle">Carregando conversas…</p>:groups.map(group=><section key={group} className="history-group"><h2>{group}</h2>{filtered.filter(row=>historyGroup(row.updatedAt)===group).map(row=><div className="history-row" key={row.key}><button className="project-list-item" aria-current={activeKey===row.key?'true':undefined} onClick={()=>onOpen(row)}><MessageSquare size={18}/><span><strong>{row.title}</strong><small>{row.projectName||'Conversa avulsa'} · {new Date(row.updatedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'})}</small></span><ArrowUpRight size={16}/></button>{!row.projectId&&<button className="history-delete" aria-label={'Excluir conversa '+row.title} onClick={()=>{if(window.confirm('Excluir esta conversa salva neste navegador?'))onDelete(row.session.id);}}><Trash2 size={16}/></button>}</div>)}</section>)}
  {ready&&!filtered.length&&<p className="empty-state">{query?'Nenhuma conversa encontrada.':'As conversas salvas neste navegador aparecem aqui.'}</p>}<p className="local-caption">O histórico fica somente neste navegador.</p>
 </div>;
}
