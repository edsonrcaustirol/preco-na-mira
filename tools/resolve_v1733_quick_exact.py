#!/usr/bin/env python3
import json,re,html
from io import BytesIO
from urllib.parse import urljoin
import requests
from PIL import Image

ROWS=[
('4-filtro-refil-alltec-cmc1-voga-para-respirador','4 Filtro Refil Alltec CMC1 Voga para Respirador',['https://www.mercadolivre.com.br/4-filtro-refil-alltec-cmc1-voga-para-respirador/up/MLBU4478228657','https://meli.la/2pvbxJ8']),
('baseus-gan2-pro-carregador-65w-com-cabo-100w','Baseus GaN2 Pro Carregador 65W com Cabo 100W',['https://www.baseus.com/products/gan2-3-ports-fast-charger-65w','https://www.mercadolivre.com.br/carregador-rapido-de-parede-baseus-gan-2-pro-65w-cabo-100w/p/MLB21393148']),
('cooler-master-mwe-gold-750-v3-atx-3-1','Cooler Master MWE Gold 750 V3 ATX 3.1',['https://www.coolermaster.com/en-global/products/mwe-gold-750-v3-atx-3-1.html']),
('huawei-ws8100-mesh-3','Huawei WiFi Mesh 3 WS8100 AX3000',['https://consumer.huawei.com/br/routers/wifi-mesh3/']),
('hyperx-pulsefire-haste-2-pro','HyperX Pulsefire Haste 2 Pro',['https://row.hyperx.com/pt-br/products/hyperx-pulsefire-haste-2-pro-4k-wireless-gaming-mouse']),
('manta-asfaltica-aluminio-poliester-4mm-1m-x-10m-tipo2-dryko','Manta Asfaltica Aluminio Poliester 4MM 1M X 10M TIPO2 Dryko',['https://www.mercadolivre.com.br/manta-asfaltica-aluminio-poliester-4mm-1m-x-10m-tipo2-dryko/up/MLBU2760006777','https://meli.la/1eHPzPD']),
('manta-asfaltica-preta-poliester-4mm-1m-x-10m-tipo2-dryko-tp2','Manta Asfaltica Preta Poliester 4MM 1M X 10M TIPO2 Dryko TP2',['https://www.mercadolivre.com.br/manta-asfaltica-preta-poliester-4mm-1m-x-10m-tipo2-dryko-tp2/up/MLBU3310477849','https://meli.la/2UBbJ5Q']),
('positivo-smart-lamp-10w','Positivo Casa Inteligente Smart Lâmpada Wi-Fi RGB 10W',['https://www.positivocasainteligente.com.br/smart-lampada-rgb']),
('ring-video-doorbell-2nd','Ring Video Doorbell 2ª Geração',['https://ring.com/support/products/doorbells/video-doorbell-gen-2?page=1&redirect=true','https://ring.com/au/en/products/video-doorbell-v2/']),
('samsung-powerbot-e-vr5000','Samsung POWERbot-E VR5000',['https://www.samsung.com/br/vacuum-cleaners/robot/robot-vr05r5050wk/']),
('tramontina-paris-chumbo-7p','Tramontina Paris Chumbo Jogo de Panelas 7 Peças',['https://www.tramontina.com.br/jogo-de-panelas-tramontina-paris-em-aluminio-com-revestimento-interno-e-externo-em-antiaderente-starflon-max-chumbo-07-pecas/28599617.html'])]
S=requests.Session();S.headers.update({'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/151 Safari/537.36','Accept-Language':'pt-BR,pt;q=0.9,en;q=0.7'})
BAD=('logo','icon','sprite','favicon','banner','payment','footer','header','badge','placeholder','loading')

def get(u,timeout=10):
 try:return S.get(u,timeout=timeout,allow_redirects=True)
 except:return None

def norm(u,base):
 u=html.unescape(str(u or '')).replace('\\/','/').strip(' \"\'')
 if u.startswith('//'):u='https:'+u
 return urljoin(base,u)

def check(u):
 if not u or any(x in u.lower() for x in BAD):return None
 try:
  r=S.get(u,timeout=10,allow_redirects=True)
  if not r.ok or not (r.headers.get('content-type') or '').lower().startswith('image/') or len(r.content)<7000:return None
  im=Image.open(BytesIO(r.content));w,h=im.size
  if w<300 or h<300 or max(w,h)/max(1,min(w,h))>3.5:return None
  return {'image':r.url,'width':w,'height':h,'content_type':(r.headers.get('content-type') or '').split(';')[0]}
 except:return None

def resolve_page(page):
 r=get(page)
 if r and r.ok:
  t=r.text
  pats=[
   ('og-image',r'<meta[^>]+property=["\']og:image(?::secure_url)?["\'][^>]+content=["\']([^"\']+)'),
   ('og-image',r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image(?::secure_url)?["\']'),
   ('twitter-image',r'<meta[^>]+(?:name|property)=["\']twitter:image["\'][^>]+content=["\']([^"\']+)'),
   ('json-image',r'"image"\s*:\s*"(https?:\\?/\\?/[^"\\]+)')]
  for method,pat in pats:
   for x in re.findall(pat,t,re.I)[:4]:
    u=norm(x,r.url);v=check(u)
    if v:return {'method':method,'source':r.url,**v}
 jr=get('https://r.jina.ai/'+page,timeout=12)
 if jr and jr.ok:
  for x in re.findall(r'!\[[^\]]*\]\((https?://[^)\s]+)',jr.text,re.I)[:12]:
   u=norm(x,page);v=check(u)
   if v:return {'method':'jina-first-product-image','source':page,**v}
 return None

def main():
 results=[]
 for i,(pid,name,pages) in enumerate(ROWS,1):
  print(f'[{i}/{len(ROWS)}] {pid}',flush=True);best=None
  for p in pages:
   best=resolve_page(p)
   if best:break
  results.append({'id':pid,'name':name,'status':'resolved' if best else 'failed','best':best})
  print(' ->',results[-1]['status'],(best or {}).get('image','')[:150],flush=True)
 out={'total':len(results),'resolved':sum(x['status']=='resolved' for x in results),'failed':sum(x['status']=='failed' for x in results),'results':results}
 json.dump(out,open('quick-exact-v1733.json','w',encoding='utf-8'),ensure_ascii=False,indent=2)
 print(json.dumps({k:out[k] for k in ('total','resolved','failed')}),flush=True)
if __name__=='__main__':main()
