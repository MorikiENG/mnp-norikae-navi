"""Official-source change detection. Candidate observations never change approved prices."""
import concurrent.futures,datetime,hashlib,html,json,pathlib,re,urllib.request,urllib.parse
from html.parser import HTMLParser
ROOT=pathlib.Path(__file__).resolve().parents[1]
ALLOWED={'www.docomo.ne.jp','ahamo.com','www.au.com','www.softbank.jp','network.mobile.rakuten.co.jp','povo.jp','www.linemo.jp','www.uqwimax.jp','www.ymobile.jp','www.iijmio.jp','mineo.jp','support.mineo.jp','www.nihontsushin.com'}
class SafeRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,req,fp,code,msg,headers,newurl):
  u=urllib.parse.urlparse(newurl)
  if u.scheme!='https' or u.hostname not in ALLOWED: raise ValueError('Redirect outside official source allowlist')
  return super().redirect_request(req,fp,code,msg,headers,newurl)
class Extractor(HTMLParser):
 def __init__(self):super().__init__();self.parts=[];self.skip=0
 def handle_starttag(self,t,a):
  if t in ('script','style','noscript'):self.skip+=1
  if t=='img' and not self.skip:self.parts.extend(v for k,v in a if k=='alt' and v)
 def handle_endtag(self,t):
  if t in ('script','style','noscript'):self.skip=max(0,self.skip-1)
 def handle_data(self,d):
  if not self.skip and d.strip():self.parts.append(d.strip())
def normalize(raw):
 p=Extractor();p.feed(raw);return re.sub(r'\s+',' ',html.unescape(' '.join(p.parts))).strip()
def observe(url):
 try:
  u=urllib.parse.urlparse(url)
  if u.scheme!='https' or u.hostname not in ALLOWED:raise ValueError('URL outside official source allowlist')
  req=urllib.request.Request(url,headers={'User-Agent':'MNP-Norikae-Navi-change-monitor/1.0 (+https://github.com/MorikiENG/mnp-norikae-navi)'})
  with urllib.request.build_opener(SafeRedirect).open(req,timeout=30) as r:
   raw=r.read(4_000_001)
   if len(raw)>4_000_000:raise ValueError('Response exceeds 4MB limit')
   if 'text/html' not in r.headers.get('Content-Type',''):raise ValueError('Non-HTML response requires manual review')
   text=normalize(raw.decode('utf-8','replace'))
  if len(text)<150 or re.search(r'Access Denied|Just a moment|captcha',text,re.I):raise ValueError('Page unreadable or access challenge')
  # Numeric amounts are observations only; no surrounding marketing text is copied.
  amounts=sorted(set(re.findall(r'\d[\d,]*(?:\.\d+)?\s*円',text)))[:60]
  return {'url':url,'state':'fetched','sha256':hashlib.sha256(text.encode()).hexdigest(),'observedYenStrings':amounts}
 except Exception as e:return {'url':url,'state':'unavailable','error':str(e)[:180]}
def review_due(c,today):
 return [{'planId':p['id'],'checkedAt':p['checkedAt'],'validThrough':p['validThrough']} for p in c['plans'] if p['status']=='verified' and datetime.date.fromisoformat(p['validThrough']) <= today+datetime.timedelta(days=7)]
def main():
 c=json.loads((ROOT/'data/catalog.json').read_text());baseline_path=ROOT/'research/baseline.json'
 baseline=json.loads(baseline_path.read_text()) if baseline_path.exists() else {}
 urls=sorted(set([x['url'] for x in c['carriers']]+[u for p in c['plans'] for u in p['sources']]))
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:results=list(ex.map(observe,urls))
 candidates=[];newbase=dict(baseline)
 for r in results:
  prior=baseline.get(r['url']);r['previousSha256']=prior
  if r['state']=='fetched':
   r['change']='baseline-needed' if not prior else 'changed' if prior!=r['sha256'] else 'unchanged'
   newbase[r['url']]=r['sha256']
  else:r['change']='verification-needed'
  if r['change']!='unchanged':candidates.append(r)
 due=review_due(c,datetime.date.today())
 if candidates or due:
  out=ROOT/'data/candidates';out.mkdir(exist_ok=True)
  (out/'latest.json').write_text(json.dumps({'schemaVersion':1,'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'approved':False,'reviewDue':due,'instruction':'Observed strings are not tariffs. Review official fees, capacity, dates, eligibility, and taxes before editing catalog.json.','observations':candidates},ensure_ascii=False,indent=2)+'\n')
  baseline_path.write_text(json.dumps(newbase,ensure_ascii=False,indent=2)+'\n')
  print(f'{len(candidates)} sources and {len(due)} expiring plans need review. Approved catalog unchanged.')
 else:print('No source changes detected. Approved catalog unchanged.')
 if all(r['state']=='unavailable' for r in results):raise SystemExit('All sources unavailable; investigate workflow logs')
if __name__=='__main__':main()
