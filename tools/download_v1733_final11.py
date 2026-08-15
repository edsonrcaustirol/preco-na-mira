#!/usr/bin/env python3
from __future__ import annotations

import json
from io import BytesIO
from pathlib import Path
import requests
from PIL import Image

OUT = Path('v1733-final11')
OUT.mkdir(exist_ok=True)

PRODUCTS = [
    {
        'id': '4-filtro-refil-alltec-cmc1-voga-para-respirador',
        'name': '4 Filtro Refil Alltec CMC1 Voga para Respirador',
        'source': 'https://alltecbrasil.com.br/produto/filtro-cmc-vo-ga/',
        'urls': [
            'https://alltecbrasil.com.br/wp-content/uploads/2025/08/1-1-768x864.png',
            'https://alltecbrasil.com.br/wp-content/uploads/2025/08/1-1.png',
        ],
    },
    {
        'id': 'baseus-gan2-pro-carregador-65w-com-cabo-100w',
        'name': 'Baseus GaN2 Pro Carregador 65W com Cabo 100W',
        'source': 'https://www.baseus.com/products/gan2-3-ports-fast-charger-65w',
        'urls': [
            'https://www.baseus.com/cdn/shop/products/Baseus_GaN2_3_Ports_Fast_Charger_65W_Black_1_front_side.jpg?v=1667904127',
        ],
    },
    {
        'id': 'cooler-master-mwe-gold-750-v3-atx-3-1',
        'name': 'Cooler Master MWE Gold 750 V3 ATX 3.1',
        'source': 'https://www.coolermaster.com/en-global/products/mwe-gold-750-v3-atx-3-1.html',
        'urls': [
            'https://www.coolermaster.com/on/demandware.static/-/Sites-cooler-master-main/default/dw3791d61b/Assets/mwe-gold-750-v3-atx-3-1/large/mwe-gold-750-v3-atx-3-1-gallery-1.png',
        ],
    },
    {
        'id': 'huawei-ws8100-mesh-3',
        'name': 'Huawei WiFi Mesh 3 WS8100 AX3000',
        'source': 'https://consumer.huawei.com/br/routers/wifi-mesh3/',
        'urls': [
            'https://consumer.huawei.com/dam/content/dam/huawei-cbg-site/common/mkt/pdp/routers/wifi-mesh3/imgs/ksp/huawei-wifi-mesh-3-buy-1-2x.jpg',
        ],
    },
    {
        'id': 'hyperx-pulsefire-haste-2-pro',
        'name': 'HyperX Pulsefire Haste 2 Pro',
        'source': 'https://row.hyperx.com/pt-br/products/hyperx-pulsefire-haste-2-pro-4k-wireless-gaming-mouse',
        'urls': [
            'https://row.hyperx.com/cdn/shop/files/hyperx_pulsefire_haste_2_pro_4k_wireless_a1ky5aa_main_1.jpg?v=1785352630',
        ],
    },
    {
        'id': 'manta-asfaltica-aluminio-poliester-4mm-1m-x-10m-tipo2-dryko',
        'name': 'Manta Asfaltica Aluminio Poliester 4MM 1M X 10M TIPO2 Dryko',
        'source': 'https://dryko.com.br/en/produtos/drykomanta-polialum-tipo-ii/',
        'urls': [
            'https://dryko.com.br/wp-content/uploads/2025/09/MANTA-PA-PADRAO-site-600x600px-1-1.png',
        ],
    },
    {
        'id': 'manta-asfaltica-preta-poliester-4mm-1m-x-10m-tipo2-dryko-tp2',
        'name': 'Manta Asfaltica Preta Poliester 4MM 1M X 10M TIPO2 Dryko TP2',
        'source': 'https://dryko.com.br/produtos/drykomanta-flex/',
        'urls': [
            'https://dryko.com.br/wp-content/uploads/2025/09/Superflex_web.png',
        ],
    },
    {
        'id': 'positivo-smart-lamp-10w',
        'name': 'Positivo Casa Inteligente Smart Lâmpada Wi-Fi RGB 10W',
        'source': 'https://www.positivocasainteligente.com.br/smart-lampada-wi-fi-rgb--mais-11167878/p',
        'urls': [
            'https://positivocasainteligente.vteximg.com.br/arquivos/ids/157226/Pack_Lampada_Wifi10W.jpg?v=638146792971370000',
            'https://positivocasainteligente.vteximg.com.br/arquivos/ids/157226-1000-1000/Pack_Lampada_Wifi10W.jpg?v=638146792971370000',
            'https://positivocasainteligente.vteximg.com.br/arquivos/ids/157226-500-500/Pack_Lampada_Wifi10W.jpg?v=638146792971370000',
        ],
    },
    {
        'id': 'ring-video-doorbell-2nd',
        'name': 'Ring Video Doorbell 2ª Geração',
        'source': 'https://ring.com/au/en/products/video-doorbell-v2/',
        'urls': [
            'https://images.ctfassets.net/a3peezndovsu/variant-32649434791990/d30b3a37d3499876c435083bbb58529f/variant-32649434791990.jpg',
        ],
    },
    {
        'id': 'samsung-powerbot-e-vr5000',
        'name': 'Samsung POWERbot-E VR5000',
        'source': 'https://www.samsung.com/br/vacuum-cleaners/robot/robot-vr05r5050wk/',
        'urls': [
            'https://images.samsung.com/is/image/samsung/br-robot-vr05r5050wk-vr05r5050wk-az-frontblack-thumb-264017108?$624_624_PNG$',
            'https://images.samsung.com/is/image/samsung/br-robot-vr05r5050wk-vr05r5050wk-az-frontblack-thumb-264017108',
        ],
    },
    {
        'id': 'tramontina-paris-chumbo-7p',
        'name': 'Tramontina Paris Chumbo Jogo de Panelas 7 Peças',
        'source': 'https://www.tramontina.com.br/jogo-de-panelas-tramontina-paris-em-aluminio-com-revestimento-interno-e-externo-em-antiaderente-starflon-max-chumbo-07-pecas/28599617.html',
        'urls': [
            'https://assets.tramontina.com.br/upload/tramon/imagens/CUT/28599617PDM001G.jpg',
        ],
    },
]

session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/151 Safari/537.36',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.7',
})


def fetch_image(url: str):
    r = session.get(url, timeout=30, allow_redirects=True)
    r.raise_for_status()
    if len(r.content) < 5000:
        raise RuntimeError(f'conteúdo pequeno: {len(r.content)} bytes')
    im = Image.open(BytesIO(r.content))
    im.load()
    w, h = im.size
    if w < 250 or h < 250:
        raise RuntimeError(f'imagem pequena: {w}x{h}')
    if max(w, h) / max(1, min(w, h)) > 4.0:
        raise RuntimeError(f'proporção suspeita: {w}x{h}')
    return r, im


def save_webp(im: Image.Image, path: Path):
    if im.mode not in ('RGB', 'RGBA'):
        im = im.convert('RGBA' if 'A' in im.getbands() else 'RGB')
    im.save(path, format='WEBP', quality=91, method=6)


def main():
    manifest = []
    for i, p in enumerate(PRODUCTS, 1):
        print(f'[{i}/{len(PRODUCTS)}] {p["id"]}', flush=True)
        errors = []
        success = None
        for url in p['urls']:
            try:
                r, im = fetch_image(url)
                path = OUT / f'{p["id"]}.webp'
                save_webp(im, path)
                success = {
                    'id': p['id'],
                    'name': p['name'],
                    'source': p['source'],
                    'download_url': url,
                    'resolved_url': r.url,
                    'file': path.name,
                    'width': im.width,
                    'height': im.height,
                    'input_format': im.format,
                    'output_bytes': path.stat().st_size,
                }
                print(f'  OK {im.width}x{im.height} {im.format} -> {path}', flush=True)
                break
            except Exception as e:
                errors.append(f'{url}: {type(e).__name__}: {e}')
                print(f'  FAIL {url}: {e}', flush=True)
        if not success:
            raise RuntimeError(f'Falha em {p["id"]}: ' + ' | '.join(errors))
        manifest.append(success)
    (OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'total': len(manifest), 'ok': len(manifest)}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
