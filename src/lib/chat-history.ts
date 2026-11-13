import type {Session,Workspace} from './workspace-model';
export type HistoryEntry={key:string;session:Session;projectId?:string;projectName?:string;title:string;updatedAt:string};
export function conversationTitle(session:Session){return session.title?.trim()||session.messages.find(m=>m.role==='user'&&m.content.trim())?.content.replace(/\s+/g,' ').slice(0,100)||'Conversa sem título';}
export function conversationHistory(workspace:Workspace):HistoryEntry[]{
 const rows:HistoryEntry[]=[...(workspace.chats||[]).map(session=>({key:'chat:'+session.id,session,title:conversationTitle(session),updatedAt:session.updatedAt||session.createdAt})),...workspace.projects.flatMap(project=>project.sessions.map(session=>({key:'project:'+project.id+':'+session.id,session,projectId:project.id,projectName:project.name,title:conversationTitle(session),updatedAt:session.updatedAt||session.createdAt})))];
 return rows.filter(row=>row.session.messages.some(m=>m.content.trim())).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.key.localeCompare(b.key));
}
export function filterHistory(rows:HistoryEntry[],query:string,scope:'all'|'projects'|'loose'='all'){
 const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');const words=normalize(query).trim().split(/\s+/).filter(Boolean);
 return rows.filter(row=>(scope==='all'||(scope==='projects'?!!row.projectId:!row.projectId))&&words.every(word=>normalize([row.title,row.projectName||'',...row.session.messages.map(m=>m.content)].join(' ')).includes(word)));
}
export function historyGroup(date:string,now=new Date()){
 const day=(value:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(value);const days=Math.round((Date.parse(day(now)+'T00:00:00Z')-Date.parse(day(new Date(date))+'T00:00:00Z'))/86400000);
 return days<=0?'Hoje':days===1?'Ontem':days<7?'Últimos 7 dias':'Mais antigas';
}
export function updateLooseSession(workspace:Workspace,id:string,value:Omit<Session,'id'|'createdAt'>,now=new Date().toISOString()):Workspace{
 const previous=workspace.chats?.find(s=>s.id===id);if(!previous||JSON.stringify({...previous,...value})===JSON.stringify(previous))return workspace;
 return {...workspace,chats:workspace.chats!.map(s=>s.id===id?{...s,...value,updatedAt:now}:s)};
}
