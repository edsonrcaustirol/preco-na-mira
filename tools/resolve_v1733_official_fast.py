#!/usr/bin/env python3
import json,re,html
from io import BytesIO
from urllib.parse import urljoin
import requests
from PIL import Image

PRODUCTS=[
('baseus-gan2-pro-carregador-65w-com-cabo-100w','Baseus GaN2 Pro Carregador 65W com Cabo 100W','https://www.baseus.com/products/gan2-3-ports-fast-charger-65w'),
('cooler-master-mwe-gold-750-v3-atx-3-1','Cooler Master MWE Gold 750 V3 ATX 3.1','https://www.coolermaster.com/en-global/products/mwe-gold-750-v3-atx-3-1.html'),
('huawei-ws8100-mesh-3','Huawei WiFi Mesh 3 WS8100 AX3000','https://consumer.huawei.com/br/routers/wifi-mesh3/'),
('hyperx-pulsefire-haste-2-pro','HyperX Pulsefire Haste 2 Pro','https://row.hyperx.com/pt-br/products/hyperx-pulsefire-haste-2-pro-4k-wireless-gaming-mouse'),
('positivo-smart-lamp-10w','Positivo Casa Inteligente Smart Lâmpada Wi-Fi RGB 10W','https://www.positivocasainteligente.com.br/smart-lampada-rgb'),
('ring-video-doorbell-2nd','Ring Video Doorbell 2ª Geração','https://ring.com/support/products/doorbells/video-doorbell-gen-2?page=1&redirect=true'),
('samsung-powerbot-e-vr5000','Samsung POWERbot-E VR5000','https://www.samsung.com/br/vacuum-cleaners/robot/robot-vr05r5050wk/'),
('tramontina-paris-chumbo-7p','Tramontina Paris Chumbo Jogo de Panelas 7 Peças','https://www.tramontina.com.br/jogo-de-panelas-tramontina-paris-em-aluminio-com-revestimento-interno-e-externo-em-antiaderente-starflon-max-chumbo-07-pecas/28599617.html')]
S=requests.Session();S.headers.update({'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/151 Safari/537.36','Accept-Language':'pt-BR,pt;q=0.9,en;q=0.7'})
BAD=('logo','icon','sprite','favicon','banner','payment','footer','header','badge','placeholder','loading')

def get(u,**kw):
 try:return S.get(u,timeout=22,allow_redirects=True,**kw)
 except:return None

def clean(u,base):
 u=html.unescape(str(u or '')).replace('\\/','/').strip(' \"\'')
 if u.startswith('//'):u='https:'+u
 return urljoin(base,u)

def valid(u):
 if not u or any(x in u.lower() for x in BAD):return None
 try:
  r=S.get(u,timeout=18,allow_redirects=True)
  if not r.ok or not (r.headers.get('content-type') or '').lower().startswith('image/') or len(r.content)<8000:return None
  im=Image.open(BytesIO(r.content));w,h=im.size
  if w<300 or h<300:return None
  if max(w,h)/max(1,min(w,h))>3.5:return None
  return {'image':r.url,'width':w,'height':h,'bytes':len(r.content),'content_type':(r.headers.get('content-type') or '').split(';')[0]}
 except:return None

def candidates(page):
 r=get(page)
 out=[]
 if r and r.ok:
  t=r.text
  patterns=[
   (r'<meta[^>]+property=["\']og:image(?::secure_url)?["\'][^>]+content=["\']([^"\']+)',100,'og-image'),
   (r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image(?::secure_url)?["\']',100,'og-image'),
   (r'<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)',95,'twitter-image'),
   (r'"image"\s*:\s*"(https?:\\?/\\?/[^"\\]+)',90,'json-image'),
   (r'<img[^>]+(?:src|data-src)=["\']([^"\']+)',55,'img')]
  for pat,score,method in patterns:
   for x in re.findall(pat,t,re.I):out.append((clean(x,r.url),score,method,r.url))
 jr=get('https://r.jina.ai/'+page,headers={'Accept':'text/plain','X-Retain-Images':'all'})
 if jr and jr.ok:
  for x in re.findall(r'!\[[^\]]*\]\((https?://[^)\s]+)',jr.text,re.I):out.append((clean(x,page),85,'jina-image',page))
 return out

def main():
 results=[]
 for pid,name,page in PRODUCTS:
  print('checking',pid,flush=True); seen=set(); good=[]
  for u,score,method,source in candidates(page):
   if u in seen:continue
   seen.add(u);v=valid(u)
   if v:good.append({'score':score,'method':method,'source':source,**v})
  good.sort(key=lambda x:(x['score'],x['width']*x['height']),reverse=True)
  res={'id':pid,'name':name,'page':page,'status':'resolved' if good else 'failed','best':good[0] if good else None,'candidates':good[:5]}
  print(res['status'], (res['best'] or {}).get('image','')[:140],flush=True);results.append(res)
 json.dump({'total':len(results),'resolved':sum(x['status']=='resolved' for x in results),'results':results},open('official-fast-v1733.json','w',encoding='utf-8'),ensure_ascii=False,indent=2)
if __name__=='__main__':main()
