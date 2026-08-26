#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ORIGIN = 'https://preconamira.com.br';

function parseOwner() {
  const source = fs.readFileSync(path.join(ROOT, 'data', 'produtos-index.js'), 'utf8');
  const start = source.indexOf('[');
  const end = source.lastIndexOf(']');
  if (start < 0 || end <= start) throw new Error('Owner inválido.');
  return JSON.parse(source.slice(start, end + 1));
}

function clean(value = '') {
  return String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ').replace(/&ndash;/gi, '–').replace(/&mdash;/gi, '—')
    .replace(/\s+/g, ' ').trim();
}

function meta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`<meta\\b(?=[^>]*\\bname=(?:"${escaped}"|'${escaped}'))(?=[^>]*\\bcontent=(?:"([^"]*)"|'([^']*)'))[^>]*>`, 'i'));
  return match?.[1] || match?.[2] || '';
}

function canonical(html) {
  const match = html.match(/<link\b(?=[^>]*\brel=(?:"canonical"|'canonical'))(?=[^>]*\bhref=(?:"([^"]+)"|'([^']+)'))[^>]*>/i);
  return match?.[1] || match?.[2] || '';
}

function productJson(html, id) {
  const match = html.match(/<script\b[^>]*\bdata-pnm-jsonld=(?:"product"|'product')[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) throw new Error(`${id}: JSON-LD product ausente.`);
  let json;
  try { json = JSON.parse(match[1]); } catch { throw new Error(`${id}: JSON-LD product inválido.`); }
  const graph = Array.isArray(json?.['@graph']) ? json['@graph'] : [json];
  const product = graph.find(node => node?.['@type'] === 'Product');
  const breadcrumb = graph.find(node => node?.['@type'] === 'BreadcrumbList');
  if (!product) throw new Error(`${id}: Product schema ausente.`);
  if (!breadcrumb) throw new Error(`${id}: BreadcrumbList ausente.`);
  return { product, breadcrumb };
}

function normalizeUrl(value) {
  try {
    const url = new URL(String(value), ORIGIN);
    if (url.origin !== ORIGIN) return null;
    let pathname = url.pathname || '/';
    if (pathname.length > 1) pathname = pathname.replace(/\/+$/, '');
    return `${ORIGIN}${pathname}`;
  } catch { return null; }
}

function dataLevel(product) {
  const identity = Boolean(String(product.nome || '').trim());
  const brand = Boolean(String(product.marca || '').trim());
  const summary = Boolean(String(product.resumo || '').trim());
  const callout = Boolean(String(product.chamada || '').trim());
  const specs = Array.isArray(product.chips) && product.chips.filter(Boolean).length >= 2;
  const source = Boolean(String(product.fonteTecnica || '').trim());
  const image = Boolean(String(product.imagem || '').trim() && String(product.imagemAlt || '').trim());
  if (identity && brand && summary && callout && specs && source && image) return 'A';
  if (identity && brand && (summary || callout) && image) return 'B';
  return 'C';
}

const owner = parseOwner();
const ownerById = new Map(owner.map(item => [String(item.id), item]));
const productFiles = fs.readdirSync(ROOT).filter(name => /^produto-.+\.html$/i.test(name) && name !== 'produto.html').sort();
const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
const sitemapSet = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]));
const levels = { A: 0, B: 0, C: 0 };
const schemaClaims = { offers: 0, aggregateRating: 0, review: 0 };
let categoryBreadcrumbs = 0;
let catalogBreadcrumbs = 0;
let pagesWithRelatedLayoutMarker = 0;
const errors = [];

for (const fileName of productFiles) {
  const id = fileName.slice('produto-'.length, -'.html'.length);
  const product = ownerById.get(id);
  if (!product) { errors.push(`${id}: sem owner.`); continue; }
  const html = fs.readFileSync(path.join(ROOT, fileName), 'utf8');
  const expectedCanonical = `${ORIGIN}/produto-${id}`;
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(match => clean(match[1]));
  const title = clean((html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);
  const description = meta(html, 'description');
  const foundCanonical = canonical(html);
  const { product: schemaProduct, breadcrumb } = productJson(html, id);

  if (h1s.length !== 1 || h1s[0] !== String(product.nome || '').trim()) errors.push(`${id}: H1 não representa exatamente o owner.`);
  if (!title) errors.push(`${id}: title ausente.`);
  if (!description.trim()) errors.push(`${id}: meta description ausente.`);
  if (foundCanonical !== expectedCanonical) errors.push(`${id}: canonical divergente.`);
  if (schemaProduct.name !== product.nome) errors.push(`${id}: Product.name diverge do owner.`);
  if (normalizeUrl(schemaProduct.url) !== expectedCanonical) errors.push(`${id}: Product.url diverge do canonical.`);
  if (product.marca && schemaProduct.brand?.name && schemaProduct.brand.name !== product.marca) errors.push(`${id}: Product.brand diverge do owner.`);
  if (!schemaProduct.image || (Array.isArray(schemaProduct.image) && schemaProduct.image.length === 0)) errors.push(`${id}: Product.image ausente.`);

  if ('offers' in schemaProduct) schemaClaims.offers += 1;
  if ('aggregateRating' in schemaProduct) schemaClaims.aggregateRating += 1;
  if ('review' in schemaProduct) schemaClaims.review += 1;

  const imageTag = [...html.matchAll(/<img\b([^>]*)>/gi)].find(match => new RegExp(`\\bdata-pnm-product-id=(?:"${id}"|'${id}')`).test(match[1]));
  if (!imageTag || !/\balt=(?:"[^"]+"|'[^']+')/i.test(imageTag[1])) errors.push(`${id}: imagem principal/alt insuficiente.`);
  if (!html.includes(String(product.linkAfiliado || ''))) errors.push(`${id}: link afiliado do owner não foi preservado.`);

  const elements = Array.isArray(breadcrumb.itemListElement) ? breadcrumb.itemListElement : [];
  const middle = elements.find(item => Number(item?.position) === 2);
  const last = elements.find(item => Number(item?.position) === 3);
  const middleUrl = normalizeUrl(middle?.item);
  if (elements.length !== 3 || !middle?.name || !middleUrl || !sitemapSet.has(middleUrl)) errors.push(`${id}: breadcrumb intermediário não é factual/indexável.`);
  if (last?.name !== product.nome || normalizeUrl(last?.item) !== expectedCanonical) errors.push(`${id}: breadcrumb final diverge do produto.`);
  if (middleUrl === `${ORIGIN}/catalogo`) catalogBreadcrumbs += 1;
  else categoryBreadcrumbs += 1;

  const visualMatch = html.match(/<nav\b(?=[^>]*\bclass=(?:"[^"]*\bpnm-product-breadcrumb\b[^"]*"|'[^']*\bpnm-product-breadcrumb\b[^']*'))[^>]*>[\s\S]*?<a\b[^>]*href=(?:"([^"]+)"|'([^']+)')[^>]*>[\s\S]*?<\/a>[\s\S]*?<span\b[^>]*>[\s\S]*?<\/span>[\s\S]*?<a\b[^>]*href=(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/a>[\s\S]*?<span\b[^>]*>[\s\S]*?<\/span>[\s\S]*?<span\b[^>]*aria-current=(?:"page"|'page')[^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/nav>/i);
  if (!visualMatch) errors.push(`${id}: breadcrumb visual ausente.`);
  else {
    const visualMiddleUrl = normalizeUrl(visualMatch[3] || visualMatch[4]);
    const visualMiddleName = clean(visualMatch[5]);
    const visualProductName = clean(visualMatch[6]);
    if (visualMiddleUrl !== middleUrl || visualMiddleName !== middle.name || visualProductName !== product.nome) errors.push(`${id}: breadcrumb visual diverge do schema.`);
  }

  if (/class=(?:"[^"]*\brelated-block\b|"[^"]*\brelated-grid\b|'[^']*\brelated-block\b|'[^']*\brelated-grid\b)/i.test(html)) pagesWithRelatedLayoutMarker += 1;
  levels[dataLevel(product)] += 1;
}

if (productFiles.length !== owner.length) errors.push(`Quantidade de páginas ${productFiles.length} != owner ${owner.length}.`);
if (levels.C > 0) errors.push(`${levels.C} produto(s) nível C exigem fila de enriquecimento antes de conteúdo programático.`);
if (schemaClaims.offers || schemaClaims.aggregateRating || schemaClaims.review) {
  errors.push(`Schema comercial/editorial não comprovado detectado: offers=${schemaClaims.offers}, aggregateRating=${schemaClaims.aggregateRating}, review=${schemaClaims.review}.`);
}

const result = {
  m2cProductSeo: errors.length ? 'FAIL' : 'PASS',
  owner: 'data/produtos-index.js',
  products: owner.length,
  pages: productFiles.length,
  levels,
  categoryBreadcrumbs,
  catalogBreadcrumbs,
  relatedLayoutMarkerScope: 'classes related-block/related-grid; não representa total de páginas nem total de CTAs related',
  pagesWithRelatedLayoutMarker,
  pagesWithoutRelatedLayoutMarker: productFiles.length - pagesWithRelatedLayoutMarker,
  schemaClaims,
  affiliateLinksPreserved: errors.every(error => !error.includes('link afiliado')),
  inventedCommercialSchema: Boolean(schemaClaims.offers || schemaClaims.aggregateRating || schemaClaims.review),
  errors,
};
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;
