import {z} from 'zod';
const short=z.string().max(200),text=z.string().max(100000);
export const sourceSchema=z.object({id:short,bookId:short.optional(),title:short,kind:z.enum(['book','skill','editorial']),author:short.optional(),page:z.number().int().positive().optional(),chapter:text.optional(),reference:text.optional(),excerpt:text,url:z.string().url().refine(v=>/^https?:\/\//.test(v)).optional(),publishedAt:short.optional(),reviewedAt:short.optional()});
