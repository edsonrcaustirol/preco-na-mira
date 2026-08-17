#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ORIGIN = 'https://preconamira.com.br';
const DATA_FILE = path.join(ROOT, 'data', 'produtos-mobile.js');
const CATALOG_PAGE_SIZE = 24;
const OFFER_PAGE_SIZE = 24;
const HOME_HIGHLIGHTS = 6;

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));
const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function readProducts() {
  if (!fs.existsSync(DATA_FILE)) throw new Error(`Arquivo não encontrado: ${path.relative(ROOT, DATA_FILE)}`);
  const source = fs.readFileSync(DATA_FILE, 'utf8');
  const marker = source.search(/\b(?:const|let|var)\s+PRODUTOS\s*=/);
  if (marker < 0) throw new Error('Não foi possível localizar PRODUTOS em data/produtos-mobile.js.');
  const start = source.indexOf('[', marker);
  const end = source.lastIndexOf(']');
  if (start < 0 || end <= start) throw new Error('Array PRODUTOS inválido em data/produtos-mobile.js.');
  const parsed = JSON.parse(source.slice(start, end + 1));
  if (!Array.isArray(parsed) || !parsed.length) throw new Error('PRODUTOS está vazio.');
  return parsed;
}

function between(content, startMarker, endMarker, replacement) {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker);
  if (start < 0 || end < start) throw new Error(`Marcadores ausentes: ${startMarker} / ${endMarker}`);
  return `${content.slice(0, start + startMarker.length)}${replacement}${content.slice(end)}`;
}

function productUrl(product) {
  return `produto-${encodeURIComponent(product.id)}`;
}

function imageAttrs(product, index) {
  const src = product.imagem || product.imagemFallback || 'assets/product-placeholder.svg';
  const fallback = product.imagemFallback || 'assets/product-placeholder.svg';
  const loading = index === 0 ? 'eager' : 'lazy';
  const priority = index === 0 ? ' fetchpriority="high"' : '';
  return `src="${esc(src)}" data-fallback-src="${esc(fallback)}" width="600" height="600" loading="${loading}" decoding="async"${priority} alt="${esc(product.imagemAlt || product.nome)}"`;
}

function catalogCard(product, index) {
  return `<article class="pnm-product-card" data-pnm-product-id="${esc(product.id)}"><a class="pnm-product-photo" href="${productUrl(product)}"><img ${imageAttrs(product, index)}></a><div class="pnm-product-copy"><div class="pnm-product-top"><span>${esc(product.marca || 'Produto')}</span>${product.destaque ? '<b>DESTAQUE</b>' : ''}</div><h2>${esc(product.nome)}</h2><p>${esc(product.resumo || product.chamada || product.categoria || 'Veja detalhes, contexto e oferta.')}</p><div class="pnm-product-actions"><a href="${productUrl(product)}">ANALISAR</a><a class="offer" href="${esc(product.linkAfiliado || '#')}" target="_blank" rel="sponsored nofollow noopener noreferrer" aria-label="Ver ${esc(product.nome)} no Mercado Livre — abre em nova aba">VER NO MERCADO LIVRE ↗</a></div></div></article>`;
}

function safeOfferLabel(product) {
  const candidates = [product.selo, product.faixa].filter(Boolean);
  const allowed = /custo|benef[ií]cio|premium|intermedi|entrada|destaque|escolha|selecion|recomend/i;
  return String(candidates.find(value => allowed.test(String(value))) || (product.destaque ? 'DESTAQUE' : 'SELECIONADO'));
}

function offerCard(product, index) {
  return `<article class="pnm-offer-card" data-pnm-product-id="${esc(product.id)}"><div class="pnm-offer-image"><img ${imageAttrs(product, index)}><span>${esc(safeOfferLabel(product))}</span></div><div class="pnm-offer-copy"><small>${esc(product.marca || product.categoria || 'Produto')}</small><h3>${esc(product.nome)}</h3><p>${esc(product.chamada || product.resumo || 'Veja a análise e confirme se esta opção combina com o que você procura.')}</p><div><a href="${productUrl(product)}">ANALISAR</a><a class="hot" href="${esc(product.linkAfiliado || '#')}" target="_blank" rel="sponsored nofollow noopener noreferrer" aria-label="Ver ${esc(product.nome)} no Mercado Livre — abre em nova aba">VER NO MERCADO LIVRE ↗</a></div></div></article>`;
}

function hasUsefulImage(product) {
  const image = String(product?.imagem || '');
  return product?.imagemTipo === 'oficial' || /\.(?:webp|png|jpe?g|avif)(?:\?|$)/i.test(image);
}
function highlightLabel(product) {
  return product?.selo || product?.faixa || (product?.destaque ? 'Destaque selecionado' : 'Boa opção');
}
function chooseHighlights(products, limit = HOME_HIGHLIGHTS) {
  const eligible = products
    .filter(product => product?.linkAfiliado && (product.destaque || product.faixa || product.selo))
    .sort((a, b) => (b.destaque ? 1 : 0) - (a.destaque ? 1 : 0) || (hasUsefulImage(b) ? 1 : 0) - (hasUsefulImage(a) ? 1 : 0) || String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
  const pool = eligible.length ? eligible : products.filter(product => product?.linkAfiliado);
  const selected = [];
  const types = new Map();
  const brands = new Map();
  for (const product of pool) {
    const type = String(product.tipoProduto || 'outro');
    const brand = norm(product.marca || '');
    if ((types.get(type) || 0) >= 2 || (brand && (brands.get(brand) || 0) >= 1)) continue;
    selected.push(product);
    types.set(type, (types.get(type) || 0) + 1);
    if (brand) brands.set(brand, (brands.get(brand) || 0) + 1);
    if (selected.length >= limit) break;
  }
  for (const product of pool) {
    if (selected.length >= limit) break;
    if (!selected.some(item => item.id === product.id)) selected.push(product);
  }
  return selected;
}
function homeCard(product, index) {
  const category = product.categoria || product.tipoProduto || 'Produto';
  return `<article class="smart-ad-card" data-pnm-product-id="${esc(product.id)}"><div class="smart-ad-inner is-compact"><a class="smart-ad-media" href="${productUrl(product)}" aria-label="Analisar ${esc(product.nome)}"><span class="smart-ad-kicker">${esc(highlightLabel(product))}</span><img ${imageAttrs(product, index)}></a><div class="smart-ad-copy"><small>${esc(product.marca || 'Marca')} • ${esc(category)}</small><h3>${esc(product.nome)}</h3><p>${esc(product.chamada || product.resumo || 'Veja a análise e confira se esta opção faz sentido para você.')}</p><div class="smart-ad-actions"><a href="${productUrl(product)}">ANALISAR →</a><a class="offer" href="${esc(product.linkAfiliado)}" target="_blank" rel="sponsored nofollow noopener noreferrer" aria-label="Ver ${esc(product.nome)} no Mercado Livre — abre em nova aba">VER NO MERCADO LIVRE ↗</a></div></div></div></article>`;
}

function pagePath(kind, page) {
  return page <= 1 ? kind : `${kind}-pagina-${page}`;
}
function absolutePageUrl(kind, page) {
  return `${ORIGIN}/${pagePath(kind, page)}`;
}
function pagination(kind, page, totalPages, label) {
  if (totalPages <= 1) return '';
  const prev = page > 1 ? `<a rel="prev" href="${pagePath(kind, page - 1)}">← ANTERIOR</a>` : '<span aria-hidden="true"></span>';
  const next = page < totalPages ? `<a rel="next" href="${pagePath(kind, page + 1)}">PRÓXIMA →</a>` : '<span aria-hidden="true"></span>';
  const nearby = [];
  for (let current = Math.max(1, page - 2); current <= Math.min(totalPages, page + 2); current += 1) {
    nearby.push(current === page
      ? `<strong aria-current="page">${current}</strong>`
      : `<a href="${pagePath(kind, current)}" aria-label="${esc(label)} — página ${current}">${current}</a>`);
  }
  return `<nav class="pnm-seo-pagination" aria-label="Paginação de ${esc(label)}">${prev}<span class="pnm-seo-pages">${nearby.join('')}</span><span class="pnm-seo-page-status">Página ${page} de ${totalPages}</span>${next}</nav>`;
}

function itemListSchema(items, kind, page, pageSize, name) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    itemListElement: items.map((product, index) => ({
      '@type': 'ListItem',
      position: (page - 1) * pageSize + index + 1,
      url: `${ORIGIN}/${productUrl(product)}`,
      name: product.nome,
    })),
  };
  return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}

function headSeo(kind, page, totalPages, items, pageSize, titleBase) {
  const tags = [];
  if (page > 1) tags.push(`<link rel="prev" href="${absolutePageUrl(kind, page - 1)}">`);
  if (page < totalPages) tags.push(`<link rel="next" href="${absolutePageUrl(kind, page + 1)}">`);
  tags.push(itemListSchema(items, kind, page, pageSize, `${titleBase} — página ${page}`));
  return `\n${tags.join('\n')}\n`;
}

function updatePageMeta(html, kind, page, titleBase) {
  const canonical = absolutePageUrl(kind, page);
  const title = page === 1 ? titleBase : `${titleBase} — Página ${page}`;
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${esc(title)}</title>`);
  html = html.replace(/<link\b(?=[^>]*\brel=(?:"canonical"|'canonical'))[^>]*>/i, `<link rel="canonical" href="${canonical}">`);
  html = html.replace(/<meta\b(?=[^>]*\bproperty=(?:"og:url"|'og:url'))[^>]*>/i, `<meta property="og:url" content="${canonical}">`);
  html = html.replace(/<meta\b(?=[^>]*\bproperty=(?:"og:title"|'og:title'))[^>]*>/i, `<meta property="og:title" content="${esc(title)}">`);
  html = html.replace(/<meta\b(?=[^>]*\bname=(?:"twitter:title"|'twitter:title'))[^>]*>/i, `<meta name="twitter:title" content="${esc(title)}">`);
  return html;
}

function generateListing({ kind, templateFile, products, pageSize, card, titleBase, label }) {
  const templatePath = path.join(ROOT, templateFile);
  const base = fs.readFileSync(templatePath, 'utf8');
  const totalPages = Math.max(1, Math.ceil(products.length / pageSize));
  for (const old of fs.readdirSync(ROOT).filter(name => new RegExp(`^${kind}-pagina-\\d+\\.html$`).test(name))) {
    fs.unlinkSync(path.join(ROOT, old));
  }
  for (let page = 1; page <= totalPages; page += 1) {
    const start = (page - 1) * pageSize;
    const items = products.slice(start, start + pageSize);
    let html = updatePageMeta(base, kind, page, titleBase);
    html = between(html, '<!-- PNM:SEO:HEAD:START -->', '<!-- PNM:SEO:HEAD:END -->', headSeo(kind, page, totalPages, items, pageSize, titleBase));
    html = between(html, `<!-- PNM:SEO:${kind.toUpperCase()}:START -->`, `<!-- PNM:SEO:${kind.toUpperCase()}:END -->`, `\n${items.map((product, index) => card(product, index)).join('\n')}\n`);
    html = between(html, `<!-- PNM:SEO:${kind.toUpperCase()}:PAGINATION:START -->`, `<!-- PNM:SEO:${kind.toUpperCase()}:PAGINATION:END -->`, `\n${pagination(kind, page, totalPages, label)}\n`);
    html = html.replace(new RegExp(`data-pnm-static-page="\\d+"`, 'g'), `data-pnm-static-page="${page}"`);
    const output = page === 1 ? templatePath : path.join(ROOT, `${kind}-pagina-${page}.html`);
    fs.writeFileSync(output, html);
  }
  return totalPages;
}

function generateHome(products) {
  const file = path.join(ROOT, 'index.html');
  let html = fs.readFileSync(file, 'utf8');
  const highlights = chooseHighlights(products, HOME_HIGHLIGHTS);
  html = between(html, '<!-- PNM:SEO:HOME-HIGHLIGHTS:START -->', '<!-- PNM:SEO:HOME-HIGHLIGHTS:END -->', `\n${highlights.map((product, index) => homeCard(product, index)).join('\n')}\n`);
  html = html.replace('id="homeOfferGrid" aria-live="polite"', 'id="homeOfferGrid" aria-live="polite" data-pnm-prerendered="1"');
  fs.writeFileSync(file, html);
  return highlights.length;
}

function validate(products, catalogCount, offerCount, homeCount) {
  const catalogHtml = fs.readFileSync(path.join(ROOT, 'catalogo.html'), 'utf8');
  const offersHtml = fs.readFileSync(path.join(ROOT, 'ofertas.html'), 'utf8');
  const homeHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const countCards = html => (html.match(/data-pnm-product-id=/g) || []).length;
  const minimumCatalog = Math.min(20, products.length);
  const availableOffers = products.filter(product => product?.linkAfiliado && (product.destaque || product.faixa || product.selo)).length;
  const minimumOffers = Math.min(20, availableOffers);
  if (countCards(catalogHtml) < minimumCatalog) throw new Error(`Catálogo prerenderizou menos de ${minimumCatalog} produtos.`);
  if (countCards(offersHtml) < minimumOffers) throw new Error(`Ofertas prerenderizou menos de ${minimumOffers} produtos.`);
  if (countCards(homeHtml) < Math.min(HOME_HIGHLIGHTS, products.length)) throw new Error('Destaques da Home não foram prerenderizados.');
  if (!catalogHtml.includes('VER NO MERCADO LIVRE')) throw new Error('CTA externo ausente no HTML inicial do catálogo.');
  if (catalogCount > 1 && !catalogHtml.includes('rel="next"')) throw new Error('Paginação rastreável do catálogo não foi gerada.');
  if (offerCount > 1 && !offersHtml.includes('rel="next"')) throw new Error('Paginação rastreável de ofertas não foi gerada.');
  return { catalogCards: countCards(catalogHtml), offerCards: countCards(offersHtml), homeCards: countCards(homeHtml) };
}

const products = readProducts();
const catalogProducts = [...products].sort((a, b) => (b.destaque ? 1 : 0) - (a.destaque ? 1 : 0) || String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
const offerProducts = products
  .filter(product => product?.linkAfiliado && (product.destaque || product.faixa || product.selo))
  .sort((a, b) => (b.destaque ? 1 : 0) - (a.destaque ? 1 : 0) || String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));

const catalogPages = generateListing({
  kind: 'catalogo', templateFile: 'catalogo.html', products: catalogProducts, pageSize: CATALOG_PAGE_SIZE,
  card: catalogCard, titleBase: 'Catálogo completo — Preço na Mira', label: 'Catálogo',
});
const offerPages = generateListing({
  kind: 'ofertas', templateFile: 'ofertas.html', products: offerProducts, pageSize: OFFER_PAGE_SIZE,
  card: offerCard, titleBase: 'Ofertas e destaques selecionados — Preço na Mira', label: 'Ofertas',
});
const homeHighlights = generateHome(products);
const validation = validate(products, catalogPages, offerPages, homeHighlights);

console.log(JSON.stringify({
  products: products.length,
  offers: offerProducts.length,
  catalogPages,
  offerPages,
  homeHighlights,
  ...validation,
}, null, 2));
