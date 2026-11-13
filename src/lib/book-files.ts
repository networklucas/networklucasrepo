import books from '../data/book-files.json';
import type {Source} from './types';
export {books};
export function bookPdfUrl(source:Pick<Source,'kind'|'title'|'bookId'|'page'>){if(source.kind!=='book')return;const book=books.find(b=>b.id===source.bookId||b.title===source.title);return book?'/api/books/'+book.id+'/pdf'+(source.page?'#page='+source.page:''):undefined;}
export function pdfRange(header:string|null,size:number):{start:number;end:number}|null|'invalid'{
 if(!header)return null;const match=/^bytes=(\d*)-(\d*)$/.exec(header);if(!match||(!match[1]&&!match[2]))return 'invalid';
 const suffix=!match[1],start=suffix?Math.max(0,size-Number(match[2])):Number(match[1]),end=suffix?size-1:match[2]?Math.min(Number(match[2]),size-1):size-1;
 return !Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start?'invalid':{start,end};
}
