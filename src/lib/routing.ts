import {concepts} from './concepts';
import {tokenize} from './retrieval';
export function routeReferences(query:string):string[]{
 const q=tokenize(query).join(' '),chosen:string[]=[];
 const add=(ref:string)=>{if(!chosen.includes(ref+'.md'))chosen.push(ref+'.md');};
 if(/\brice\b|\bbacklog\b|prioriz/.test(q))add('prioritization-craft');
 if(/\bprd\b|\bmvp\b|prototipo/.test(q)){add('strategic-build');add('continuous-discovery');}
 if(/posicionamento|competitiv|categoria/.test(q))add('positioning-craft');
 if(/\bia\b|\bai\b|copiloto|inteligencia artificial/.test(q)){add('ai-product-patterns');if(/lancar|lancamento/.test(q)){add('positioning-craft');add('launch-execution');}}
 if(!chosen.includes('launch-execution.md')&&/botao|reversiv|adiar|lan[cç]amento|lancar|iterar/.test(q)){add('ship-decisions');if(/adiar|duas semanas|premortem/.test(q))add('decision-frameworks');}
 if(/discovery|descoberta|entrevista|hipotese|premissa/.test(q))add('continuous-discovery');
 if(/\bokr\b|trimestr/.test(q))add('okr-frameworks');
 if(/north star|metrica|indicador/.test(q))add('metrics-frameworks');
 if(chosen.length)return chosen.slice(0,4);
 const generic=new Set(['produto','produtos','trabalho','ajuda','ajude','problema','decisao','software','cliente','usuarios']);
 const words=new Set(tokenize(query).filter(t=>!generic.has(t)));
 const scored=concepts.map(c=>({c,score:tokenize(c.title+' '+c.keywords.join(' ')).filter(t=>!generic.has(t)&&words.has(t)).length})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
 for(const {c} of scored)if(!chosen.includes(c.reference))chosen.push(c.reference);
 return chosen.slice(0,2);
}
