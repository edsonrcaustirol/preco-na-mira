#!/usr/bin/env python3
import json, re, html, time
from urllib.parse import urlparse
import requests
from PIL import Image
from io import BytesIO

ROWS = [
  {"index":1,"id":"4-filtro-refil-alltec-cmc1-voga-para-respirador","name":"4 Filtro Refil Alltec CMC1 Voga para Respirador","item":"MLB4964955061","userProduct":"MLBU4478228657","sources":["https://www.mercadolivre.com.br/4-filtro-refil-alltec-cmc1-voga-para-respirador/up/MLBU4478228657","https://meli.la/2pvbxJ8"]},
  {"index":20,"id":"baseus-gan2-pro-carregador-65w-com-cabo-100w","name":"Baseus GaN2 Pro Carregador 65W com Cabo 100W","product":"MLB21393148","sources":["https://www.mercadolivre.com.br/carregador-rapido-de-parede-baseus-gan-2-pro-65w-cabo-100w/p/MLB21393148","https://meli.la/21ybxDg"]},
  {"index":52,"id":"cooler-master-mwe-gold-750-v3-atx-3-1","name":"Cooler Master MWE Gold 750 V3 ATX 3.1","item":"MLB7083942614","product":"MLB74868003","sources":["https://www.mercadolivre.com.br/fonte-cooler-master-atx-31-750w-mwe-gold-750-v3-pfc-80-plus/p/MLB74868003","https://meli.la/1ZhUtMn"]},
  {"index":136,"id":"huawei-ws8100-mesh-3","name":"Huawei WiFi Mesh 3 WS8100 AX3000","sources":["https://consumer.huawei.com/br/routers/wifi-mesh3/","https://meli.la/2h8mDtq"]},
  {"index":139,"id":"hyperx-pulsefire-haste-2-pro","name":"HyperX Pulsefire Haste 2 Pro","item":"MLB4987032983","product":"MLB2097337904","sources":["https://www.mercadolivre.com.br/raton-inalambrico-para-juegos-hyperx-pulsefire-haste-2-pro/p/MLB2097337904","https://meli.la/2tExkAF"]},
  {"index":203,"id":"manta-asfaltica-aluminio-poliester-4mm-1m-x-10m-tipo2-dryko","name":"Manta Asfaltica Aluminio Poliester 4MM 1M X 10M TIPO2 Dryko","item":"MLB4811196376","userProduct":"MLBU2760006777","sources":["https://www.mercadolivre.com.br/manta-asfaltica-aluminio-poliester-4mm-1m-x-10m-tipo2-dryko/up/MLBU2760006777","https://meli.la/1eHPzPD"]},
  {"index":204,"id":"manta-asfaltica-preta-poliester-4mm-1m-x-10m-tipo2-dryko-tp2","name":"Manta Asfaltica Preta Poliester 4MM 1M X 10M TIPO2 Dryko TP2","item":"MLB4132108859","userProduct":"MLBU3310477849","sources":["https://www.mercadolivre.com.br/manta-asfaltica-preta-poliester-4mm-1m-x-10m-tipo2-dryko-tp2/up/MLBU3310477849","https://meli.la/2UBbJ5Q"]},
  {"index":279,"id":"positivo-smart-lamp-10w","name":"Positivo Casa Inteligente Smart Lâmpada Wi-Fi RGB 10W","sources":["https://www.positivocasainteligente.com.br/smart-lampada-rgb","https://www.positivocasainteligente.com.br/smart-lampada-wi-fi-rgb--mais-11167878/p","https://meli.la/2bZSn9P"]},
  {"index":299,"id":"ring-video-doorbell-2nd","name":"Ring Video Doorbell 2ª Geração","sources":["https://ring.com/support/products/doorbells/video-doorbell-gen-2?page=1&redirect=true","https://ring.com/au/en/products/video-doorbell-v2/","https://meli.la/1hiCkZL"]},
  {"index":311,"id":"samsung-powerbot-e-vr5000","name":"Samsung POWERbot-E VR5000","sources":["https://www.samsung.com/br/vacuum-cleaners/robot/robot-vr05r5050wk/","https://meli.la/1vJK8HU"]},
  {"index":356,"id":"tramontina-paris-chumbo-7p","name":"Tramontina Paris Chumbo Jogo de Panelas 7 Peças","sources":["https://www.tramontina.com.br/jogo-de-panelas-tramontina-paris-em-aluminio-com-revestimento-interno-e-externo-em-antiaderente-starflon-max-chumbo-07-pecas/28599617.html","https://www.tramontina.com.br/master---jogo-de-panelas-tramontina-paris-em-aluminio-com-revestimento-interno-e-externo-antiaderente-starflon-max-vermelho-7-pecas/28599702-master.html","https://meli.la/1SDRXLL"]}
]

S=requests.Session(); S.headers.update({'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/151 Safari/537.36','Accept-Language':'pt-BR,pt;q=0.9,en;q=0.7'})
BAD_WORDS=('logo','icon','sprite','favicon','banner','payment','footer','header','badge','placeholder','loading','youtube','facebook','instagram','whatsapp')

def get(url, **kw):
    try:
        r=S.get(url, timeout=25, allow_redirects=True, **kw)
        return r
    except requests.RequestException:
        return None

def clean(u):
    if not u:return ''
    u=html.unescape(str(u)).replace('\\/','/').strip(' \"\'')
    if u.startswith('//'):u='https:'+u
    return u

def image_info(url):
    try:
        r=S.get(url,timeout=20,allow_redirects=True,headers={'Referer':'https://www.google.com/'})
        ct=(r.headers.get('content-type') or '').lower()
        if not r.ok or not ct.startswith('image/') or len(r.content)<5000:return None
        im=Image.open(BytesIO(r.content)); w,h=im.size
        if w<250 or h<250:return None
        return {'width':w,'height':h,'bytes':len(r.content),'content_type':ct.split(';')[0]}
    except Exception:
        return None

def ml_api_candidates(row):
    out=[]
    endpoints=[]
    if row.get('item'): endpoints.append(('ml-item',f"https://api.mercadolibre.com/items/{row['item']}"))
    if row.get('product'): endpoints.append(('ml-product',f"https://api.mercadolibre.com/products/{row['product']}"))
    if row.get('userProduct'):
        endpoints += [('ml-user-product',f"https://api.mercadolibre.com/user-products/{row['userProduct']}"),('ml-user-product-as-product',f"https://api.mercadolibre.com/products/{row['userProduct']}")]
    for method,url in endpoints:
        r=get(url,headers={'Accept':'application/json'})
        if not r or not r.ok:continue
        try:j=r.json()
        except:continue
        def walk(x,key=''):
            if isinstance(x,dict):
                for k,v in x.items(): walk(v,k)
            elif isinstance(x,list):
                for v in x:walk(v,key)
            elif isinstance(x,str) and x.startswith('http') and ('image' in key.lower() or 'picture' in key.lower() or 'thumbnail' in key.lower() or 'mlstatic' in x):
                out.append((clean(x),method,url,100))
        walk(j)
    return out

def page_candidates(source):
    out=[]
    variants=[source]
    if source.startswith('http'):variants.append('https://r.jina.ai/'+source)
    for n,url in enumerate(variants):
        r=get(url,headers={'Accept':'text/plain' if 'r.jina.ai/' in url else 'text/html'})
        if not r or not r.ok:continue
        txt=r.text
        # highest confidence metadata / JSON-LD
        pats=[
          (r'<meta[^>]+property=["\']og:image(?::secure_url)?["\'][^>]+content=["\']([^"\']+)',90),
          (r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image(?::secure_url)?["\']',90),
          (r'"image"\s*:\s*"(https?:\\?/\\?/[^"\\]+)',86),
          (r'"imageUrl"\s*:\s*"(https?:\\?/\\?/[^"\\]+)',86),
          (r'!\[[^\]]*\]\((https?://[^)\s]+)',82),
          (r'<img[^>]+(?:src|data-src)=["\']([^"\']+)',65),
          (r'(https?:\\?/\\?/[^"\'<>\s]+\.(?:jpg|jpeg|png|webp)(?:\?[^"\'<>\s]*)?)',55),
        ]
        for pat,score in pats:
            for u in re.findall(pat,txt,re.I):
                out.append((clean(u), 'jina-page' if n else 'official-page', source, score-(2*n)))
    return out

def score_candidate(u,base):
    lu=u.lower(); score=base
    if any(w in lu for w in BAD_WORDS): score-=70
    if 'mlstatic.com' in lu: score+=8
    if any(x in lu for x in ('product','products','produto','sku','gallery','media','image','images')): score+=5
    return score

def resolve(row):
    candidates=ml_api_candidates(row)
    for src in row['sources']:candidates += page_candidates(src)
    seen=set(); verified=[]
    for u,method,source,base in candidates:
        if not u or u in seen or not u.startswith('http'):continue
        seen.add(u)
        sc=score_candidate(u,base)
        if sc<30:continue
        info=image_info(u)
        if not info:continue
        # reject very wide banners
        ratio=max(info['width'],info['height'])/max(1,min(info['width'],info['height']))
        if ratio>3.6:continue
        sc += min(15,(info['width']*info['height'])//250000)
        verified.append({'image':u,'method':method,'source':source,'score':int(sc),**info})
    verified.sort(key=lambda x:(x['score'],x['width']*x['height']),reverse=True)
    return {'index':row['index'],'id':row['id'],'name':row['name'],'status':'resolved' if verified else 'failed','best':verified[0] if verified else None,'candidates':verified[:8]}

def main():
    results=[]
    for i,row in enumerate(ROWS,1):
        print(f'[{i}/{len(ROWS)}] {row["id"]}',flush=True)
        res=resolve(row);results.append(res)
        print(res['status'], (res['best'] or {}).get('method'), (res['best'] or {}).get('image','')[:150],flush=True)
        time.sleep(.35)
    payload={'version':'V17.3.3-remaining','total':len(results),'resolved':sum(r['status']=='resolved' for r in results),'failed':sum(r['status']=='failed' for r in results),'results':results}
    with open('remaining-images-v1733.json','w',encoding='utf-8') as f:json.dump(payload,f,ensure_ascii=False,indent=2)
    print(json.dumps({k:payload[k] for k in ('total','resolved','failed')}),flush=True)
if __name__=='__main__':main()
