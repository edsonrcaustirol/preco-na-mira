#!/usr/bin/env python3
import base64,csv,gzip,html,json,random,re,time
from concurrent.futures import ThreadPoolExecutor,as_completed
from urllib.parse import urlparse
import requests

B64='H4sIAAHagGoC/31bybLiOhL9l7fu6GfNUu+YCaZgBvOiFxh8mZoZzPD1na57sa2qtCpqUURJsizlcM7J9D///PXXv+K/69vtdP3P33/vw/9t/v2/+d/kHF6iTfTXf//1z1/tVpEbyY0QniT4cHqKgmdD/xoO/x3PUFpSrgW2tqbR6bj9DMaWmx76fNvJLEc9bTymFCfYgvNFefNoZ4YLj2lPMI2tbZa39fVgrU0ZvJth6Np3HoYX6dgsOV9ePBy7XuccbE61WXZ/QiuPEoMNpq2ws127liNtuuy3k7thTBv4w03OcMGvqlXIPJ2Y+G4U9nQybW6CZzlZWxqmGaOe+p4pjeIe5x42s3c7hePGZ6YwhkoqiZE/M6nkQlGGbfD94hG5ON6YsflpMpu7zqRUPy6bBdc1lSv9Qfj1273DNSgmseH9wzRYlF2PNIumuLSyCxIGRsRRqyMvONZV1gSoZpKiJkrW9LJtr9NLIFqBRbOfS+BweWDcHHvMsLJvqm4yU5H4oj2tcs5kxtemkTVMprmWWmAXTKPFIVyPPmtLwg0zinKas/Z4rNuzt+tGoq56GaelT5+HvpTWEQsjpEYdZ72ohc1JdrCEkEEMGoP6jPPrI7FWaQghQiiZs9XFV7VWya4NB0uYEgI9qDvlY9/15pwMH7u6683DQBeelcwDpaQmvnhsuW5Fd+UxeRkhCPMM8XJuhjb4mh1E9qAM5YJKhbkeaYpJFCQWxbkxRMBZ5bzZVrS6vSBrUVwzMEB0330zp/e+8xje46CceAJjhBKlCc9JQ6TVrbdWzew1QdiBiIXa85ktovkzewxMKIYPJu9pdSuW2cFaexLPR1Tv5tsgTO6DaqOJMZp/ZnJwMYaaZXtckT+GEd85xF/DqTA/MxmEVEHxwL19HGeh/5mpCAQIyswv74zvjXJmjMBfjfBu3yTPhKdRDXvM8+sr2Y1vZ2u40B71cm4wWK3WYp5xNC4VJUR+3ojDnRr0fvatV7WUnKLUlIM/S6Fz9tUoNTb1VnIAVAlGYWWaPMh4RqBHVw2DBX8lMz0dnxvEt++ZKo6InsfQ+Lke3dqHZIuUMiIo4T8zpedx+I2ml25U6G0zbgWR2jNS5uRwwtbmuRW2rRLICBQbvDs/yg+WrK214gb8huWs3axF/q2RSfnSE5AWyc/BCQ7mytDXr4rC8VJMZ8ILSwg9ebGh0G63WTPdF5MQcj3x8yDBAV8yg2OL9ys80cwWPQoRS5IP1vRgyxR1qHWRTqZJnJeGUohFmv6YH/xinOAo1b88B8tK6orMEMmVzLPzxXjX6syS4QpCqiKa5Fgr7RVHk8omPQvlQcjmMu/o5N60l9cUjgvwZrDmDyyDuYrg+HWzKK6nm6zlUAZugWeuqT+Wz9+goseE5igy3tbU+mkNVsxQDw2J09FIrFNcCdGJQCgg6gPFFNyp+caZfwbF6DhY7ZIkABhUKu1x8gmn4HBcoe8zKx5WUZYYEMUFERy15iOr0GXohJBft5FhVhJQTAuclCwXm3LFWC6rPQh8KAQu7iqK97PpHiIJYxLFkkO/Ecj374O5RF1HtWrDDvt9MJwftvJgE+nu2hrMpJQo1iSsPGlWB67zqlbfr13JNWIbNu+zeerYwqNws4b9xB6lwFSlRE/suddimMyESUKBCfGcB83X/XpTf4bDLXBhJOTSHMJBV519P0VUwF4A9Xh5zk+ez3NpMctYqJYCzOJjoVwxsBP0eoJSe1JbJq9BIAVA6qF5XK7SG/buyYMERC8D3FXl5sSeKPRcJAaOwT+1A9cVtbbvwD9ZdszihIKmHnXtVspZnAxQ0YPzQPPuere53Vw4mXaiynDkZHXFr8e5nQAmxYhHACNQ+qELRnDFUap0WAwX1zSkctikpwz5MT2iDYVbQw2/0xnSQssmGorn0PlW5dnltzRyMwH+R7hKQiZRBrfwaBDykgsdk4mp8q3FeIyIwQoWRWm1Jo9lm8IQiOx4IKD9x2NdTd0FOCeh/IMmAVAA0kGjnlS9ylX+MVGmiUoTNFRXO9fyws8SB6EopAQ0IzzG96i8tm8A+ChK9eh+UjPbaXYwvDSAFTRPLf3VYJegSCD0AA/gkPJ0r+bk2Z2m7gtkhxP+jWdRqLU4V3tXJycuyHWx4xqxarBWs5eV2jwZKysozAz648araR0U54x5mPPSuWz0py1bdaNGARJG8+W43ts7CT7tBp3S7enMEH65M57aL6O0wFFg4+R3Rc+CMlpohbOHsNourG827gGeIlEnJRE4vLYSOwNPNaiJnLeTSefkDEqn7cX2y5hafit0f2pbTF0KJVtG4p4m6H0O55vLLbLuEwCXQS+ImvOwvapmD5eKOKahLuWXdK15tQZD6AYOha3MK/t+IeusRCigpgINPHU6q3ay25CaAFhlaE4oDvaiZ2UbFQN9jd7E4l7dEld6I4/ipmGS6CuUAtOCZ+fly1OtUtJLC//wOFqgx6unx/boZIMlCmQLPYTzV7mpw+xg4G+QctCVF7pXHjnfqzh8Hg8Nl+8dBv5ln5JaoPQx95F5Atf8sd4OiGvBtd6XU94vINFIJfUvtfNXIgP26ykUr4broFVapClQK4BTNMXvwM0JSjCpKIy/7jI70wPyotknPAHhYOD/aH6/VZ67QjWdC/5M0/xOgW/FigAqepH6/FWeZh1YKv5LFkBjGF2so6FlsgJgB07HKpXWV7+RXZkwbXJWrk9YpdNMOaUGrCcEzcO4g6gw7OkUC3G4JM3FR8cAcs65h3LdXmvYYimsBEYMcdjkCYjk1enel9xln6/ebD5zxsigSk3RCf6uhZsaHF1rHENRLbsEZDLs8obv3EdVt3YDF+ujhfcr6DPXGuzZGkbGtUY7aFdTjS3W4mSME36MEfgrBYaAopdTt9Y4k1TX84zREMf0R5ySHuO4ulq+zsgz1XXighzl3odys7g6I/BccG3Pt9Eua9FgSbAA6qO7y27erGdzAUBn79vs/oyZlenXJlEpgVqKmOV+BDPhAYkjHpr5KsNhf1NJjZtBoAW6yD+wISYleMFvFnExSHVEogGOQl7zfmbCv2IxCQ3ay3l1XLCCNovPEIXr4WE/Xr+tEmis3wp0T33/sa2fXTZ1qLdf57ctODNKUORGBuHl7J+tEARwGH8r0ghHwfyVyYlaCSAOP9geQI8hCld8OF0ujiJTCwC+FdP1tEYrNM2hWw3f7z5qLh/pvc/tijMitB/LPT2m1sOZ1IrkKcL0Pez1LTMGN6NAvdDrO+t7bWmVmjgwNaAvaLzc1pfLNKPFGAFQNclVE6ZhoyusMhtVKgeIPRahLDKLCLG4joX6+DwIX4WshTIJ12fwGsbzeg7qg4TbmFjZMYTkac5hqxxMS6kACuzGAIjIw07jc6/JZq7r80+TRVSzNsvBTpnCmdWjfZ24pAt63GxUzboxMEg8ldL3rlfY7e1KJ1wBKhrT8BJEBxdNo/d7d31vuvx3FNzu06Jrjcfj3EhLkByoMeOSfUQjuEetv4sQf2L1Zal1YRnzg6sUROSKx4eZv/zKVmw8RQFMfcrJRFPGUZz/Nbw0d6k8pwnzpNQmz2LW90WxtksLKSzuH/gOl2hqm7Ht0Vkn3bcHx3FWFuXCAHjUqMWciirsCNeJT+Ylv/Nwjai1xahp1QQVZGmGYjmq+tdzaEVdweOQj7LlZlSYsZOzrWNhCipLPgQwUEoFmnXvZN4g/czNgB9Lllu/DuvddzeV30mcSbQWeTLjqBg0LKYNKysI9ai3jH21eRfTIhiYoxAyT5NkZLBUvqUyKMDmgE3RU/MHb8otjgXpChcf6bx6rvyEjB9gzeLaVV4Z/B0QViN2SBAQaVFe+uDL8JQ9EaCwnkcorp5dotHinm7EA9zgeUzm1oKmepAMZzrGWp6giQhOYnkHPfqrXCzo1oqocEmSobvqhqd7Zfe7FiRxhj8tjc3+kArgANMEUZ9CtIBEqvCiPu2t+4O6sMw45olG4y/wtSm2bXFZS4UXHO4jc77RlNJCtAS4+CklSwOohaPgg7GyOdz8DI/UHszWHwZKBQBWD6+1PN7dWmi9DSBPir96pfUcG2cFaTUOLr6lDHGgZbjQRBpERD07wQHEMrjStyQrVtKWvOsRSCfo4PFuUoxOFmaXFEgJxfVTMJSk74dTDUyCUfXpZoBHEI1bXPk2PDWc8v1gLTdOHEwb71H5XrXkMU1NTpfG6TKWg50N4gBpUTR8X3dl0nnaJ8ZiYRitjEXN5XFkS3qQCfFi56Uuny+rThhzLSXQ4x1w9trW0r45SsFZ2IfYxPqe9HAVXA/GLNoneE7DxcCmPlVxEutmuJJKW/Ppk/mpSi903K2Xmz1mk2VwuLluaS56l0Bl2hlYbNVeXsvBiZLDMm0cEAC1Y20jT2XvvgY97aw0Xqeb2NRTpSQO5ZTqTw+SETInKvqHw+T5To8fQmIsSOlEyhFS4706VX45mAys0rEn0Fx8XPX58wdafPdHxrDL+/RHcgU01MO9ddU3j0PPtmoCWRM11H3/S813TlBV1kvDMjVXQXmsQSVVIbA4lG3Q961cUmkkIMYA2QPS/lMV0iJPxNgOKv6snwkhJJbylPk8EixcEFwPfq5VWLB71ZTn4RWJA2P78SLr0cBY4hYjNLBsm6tZ2kVLYws0+tNSwTmwYkVQ9ldbdc0qW1oQilGhcSmxvyIzccrYVwyiGcmrEK0mX03fpqFgUx4a86mcd55fSfET4pEEHvr9CujxDIr7dgIC4zIDJHX6yYKxOTKNd68G7NVsuAIAuT8Ll+beyihxNx0O1HazsP6V+hyLZU0p86pmtA7g8+lsE6wMAXAtnIWASbmsnYlm3dOilYUiHOAjPBk9+U15fJgU7VKZpzy8TMHbUfXlEjLB+OVmuHZLjE81sYCDFhSCFc6dR3RBjFWegVCTUyI0vOPvnVLUXZ+mB5LJM0zotG8rbps1OfC9sd9st/W0ScMDJwGc8Wkti+UEgjcbb3rSPziF281x1dSuSiktt8e0r//oBsWj+WXzOleyQC8Ob3ELAEruZ7QknYLv15j5T1fpkwazwcF0XSP6nWq0dJ7BmSi13Fqb5gxgOgony8HgeHcqEpfVdLZPm9IgL8fU91dV/Zc6Gyt8Ei/7s15LOL+SKOrz6uH6SoL0D7Og5TxU7ff0Nt2fMsAswOtI0pLNJCFoALuRjTmkESfuKlL8W5v9RbmA3xgcJdY3fLxYOZ13+JpurEYvGRMrvB3kdu8NAmd6ntyWo6pTxhjx535o5QhIPoARUbvehI3j0tlQ8FVurQ4yTQuEQ2hhhuXRZl6anu2n/9IpUDdW28K+nNYgwP3jskcu0GPd3lw6C0vrTWk3a7lOp7gqznZOM4/C2/4yTGVkQGGQ+j6QD37CceKlf32onIqFFGYyI2PFJ69ONntt7nSRKiNAmwFtmU/lQcbdkvi5rVaH0dwiMowI6eGdqvPx+6volCuZqU4i1/czZFdtdHeRMzgYP+w5BfzCK1qUnQ1L98mpvaw7+18aTV1PICawTOJBDNY5JU/6ugTNaZTVUGN+zmTSnik4wb+xWZhmee80JLW89qsvK8crIL5xPxO2oBgOrmdiITcYLXGUTu5fujNy8t7XcFG1WlKUBpaOc8gH6Q3oxXmuxfJbV1wPfNLB9WntX0FUFHirUHnx6O1P1hd3AgxU4HJ1+X4/XK2aN6WGEDS1Bo3mkFm1EnAaqXDp8TZuFG5Wt4gHtMoj4MBopL5fLiIrPUKUi50KV1hfZB582SQe2LVCA8Pm9Agazty1GBX2m8hZ8WuXJo+WUz1aP1X6RQQHAgUZ2mjxiSe/OoHQUz2zly+mSf4DmgA8gcifmh/xZNwVjPoJG537s72z02Shhqd+iuYBN8Wffuapnffadcd7rtcMR6320eK7AMSB9OEKYkiL5bn1oVSMT/FjuPhCzBMyRiUkOoD4eV9d0Flro7bKNi+wcYIbF709Jj27BssA7qIwoLjts87IprWepyiualWqzHdCkM600B5l+yEVFyr+FAMN5KV12HbaWeBXm/e0QiwgSwnu8bw6a1O+dWHoBH8X9nqPsziVwdETVOZl5HzSbG5HPg+8Gr1+ceDmvLB4EUA7hSZKutssp/dsiIPoTJSHE/eTWPSPzo6oapNJs7KWA8bLcEJD9bo/khYnAxaV04ffVmF1srFa5qjHcjLZs6i7j6VrozTQqu8kEoNyf9pyw6rirDWI0iIF0VwwpVTSqQ93hCNof0jl9pXOBMonqVFJo3Ws/eAfZq1aPHxmwzvzwG4MnjiWhI6XA8tZhYrLlXgXhBoJct7//ok5xFCDbuX+1q/Zxg4FinKS822EeGzHE3szsTyoNV5dktfOYJtt6+RGaqXwiHwdVZ9H55fJ4rYyxZrNZQnkclzevw1XLee31d2jatWEFV043AL+FW6jMB2MnF/D+5dqSe6tmp4Qnoe3QjZqpZd00pfRmWsnciVqvGk0nA5yPW6jvks/oqtq/1J0ljIKneNhB1Hwv/8HdonpeFVBAAA='
TARGETS=json.loads(gzip.decompress(base64.b64decode(B64)).decode())
S=requests.Session(); S.headers.update({'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/151 Safari/537.36','Accept-Language':'pt-BR,pt;q=0.9,en;q=0.7'})

def get(url,**kw):
    if not url:return None
    for a in range(3):
        try:
            r=S.get(url,timeout=22,allow_redirects=True,**kw)
            if r.status_code in (429,503): time.sleep(1.4*(a+1)+random.random()); continue
            return r
        except requests.RequestException:
            if a==2:return None
            time.sleep(.8*(a+1)+random.random()/2)

def norm(u): return html.unescape(str(u or '')).replace('\\/','/').strip(' \"\\\'')
def mlimg(u):
    try:
        p=urlparse(u); return p.scheme in ('http','https') and bool(p.hostname) and p.hostname.endswith('mlstatic.com') and 'D_NQ_NP_' in p.path
    except:return False

def api_img(item,product):
    for kind,url in ([('item',f'https://api.mercadolibre.com/items/{item}')] if item else [])+([('product',f'https://api.mercadolibre.com/products/{product}')] if product else []):
        r=get(url,headers={'Accept':'application/json'})
        if not r or not r.ok:continue
        try:j=r.json()
        except:continue
        pics=j.get('pictures') or []
        cand=[]
        for p in pics:
            if isinstance(p,str):cand.append(p)
            elif isinstance(p,dict):cand += [p.get('secure_url'),p.get('url')]
        cand += [j.get('secure_thumbnail'),j.get('thumbnail')]
        for u in map(norm,cand):
            if mlimg(u):return u,kind,url
    return None,None,None

def page_img(offer):
    if not offer:return None,None,None
    r=get(offer)
    if not r or not r.ok:return None,None,None
    t=r.text; c=[]
    c += re.findall(r'<meta[^>]+property=[\"\\\']og:image(?::secure_url)?[\"\\\'][^>]+content=[\"\\\']([^\"\\\']+)',t,re.I)
    c += re.findall(r'<meta[^>]+content=[\"\\\']([^\"\\\']+)[\"\\\'][^>]+property=[\"\\\']og:image(?::secure_url)?[\"\\\']',t,re.I)
    c += re.findall(r'https?:\\?/\\?/(?:http2\\.)?mlstatic\\.com/[^\"\\\'<>\\s]+',t,re.I)
    for u in map(norm,c):
        if mlimg(u):return u,'page',r.url
    return None,None,None

def jina_img(offer):
    if not offer:return None,None,None
    r=get('https://r.jina.ai/'+offer,headers={'Accept':'text/plain','X-Retain-Images':'all'})
    if not r or not r.ok:return None,None,None
    for u in map(norm,re.findall(r'https?://(?:http2\\.)?mlstatic\\.com/[^\\s)\"\\\'<>\\]]+',r.text,re.I)):
        if mlimg(u):return u,'jina',offer
    return None,None,None

def verify(url):
    try:
        r=S.get(url,timeout=15,stream=True,headers={'Range':'bytes=0-2047','Referer':'https://www.mercadolivre.com.br/'})
        ok=r.status_code in (200,206) and (r.headers.get('content-type') or '').lower().startswith('image/'); r.close(); return ok
    except:return False

def resolve(ix,row):
    item,product,offer=row
    out={'index':ix,'status':'failed','image':'','method':'','source':'','item':item,'product':product,'offer':offer}
    for fn,args in ((api_img,(item,product)),(page_img,(offer,)),(jina_img,(offer,))):
        try:u,m,s=fn(*args)
        except Exception:u=m=s=None
        if u and verify(u): out.update(status='resolved',image=u,method=m,source=s); return out
    return out

def main():
    results=[]
    with ThreadPoolExecutor(max_workers=5) as ex:
        futs={ex.submit(resolve,i,r):i for i,r in enumerate(TARGETS)}
        for n,f in enumerate(as_completed(futs),1):
            x=f.result(); results.append(x)
            if n%20==0 or x['status']=='failed':print(f'[{n}/{len(TARGETS)}] {x[\"status\"]} #{x[\"index\"]} {x[\"method\"]}',flush=True)
    results.sort(key=lambda x:x['index']); resolved=sum(x['status']=='resolved' for x in results)
    payload={'version':'V17.3.3','total':len(results),'resolved':resolved,'failed':len(results)-resolved,'results':results}
    with open('resolved-images-v1733.json','w',encoding='utf-8') as f:json.dump(payload,f,ensure_ascii=False,indent=2)
    with open('resolved-images-v1733.csv','w',encoding='utf-8',newline='') as f:
        w=csv.DictWriter(f,fieldnames=['index','status','method','image','source','item','product','offer']); w.writeheader(); w.writerows(results)
    print(json.dumps({k:payload[k] for k in ('total','resolved','failed')}))
if __name__=='__main__':main()
