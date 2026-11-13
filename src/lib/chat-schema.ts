import {z} from 'zod';
export const chatSchema=z.object({
 message:z.string().trim().min(2).max(12000),
 mode:z.enum(['quick','deep']).default('quick'),
 confidential:z.boolean().default(false),
 context:z.object({project:z.string().max(200),journey:z.enum(['prioritize','discovery','direction']).optional(),summary:z.string().max(18000)}).optional(),
 history:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().max(16000)})).max(12).default([]),
 attachment:z.object({name:z.string().max(200),text:z.string().max(100000),pages:z.number().int().min(1).max(100)}).optional()
}).superRefine((v,ctx)=>{if(v.history.reduce((n,m)=>n+m.content.length,0)>40000)ctx.addIssue({code:'custom',message:'O contexto da conversa excede o limite. Inicie uma nova conversa.',path:['history']});});
