const ALLOWED_HOST = host => host === 'meli.la' || host === 'mercadolivre.com.br' || host.endsWith('.mercadolivre.com.br');
const MAX_REDIRECTS = 6;
const MAX_HTML_CHARS = 2_500_000;

function text(value) { return String(value ?? '').replace(/\s+/g, ' ').trim(); }
function decodeHtml(value) {
  return text(String(value ?? '')
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))));
}
function safeUrl(raw) {
  let url;
  try { url = new URL(text(raw)); } catch { throw new Error('INVALID_URL'); }
  if (url.protocol !== 'https:' || !ALLOWED_HOST(url.hostname.toLowerCase()) || url.username || url.password || url.port) throw new Error('UNSUPPORTED_MERCADO_LIVRE_URL');
  return url;
}
function meta(html, key) {
  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${esc}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${esc}["'][^>]*>`, 'i'),
  ];
  for (const re of patterns) { const match = html.match(re); if (match) return decodeHtml(match[1]); }
  return '';
}
function titleTag(html) { const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i); return m ? decodeHtml(m[1].replace(/<[^>]+>/g, ' ')) : ''; }
function jsonLd(html) {
  const out = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html))) {
    try {
      const value = JSON.parse(match[1]);
      if (Array.isArray(value)) out.push(...value); else if (value) out.push(value);
    } catch {}
  }
  const flat = [];
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    flat.push(value);
    if (Array.isArray(value['@graph'])) value['@graph'].forEach(visit);
  };
  out.forEach(visit);
  return flat;
}
function productNode(nodes) { return nodes.find(node => node?.['@type'] === 'Product' || (Array.isArray(node?.['@type']) && node['@type'].includes('Product'))) || {}; }
function cleanName(value) {
  let name = text(value).replace(/\s*[|\-–—]\s*Mercado\s*Livre.*$/i, '').trim();
  // Mercado Livre sometimes duplicates the title in rendered text; keep only the first exact repetition.
  const half = Math.floor(name.length / 2);
  if (half > 25) {
    for (let i = Math.max(25, half - 8); i <= Math.min(name.length - 25, half + 8); i++) {
      const left = name.slice(0, i).trim();
      const right = name.slice(i).trim();
      if (right.startsWith(left)) { name = left; break; }
    }
  }
  return name.slice(0, 180).trim();
}
function cleanDescription(value, name) {
  let description = text(value).replace(/Comprar|Compre|Mercado Livre/gi, '').replace(/\s+/g, ' ').trim();
  if (!description || description.length < 35) description = `${name}. Confira características, disponibilidade e condições no Mercado Livre.`;
  return description.slice(0, 320).trim();
}
function firstImage(value) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate && typeof candidate === 'object') return text(candidate.url || candidate.contentUrl);
  return text(candidate);
}
function inferBrand(name, node) {
  const explicit = typeof node?.brand === 'string' ? node.brand : node?.brand?.name;
  if (text(explicit)) return text(explicit).slice(0, 80);
  const known = ['Samsung','LG','Electrolux','Mondial','Philco','Elgin','Bosch','DeWalt','Makita','Xiaomi','Motorola','Apple','Acer','Asus','Lenovo','JBL','Mercusys','TP-Link','Tramontina','WAP','Midea','Oster','Arno','Britânia'];
  return known.find(brand => new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(name)) || '';
}
function inferCategory(name, node, html) {
  const explicit = text(node?.category);
  if (explicit) return explicit.slice(0, 120);
  const breadcrumb = jsonLd(html).find(x => x?.['@type'] === 'BreadcrumbList');
  const items = Array.isArray(breadcrumb?.itemListElement) ? breadcrumb.itemListElement : [];
  const names = items.map(item => text(item?.name || item?.item?.name)).filter(Boolean);
  if (names.length) return names.at(-2) || names.at(-1);
  const n = name.toLowerCase();
  if (/costur/.test(n)) return 'Casa';
  if (/air\s*fryer|fritadeira|cafeteira|liquidificador|micro-ondas|forno/.test(n)) return 'Cozinha';
  if (/furadeira|parafusadeira|serra|esmerilhadeira|martelete/.test(n)) return 'Ferramentas';
  if (/smartphone|celular|iphone|galaxy/.test(n)) return 'Celulares';
  if (/notebook|monitor|placa de v[ií]deo|processador|ssd|mem[oó]ria/.test(n)) return 'Tecnologia';
  return '';
}

export async function enrichMercadoLivreProduct(rawUrl, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') return { ok: false, code: 'FETCH_UNAVAILABLE' };
  const original = safeUrl(rawUrl);
  let current = original;
  let response;
  for (let step = 0; step <= MAX_REDIRECTS; step++) {
    response = await fetchImpl(current.href, {
      method: 'GET', redirect: 'manual',
      headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': 'PrecoNaMira-Central/1.0 (+https://preconamira.com.br)' },
    });
    if ([301,302,303,307,308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location || step === MAX_REDIRECTS) return { ok: false, code: 'REDIRECT_FAILED' };
      current = safeUrl(new URL(location, current).href);
      continue;
    }
    break;
  }
  if (!response?.ok) return { ok: false, code: 'MERCADO_LIVRE_FETCH_FAILED', status: response?.status || 0 };
  const html = (await response.text()).slice(0, MAX_HTML_CHARS);
  const nodes = jsonLd(html);
  const product = productNode(nodes);
  const name = cleanName(product?.name || meta(html, 'og:title') || titleTag(html));
  const image = firstImage(product?.image) || meta(html, 'og:image') || meta(html, 'twitter:image');
  const brand = inferBrand(name, product);
  const categoryHint = inferCategory(name, product, html);
  const description = cleanDescription(product?.description || meta(html, 'og:description') || meta(html, 'description'), name);
  if (!name || !image) return { ok: false, code: 'PRODUCT_METADATA_INCOMPLETE', partial: { name, image, brand, categoryHint } };
  return {
    ok: true,
    source: 'mercado-livre-page',
    originalUrl: original.href,
    resolvedUrl: current.href,
    data: {
      nome: name,
      marca: brand,
      categoriaHint: categoryHint,
      imagem: image,
      imagemAlt: name,
      resumo: description,
    },
  };
}
