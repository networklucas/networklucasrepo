import {NextRequest} from 'next/server';
import {searchLibrary,bookMetadata} from '@/lib/corpus';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){const q=(req.nextUrl.searchParams.get('q')??'').slice(0,300);const kind=req.nextUrl.searchParams.get('kind')??undefined;return Response.json({books:bookMetadata(),results:q.length>=2?searchLibrary(q,kind):[]},{headers:{'Cache-Control':'private, no-store'}});}
