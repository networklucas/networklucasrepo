"""Build a private, page-addressable local corpus. No network calls."""
from pathlib import Path
from collections import Counter
import json,re,shutil,hashlib,unicodedata,gzip,argparse
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[1]
PROJECT=ROOT.parent
OUT=ROOT/"private-data"
OUT.mkdir(exist_ok=True)
META=[
("gestao-de-produtos","gestao-de-produtos-como-aumentar-as-chances-de-sucesso-do-seu-software.pdf","Gestão de Produtos","Joaquim Torres"),
("guia-startup","guia-da-startup-como-startups-e-empresas-estabelecidas-podem-criar-produtos-de-software-rentaveis.pdf","Guia da Startup","Joaquim Torres"),
("inspirado","Inspirado-Marty-Cagan.pdf","Inspirado","Marty Cagan"),
("lideranca-produtos","lideranca-de-produtos-digitais-a-ciencia-e-a-arte-da-gestao-de-times-de-produto.pdf","Liderança de Produtos Digitais","Joaquim Torres"),
("design-dia-dia","O design do dia a dia by Donald A. Norman (z-lib.org).pdf","O Design do Dia a Dia","Donald A. Norman"),
("transformacao-digital","transformacao-digital-e-cultura-de-produto-como-colocar-a-tecnologia-no-centro-da-estrategia-de-sua-empresa.pdf","Transformação Digital e Cultura de Produto","Joaquim Torres"),
("melhores-praticas-de-chatbot","Melhores praticas de chatbot.pdf","Melhores praticas de chatbot","Bússola de Produto")]
STOP=set("a o e de da do das dos em um uma os as para com que por no na nos nas se ao à ou como mais seu sua esse essa pelo pela the and to of is it".split())
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--book-id',choices=[item[0] for item in META],help='Reindex only this book, retaining the other already indexed books.')
args=parser.parse_args()
cached=json.loads((OUT/'corpus.json').read_text(encoding='utf8')) if args.book_id else None
def normalize(t):
 t=unicodedata.normalize("NFKD",t.lower())
 return "".join(c for c in t if not unicodedata.combining(c))
def terms(t):
 return [w for w in re.findall(r"[a-z0-9]{2,}",normalize(t)) if w not in STOP]
def clean(t):
 t=t.replace("\x00","")
 t=re.sub(r"(\w)-\s*\n\s*(\w)",r"\1\2",t)
 return re.sub(r"\s+"," ",t).strip()

def page_lines(text):
 # The purchaser watermark can be joined to the preceding text by PDF extraction.
 # Remove only that recognizable footer suffix, preserving the real page content.
 return [line for raw in text.splitlines() if (line:=re.sub(r'E-book\s+gerado\s+especialmente\s+para\b.*$','',raw,flags=re.I).strip())]
chunks=[];books=[]
for bid,filename,title,author in META:
 if cached and bid!=args.book_id:
  book=next((b for b in cached['books'] if b['id']==bid),None)
  retained=[c for c in cached['chunks'] if c.get('bookId')==bid and c['kind']=='book']
  if not book or not retained or book['title']!=title or book['author']!=author:
   raise ValueError('Full reindex required: cached book metadata is missing or changed: '+bid)
  books.append(book);chunks.extend(retained)
  print(f"{title}: reused {len(retained)} indexed chunks",flush=True)
  continue
 reader=PdfReader(PROJECT/"Livros"/filename)
 raw=[p.extract_text() or "" for p in reader.pages]
 # Only remove short repeated boundary lines, never arbitrary text inside a page.
 boundaries=Counter()
 for t in raw:
  lines=page_lines(t)
  boundaries.update(set(x for x in lines[:2]+lines[-2:] if len(x)<100))
 repeated={x for x,n in boundaries.items() if n>max(12,len(raw)*.18)}
 empty=[];chapter=None;chapters=set();count=0
 for i,t in enumerate(raw):
  lines=page_lines(t)
  for j,line in enumerate(lines[:12]):
   if re.match(r"^(cap[ií]tulo|parte)\s+([\divxlc]+|\d+)\b",line,re.I):
    chapter=clean(" ".join(lines[j:j+2]))[:180]
    if bid=="melhores-praticas-de-chatbot": chapter=chapter.split(" · ",1)[0]
    chapters.add(chapter);break
  text=clean("\n".join(x for x in lines if x not in repeated and not re.fullmatch(r"\d{1,5}",x)))
  if len(text)<60 or len(terms(text))<10:
   empty.append(i+1);continue
  # Chunk within pages so page citations are exact.
  pos=0
  while pos<len(text):
   end=min(pos+1800,len(text))
   if end<len(text):
    cut=text.rfind(" ",pos+1100,end)
    if cut>pos:end=cut
   part=text[pos:end];tid=f"{bid}-p{i+1}-{count}"
   tok=terms(part)
   chunks.append(dict(id=tid,title=title,author=author,kind="book",page=i+1,chapter=chapter,bookId=bid,text=part,excerpt=part[:300],terms=dict(Counter(tok)),length=len(tok)))
   count+=1
   if end==len(text):break
   pos=max(pos+1,end-180)
 books.append(dict(id=bid,title=title,author=author,pages=len(raw),usablePages=len(raw)-len(empty),emptyPages=empty,chapterCount=len(chapters),chunks=count))
 print(f"{title}: {len(raw)} pages, {count} chunks, {len(empty)} pages without usable text",flush=True)
skill=PROJECT/".agents"/"skills"/"pm-especialista"
dest=OUT/"skill";shutil.copytree(skill,dest,dirs_exist_ok=True)
for p in (skill/"references").glob("*.md"):
 text=p.read_text(encoding="utf8")
 tok=terms(text)
 title=re.search(r"^# (.+)$",text,re.M)
 chunks.append(dict(id="skill-"+p.stem,title=title.group(1) if title else p.stem,kind="skill",reference=p.name,text=text,excerpt=clean(text)[:300],terms=dict(Counter(tok)),length=len(tok)))
df=Counter()
for c in chunks:df.update(c["terms"].keys())
revision=hashlib.sha256(json.dumps(dict(books=books,chunks=chunks),ensure_ascii=False,sort_keys=True,separators=(",",":")).encode("utf8")).hexdigest()
data=dict(books=books,chunks=chunks,df=dict(df),averageLength=sum(c["length"] for c in chunks)/len(chunks),sourceRevision=revision)
(OUT/"corpus.json").write_text(json.dumps(data,ensure_ascii=False,separators=(",",":")),encoding="utf8")
(OUT/"extraction-report.json").write_text(json.dumps(dict(books=books,totalPages=sum(x["pages"] for x in books),totalChunks=len(chunks)),ensure_ascii=False,indent=2),encoding="utf8")
print(f"Indexed {len(chunks)} chunks. Private corpus: {(OUT/'corpus.json').stat().st_size} bytes.")

with gzip.GzipFile(filename=str(OUT/'corpus.json.gz'),mode='wb',mtime=0) as f: f.write((OUT/'corpus.json').read_bytes())
