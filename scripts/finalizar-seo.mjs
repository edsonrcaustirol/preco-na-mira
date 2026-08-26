#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ORIGIN = 'https://preconamira.com.br';
const sitemapPath = path.join(ROOT, 'sitemap.xml');
const robotsPath = path.join(ROOT, 'robots.txt');
const PUBLIC_NOINDEX_ROUTES = new Set(['/carrinho', '/minha-lista', '/projeto', '/busca']);

if (!fs.existsSync(sitemapPath)) throw new Error('sitemap.xml não foi gerado.');
if (!fs.existsSync(robotsPath)) throw new Error('robots.txt não foi gerado.');

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));
const text = value => String(value || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
  .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
  .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
  .replace(/&nbsp;/gi, ' ').replace(/&ndash;/gi, '–').replace(/&mdash;/gi, '—')
  .replace(/\s+/g, ' ').trim();

function routeFor(fileName) {
  return fileName === 'index.html' ? '/' : `/${fileName.replace(/\.html$/i, '')}`;
}

function canonicalOf(html, fileName) {
  const match = html.match(/<link\b(?=[^>]*\brel=(?:"canonical"|'canonical'))(?=[^>]*\bhref=(?:"([^"]+)"|'([^']+)'))[^>]*>/i);
  return match?.[1] || match?.[2] || `${ORIGIN}${routeFor(fileName)}`;
}

function alignProductBreadcrumbSchema(html, productName, canonical) {
  const scriptRe = /<script\b([^>]*\bdata-pnm-jsonld=(?:"product"|'product')[^>]*)>([\s\S]*?)<\/script>/i;
  return html.replace(scriptRe, (full, attributes, rawJson) => {
    let json;
    try {
      json = JSON.parse(rawJson);
    } catch {
      throw new Error(`JSON-LD de produto inválido em ${canonical}`);
    }
    const graph = Array.isArray(json?.['@graph']) ? json['@graph'] : [json];
    const breadcrumb = graph.find(node => node?.['@type'] === 'BreadcrumbList');
    if (!breadcrumb) return full;
    breadcrumb.itemListElement = [
      { '@type': 'ListItem', position: 1, name: 'Preço na Mira', item: `${ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: 'Catálogo', item: `${ORIGIN}/catalogo` },
      { '@type': 'ListItem', position: 3, name: productName, item: canonical },
    ];
    return `<script${attributes}>${JSON.stringify(json)}</script>`;
  });
}

function ensureProductBreadcrumbs() {
  const productFiles = fs.readdirSync(ROOT)
    .filter(name => /^produto-.+\.html$/i.test(name) && name !== 'produto.html')
    .sort();
  let changed = 0;
  for (const fileName of productFiles) {
    const file = path.join(ROOT, fileName);
    let html = fs.readFileSync(file, 'utf8');
    const original = html;
    const productName = text((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]);
    if (!productName) throw new Error(`Produto sem H1 para breadcrumb: ${fileName}`);
    const canonical = canonicalOf(html, fileName);
    html = alignProductBreadcrumbSchema(html, productName, canonical);
    if (!html.includes('class="pnm-product-breadcrumb"')) {
      const breadcrumb = `<nav class="pnm-product-breadcrumb container" aria-label="Breadcrumb" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding-top:18px;font-size:11px"><a href="/" style="color:inherit;text-decoration:none">Início</a><span aria-hidden="true">›</span><a href="catalogo" style="color:inherit;text-decoration:none">Catálogo</a><span aria-hidden="true">›</span><span aria-current="page">${esc(productName)}</span></nav>`;
      if (!/<main\b[^>]*>/i.test(html)) throw new Error(`Produto sem <main>: ${fileName}`);
      html = html.replace(/(<main\b[^>]*>)/i, `$1${breadcrumb}`);
    }
    if (html !== original) {
      fs.writeFileSync(file, html);
      changed += 1;
    }
  }
  return { total: productFiles.length, changed };
}

function ensureMeta(html, kind, key, value) {
  const attr = kind === 'property' ? 'property' : 'name';
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<meta\\b(?=[^>]*\\b${attr}=(?:"${escapedKey}"|'${escapedKey}'))[^>]*>`, 'i');
  if (re.test(html)) return html;
  return html.replace(/<\/head>/i, `<meta ${attr}="${key}" content="${esc(value)}"></head>`);
}

function completeDewaltMetadata() {
  const file = path.join(ROOT, 'dewalt.html');
  let html = fs.readFileSync(file, 'utf8');
  const original = html;
  const title = text((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]);
  const description = (html.match(/<meta\b(?=[^>]*\bname=(?:"description"|'description'))(?=[^>]*\bcontent=(?:"([^"]*)"|'([^']*)'))[^>]*>/i) || []).slice(1).find(Boolean) || '';
  if (!title || !description) throw new Error('DeWalt sem title/description essenciais.');
  html = ensureMeta(html, 'property', 'og:title', title);
  html = ensureMeta(html, 'property', 'og:description', description);
  html = ensureMeta(html, 'name', 'twitter:title', title);
  html = ensureMeta(html, 'name', 'twitter:description', description);
  if (html !== original) fs.writeFileSync(file, html);
  return html !== original;
}

let sitemap = fs.readFileSync(sitemapPath, 'utf8');
// Não existe fonte confiável de data de modificação por URL. É melhor omitir
// lastmod do que marcar todas as páginas como alteradas a cada build.
sitemap = sitemap.replace(/<lastmod>[^<]*<\/lastmod>/g, '');
const required = [`${ORIGIN}/`, `${ORIGIN}/catalogo`, `${ORIGIN}/ofertas`, `${ORIGIN}/universos`];
for (const url of required) {
  if (!sitemap.includes(`<loc>${url}</loc>`)) throw new Error(`URL essencial ausente do sitemap: ${url}`);
}
const productUrls = (sitemap.match(/<loc>https:\/\/preconamira\.com\.br\/produto-[^<]+<\/loc>/g) || []).length;
if (productUrls === 0) throw new Error('Nenhuma página de produto encontrada no sitemap.');
const paginationUrls = (sitemap.match(/<loc>https:\/\/preconamira\.com\.br\/(?:catalogo|ofertas)-pagina-\d+<\/loc>/g) || []).length;
const totalUrls = (sitemap.match(/<url>/g) || []).length;
if (/<lastmod>/i.test(sitemap)) throw new Error('lastmod permaneceu no sitemap sem fonte confiável.');
fs.writeFileSync(sitemapPath, sitemap);

let robots = fs.readFileSync(robotsPath, 'utf8');
const removedRobotsNoindexConflicts = [];
robots = robots.split(/\r?\n/).filter(line => {
  const match = line.match(/^\s*Disallow:\s*(\S+)\s*$/i);
  const route = match?.[1]?.replace(/\/$/, '') || '/';
  const conflict = Boolean(match && PUBLIC_NOINDEX_ROUTES.has(route));
  if (conflict) removedRobotsNoindexConflicts.push(route);
  return !conflict;
}).join('\n').replace(/\n*$/, '\n');
if (!robots.includes(`Sitemap: ${ORIGIN}/sitemap.xml`)) throw new Error('robots.txt não aponta para o sitemap oficial.');
for (const route of PUBLIC_NOINDEX_ROUTES) {
  if (new RegExp(`^Disallow:\\s*${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?\\s*$`, 'mi').test(robots)) {
    throw new Error(`Conflito robots/noindex ainda presente: ${route}`);
  }
}
fs.writeFileSync(robotsPath, robots);

const casaStudio = fs.readFileSync(path.join(ROOT, 'casa-studio.html'), 'utf8');
if (!/<meta\b(?=[^>]*\bname=(?:"robots"|'robots'))(?=[^>]*\bcontent=(?:"[^"]*noindex|'[^']*noindex))[^>]*>/i.test(casaStudio)) {
  throw new Error('Casa Studio perdeu a decisão NOINDEX do P9.');
}

const comparativo = fs.readFileSync(path.join(ROOT, 'comparativo-geral.html'), 'utf8');
if (!/<title>Comparador de caixas de som — Preço na Mira<\/title>/i.test(comparativo) || !/compare mobilidade, bateria, resistência/i.test(comparativo)) {
  throw new Error('comparativo-geral voltou a prometer um contexto diferente da página real.');
}

const productBreadcrumbs = ensureProductBreadcrumbs();
const dewaltMetadataChanged = completeDewaltMetadata();

console.log(JSON.stringify({
  lastmod: 'omitido-sem-fonte-confiavel',
  totalUrls,
  productUrls,
  paginationUrls,
  robotsSitemap: true,
  robotsNoindexConflictsRemoved: removedRobotsNoindexConflicts,
  productBreadcrumbs,
  casaStudio: 'NOINDEX',
  dewaltMetadataChanged,
  comparativoGeral: 'caixas-de-som-validado',
}, null, 2));
