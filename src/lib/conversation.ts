import type {Message} from './types';

export type TurnMessage = Message & {error?: boolean; completed?: boolean};

/** Only adjacent, completed user/assistant pairs belong in provider history. */
export function completedHistory(messages: TurnMessage[]): Message[] {
 const history: Message[]=[];
 for(let i=0;i<messages.length-1;i++){
  const user=messages[i],reply=messages[i+1];
  if(user.role==='user'&&reply.role==='assistant'&&!user.error&&!reply.error&&reply.completed!==false&&user.content&&reply.content){
   history.push({role:'user',content:user.content},{role:'assistant',content:reply.content.replace(/\[S\d+\]/g,'[referência de outro turno]')});i++;
  }
 }
 return history;
}

/** Explicit subjects stand alone; anaphoric follow-ups inherit the last user question. */
export function retrievalQueries(message:string,history:Message[]):string[]{
 const parts=message.split(/\?\s*|\n+|;\s*|\b(?:e também|outra pergunta|além disso)\b/iu).map(s=>s.trim()).filter(Boolean);
 const followup=/^(?:e\s+)?(?:como (?:aplico|aplicar|uso|usar)(?:\s+(?:isso|isto|esse|essa)|\s*[?!.]?$)|(?:isso|isto|esse|essa|esses|essas)\b|por qu[eê]\b|explique melhor|detalhe\b|continue\b|pode (?:detalhar|explicar)|d[eê] (?:um )?exemplo|e (?:no|na|para) (?:meu|minha)\b)/iu.test(message.trim());
 const previous=history.filter(m=>m.role==='user').at(-1)?.content;
 return [...new Set((parts.length?parts:[message]).map(p=>followup&&previous?`${p}\nContexto da pergunta anterior: ${previous}`:p))].slice(0,8);
}
