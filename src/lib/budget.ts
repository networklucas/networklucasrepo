import {Redis} from '@upstash/redis';
export function dayInSaoPaulo(date=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
export function reservationCost(input:string,maxOutput:number){const bytes=Buffer.byteLength(input,'utf8'),long=bytes>272000;return Math.ceil((bytes*(long?4:2)+maxOutput*(long?15:10))*1.03);}
export function actualCost(input:number,output:number,cached=0){const long=input>272000;return Math.ceil(Math.max(0,input-cached)*(long?4:2)+cached*(long?.2:.1)+output*(long?15:10));}
export const RESERVE_SCRIPT=`
local current=tonumber(redis.call('GET',KEYS[1]) or '0')
local amount=tonumber(ARGV[1]);local ceiling=tonumber(ARGV[2])
if redis.call('EXISTS',KEYS[2])==1 then return -2 end
if current+amount>ceiling then return -1 end
redis.call('INCRBY',KEYS[1],amount);redis.call('EXPIRE',KEYS[1],259200)
redis.call('SET',KEYS[2],amount,'EX',259200)
return current+amount
`;
export const SETTLE_SCRIPT=`
local reserved=redis.call('GET',KEYS[2])
if not reserved then return 0 end
local delta=tonumber(ARGV[1])-tonumber(reserved)
redis.call('INCRBY',KEYS[1],delta);redis.call('DEL',KEYS[2]);return 1
`;
function redis(){const url=process.env.UPSTASH_REDIS_REST_URL,token=process.env.UPSTASH_REDIS_REST_TOKEN;if(!url||!token)throw new Error('BUDGET_UNAVAILABLE');return new Redis({url,token});}
export function openaiConfigured(){return process.env.OPENAI_ENABLED==='true'&&!!process.env.OPENAI_API_KEY&&Number(process.env.OPENAI_DAILY_BUDGET_USD)>0&&!!process.env.UPSTASH_REDIS_REST_URL&&!!process.env.UPSTASH_REDIS_REST_TOKEN;}
export async function reserve(input:string,maxOutput:number){
 const r=redis(),key='bussola:openai:'+dayInSaoPaulo(),id=crypto.randomUUID(),hold=key+':'+id;
 const ceiling=Math.floor(Number(process.env.OPENAI_DAILY_BUDGET_USD)*1e6*.9),amount=reservationCost(input,maxOutput);
 const result=Number(await r.eval(RESERVE_SCRIPT,[key,hold],[amount,ceiling]));
 if(result<0)return null;
 return {amount,async settle(actual:number){await r.eval(SETTLE_SCRIPT,[key,hold],[actual]);}};
}
export async function budgetStatus(){
 const budget=Number(process.env.OPENAI_DAILY_BUDGET_USD)||0;
 if(!openaiConfigured())return {enabled:false,dailyBudget:budget,used:0,day:dayInSaoPaulo(),available:false};
 try{const used=Number(await redis().get('bussola:openai:'+dayInSaoPaulo()))||0;return {enabled:true,dailyBudget:budget,used:used/1e6,day:dayInSaoPaulo(),available:used<budget*1e6*.9};}
 catch{return {enabled:true,dailyBudget:budget,used:null,day:dayInSaoPaulo(),available:false};}
}
