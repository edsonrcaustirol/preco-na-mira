#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://preconamira.com.br';
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function parseProducts() {
  const source = read('data/produtos-index.js');
  const start = source.indexOf('[');
  const end = source.lastIndexOf(']');
  assert.ok(start >= 0 && end > start, 'owner canônico inválido');
  return JSON.parse(source.slice(start, end + 1));
}

function metaContent(html, key, attr = 'name') {
  const re = new RegExp(`<meta\\b(?=[^>]*\\b${attr}=["']${key}["'])[^>]*\\bcontent=["']([^"']+)["'][^>]*>`, 'i');
  const reverse = new RegExp(`<meta\\b(?=[^>]*\\bcontent=["']([^"']+)["'])[^>]*\\b${attr}=["']${key}["'][^>]*>`, 'i');
  return html.match(re)?.[1] || html.match(reverse)?.[1] || null;
}

const products = parseProducts();
assert.ok(products.length >= 600, `catálogo inesperadamente pequeno: ${products.length}`);
assert.equal(new Set(products.map(p => p.id)).size, products.length, 'IDs duplicados');
assert.equal(new Set(products.map(p => p.linkAfiliado)).size, products.length, 'links afiliados duplicados');
assert.equal(products.every(p => String(p.imagem || '').trim() && !/product-(?:placeholder|photo-unavailable)/i.test(String(p.imagem))), true, 'produto sem imagem útil no owner');

const mobileSource = read('data/produtos-mobile.js');
const mobileStart = mobileSource.indexOf('['), mobileEnd = mobileSource.lastIndexOf(']');
const mobile = JSON.parse(mobileSource.slice(mobileStart, mobileEnd + 1));
assert.equal(mobile.length, products.length, 'mobile divergente do owner');

let malformedSocialImages = 0;
let missingCanonical = 0;
let missingAffiliateTarget = 0;
let missingProductPages = 0;
for (const product of products) {
  const relative = `produto-${product.id}.html`;
  const absolutePath = path.join(ROOT, relative);
  if (!fs.existsSync(absolutePath)) { missingProductPages += 1; continue; }
  const html = fs.readFileSync(absolutePath, 'utf8');
  const canonical = `${ORIGIN}/produto-${product.id}`;
  if (!html.includes(`href="${canonical}"`) && !html.includes(`href='${canonical}'`)) missingCanonical += 1;
  const ogImage = metaContent(html, 'og:image', 'property');
  const twitterImage = metaContent(html, 'twitter:image', 'name');
  for (const image of [ogImage, twitterImage].filter(Boolean)) {
    if (/^https:\/\/preconamira\.com\.br\/https?:\/\//i.test(image)) malformedSocialImages += 1;
  }
  if (!html.includes(`href="${product.linkAfiliado}"`) && !html.includes(`href='${product.linkAfiliado}'`)) missingAffiliateTarget += 1;
  assert.match(html, /rel=["'][^"']*sponsored[^"']*nofollow[^"']*noopener[^"']*noreferrer[^"']*["']/i, `rel afiliado incompleto: ${product.id}`);
  assert.match(html, /<meta\b[^>]*name=["']description["']/i, `description ausente: ${product.id}`);
  assert.match(html, /data-pnm-jsonld=["']product["']/i, `Product JSON-LD ausente: ${product.id}`);
}
assert.equal(missingProductPages, 0, 'páginas de produto ausentes');
assert.equal(missingCanonical, 0, 'canonical ausente em produto');
assert.equal(malformedSocialImages, 0, 'imagem social absoluta malformada');
assert.equal(missingAffiliateTarget, 0, 'link afiliado do owner ausente da página de produto');

const home = read('index.html');
const catalog = read('catalogo.html');
const offers = read('ofertas.html');
for (const [name, html] of [['home', home], ['catalogo', catalog], ['ofertas', offers]]) {
  assert.match(html, /<meta\b[^>]*name=["']viewport["']/i, `viewport ausente: ${name}`);
  assert.match(html, /<link\b[^>]*rel=["']canonical["']/i, `canonical ausente: ${name}`);
  assert.match(html, /<meta\b[^>]*(?:property|name)=["']og:image["']/i, `og:image ausente: ${name}`);
}
assert.ok((home.match(/data-pnm-product-id=/g) || []).length >= 6, 'Home sem 6 destaques prerenderizados');
assert.ok((catalog.match(/data-pnm-product-id=/g) || []).length >= 24, 'Catálogo sem primeiro lote prerenderizado');
assert.ok((offers.match(/data-pnm-product-id=/g) || []).length >= 20, 'Ofertas sem curadoria prerenderizada suficiente');

const sitemap = read('sitemap.xml');
assert.match(sitemap, /<urlset\b/);
for (const product of products) assert.ok(sitemap.includes(`${ORIGIN}/produto-${product.id}`), `produto fora do sitemap: ${product.id}`);
const robots = read('robots.txt');
assert.match(robots, /Sitemap:\s*https:\/\/preconamira\.com\.br\/sitemap\.xml/i);
assert.match(robots, /User-agent:\s*\*/i);
assert.match(robots, /Allow:\s*\//i);

const catalogJs = read('assets/pages/catalogo-1.js');
assert.match(catalogJs, /const canonical=/, 'filtros não normalizam variações Unicode');
assert.match(catalogJs, /\\p\{L\}/, 'rótulos de categoria não usam capitalização Unicode');
assert.match(catalogJs, /canonical\(p\.marca\)===brand\.value/, 'marca ainda filtra por grafia bruta');
const productStatic = read('assets/product-static.js');
assert.match(productStatic, /const mainsContext=/, 'voltagem derivada sem gate contextual');
assert.match(productStatic, /if\(mainsContext\)/, 'gate de voltagem não aplicado');
assert.match(productStatic, /cleanedBase/, 'texto rico ainda repete título no resumo');

console.log(JSON.stringify({
  p2PublicSiteClosure: 'PASS',
  products: products.length,
  mobile: mobile.length,
  productPages: products.length,
  malformedSocialImages,
  missingCanonical,
  missingAffiliateTarget,
  sitemapProducts: products.length,
  homePrerendered: (home.match(/data-pnm-product-id=/g) || []).length,
  catalogPrerendered: (catalog.match(/data-pnm-product-id=/g) || []).length,
  offersPrerendered: (offers.match(/data-pnm-product-id=/g) || []).length,
  catalogFilterNormalization: true,
  conservativeDerivedSpecs: true,
}, null, 2));
