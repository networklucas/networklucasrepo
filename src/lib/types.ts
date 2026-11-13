export type Source = { id: string; title: string; kind: 'book' | 'skill' | 'editorial'; bookId?:string; author?: string; page?: number; chapter?: string; reference?: string; excerpt: string; url?: string; publishedAt?: string; reviewedAt?: string; score?: number };
export type Chunk = Source & { text: string; terms?: Record<string,number>; length?: number; bookId?: string };
export type Book = {id:string; title:string; author:string; pages:number; usablePages:number; emptyPages:number[]; chapterCount:number; chunks:number};
export type Concept = { id:string; title:string; category:string; reference:string; summary:string; when:string; steps:string[]; limit:string; example:string; keywords:string[] };
export type Message = {role:'user'|'assistant';content:string};
export type ChatEvent = {type:'heartbeat'} | {type:'phase';phase:'generating'|'validating'} | {type:'provider';provider:string;reason:string} | {type:'delta';text:string} | {type:'reset';reason:string} | {type:'sources';sources:Source[]} | {type:'done'} | {type:'error';message:string};
