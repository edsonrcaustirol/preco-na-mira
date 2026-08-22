#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ORIGIN = 'https://preconamira.com.br';
const INTENTIONAL_ROBOTS_BLOCKS = new Set(['/automacao', '/gerenciador']);
const TARGET_FILES = [
  'index.html', 'catalogo.html', 'ofertas.html', 'pequenos-espacos.html',
  'casa-studio.html', 'montar.html', 'projeto.html', 'obra-base.html',
  'dewalt.html', 'comparativo-geral.html', 'carrinho.html', 'minha-lista.html',
  'busca.html',
];

const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const routeFor = file => file === 'index.html' ? '/' : `/${file.replace(/\.html$/i, '')}`;
const expectedCanonical = file => `${ORIGIN}${routeFor(file)}`;

function attrs(markup = '') {
  const result = {};
  const re = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = re.exec(markup))) result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  return result;
}

function meta(html, key, attr = 'name') {
  for (const match of html.matchAll(/<meta\b([^>]*)>/gi)) {
    const values = attrs(match[1]);
    if (values[attr] === key) return values.content || '';
  }
  return '';
}

function canonical(html) {
  for (const match of html.matchAll(/<link\b([^>]*)>/gi)) {
    const values = attrs(match[1]);
    if ((values.rel || '').split(/\s+/).includes('canonical')) return values.href || '';
  }
  return '';
}

function title(html) {
  return (html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || '';
}

function isNoindex(html) {
  return /\bnoindex\b/i.test(meta(html, 'robots'));
}

function blockedBy(route, rule) {
  if (!rule) return false;
  if (rule === '/') return true;
  const normalized = rule.endsWith('/') ? rule.slice(0, -1) : rule;
  return route === normalized || route.startsWith(`${normalized}/`);
}

const errors = [];
const notes = [];
const rootHtml = fs.readdirSync(ROOT).filter(name => name.endsWith('.html')).sort();
const productFiles = rootHtml.filter(name => /^produto-.+\.html$/i.test(name) && name !== 'produto.html');
const pages = new Map(rootHtml.map(file => [file, read(file)]));

for (const file of TARGET_FILES) {
  if (!pages.has(file)) {
    errors.push(`rota esperada ausente: ${file}`);
    continue;
  }
  const html = pages.get(file);
  const foundCanonical = canonical(html);
  if (foundCanonical !== expectedCanonical(file)) errors.push(`canonical inesperado em ${file}: ${foundCanonical || '(ausente)'}`);
  if (!isNoindex(html) && (!title(html) || !meta(html, 'description'))) errors.push(`metadata essencial ausente em ${file}`);
}

for (const file of productFiles) {
  const html = pages.get(file);
  if (canonical(html) !== expectedCanonical(file)) errors.push(`canonical de produto inesperado: ${file}`);
  if (!/class="pnm-product-breadcrumb"/i.test(html) || !/aria-label="Breadcrumb"/i.test(html)) errors.push(`breadcrumb visual ausente: ${file}`);
  if (!/"@type":"BreadcrumbList"/.test(html) || !/"name":"Catálogo","item":"https:\/\/preconamira\.com\.br\/catalogo"/.test(html)) {
    errors.push(`BreadcrumbList não corresponde ao breadcrumb visual: ${file}`);
  }
}

const robots = read('robots.txt');
const disallow = [...robots.matchAll(/^\s*Disallow:\s*(\S+)\s*$/gmi)].map(match => match[1].replace(/\/$/, '') || '/');
for (const [file, html] of pages) {
  if (!isNoindex(html)) continue;
  const route = routeFor(file);
  const blocked = disallow.find(rule => blockedBy(route, rule));
  if (blocked && !INTENTIONAL_ROBOTS_BLOCKS.has(route)) errors.push(`conflito robots/noindex: ${route} bloqueado por ${blocked}`);
}
for (const route of INTENTIONAL_ROBOTS_BLOCKS) {
  if (!disallow.some(rule => blockedBy(route, rule))) errors.push(`bloqueio técnico esperado ausente no robots: ${route}`);
}
if (!robots.includes(`Sitemap: ${ORIGIN}/sitemap.xml`)) errors.push('robots não aponta para o sitemap oficial');

const sitemap = read('sitemap.xml');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
const duplicateUrls = [...new Set(sitemapUrls.filter((url, index) => sitemapUrls.indexOf(url) !== index))];
if (duplicateUrls.length) errors.push(`URLs duplicadas no sitemap: ${duplicateUrls.join(', ')}`);
for (const [file, html] of pages) {
  if (file === 'automacao.html' || file === 'gerenciador.html') continue;
  const url = canonical(html) || expectedCanonical(file);
  if (isNoindex(html) && sitemapUrls.includes(url)) errors.push(`noindex listado no sitemap: ${file}`);
}
const lastmods = [...sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map(match => match[1]);
const invalidLastmods = lastmods.filter(value => !/^\d{4}-\d{2}-\d{2}$/.test(value));
if (invalidLastmods.length) errors.push(`lastmod inválido: ${invalidLastmods.join(', ')}`);
if (lastmods.length > 1 && lastmods.length === sitemapUrls.length && new Set(lastmods).size === 1) {
  errors.push(`lastmod artificial: todas as ${lastmods.length} URLs usam ${lastmods[0]}`);
}

const casaStudio = pages.get('casa-studio.html') || '';
if (!isNoindex(casaStudio)) errors.push('Casa Studio deve permanecer NOINDEX nesta fase');
if (sitemapUrls.includes(`${ORIGIN}/casa-studio`)) errors.push('Casa Studio NOINDEX não pode estar no sitemap');

const dewalt = pages.get('dewalt.html') || '';
for (const field of [
  ['og:title', 'property'], ['og:description', 'property'],
  ['twitter:title', 'name'], ['twitter:description', 'name'],
]) {
  if (!meta(dewalt, field[0], field[1])) errors.push(`DeWalt sem ${field[0]}`);
}

const comparativo = pages.get('comparativo-geral.html') || '';
if (!/Comparador de caixas de som/i.test(title(comparativo)) || !/caixas de som/i.test(meta(comparativo, 'description'))) {
  errors.push('comparativo-geral com metadata divergente do conteúdo de caixas de som');
}

notes.push(`produtos_com_breadcrumb=${productFiles.length}`);
notes.push(`sitemap_urls=${sitemapUrls.length}`);
notes.push(`lastmod=${lastmods.length ? lastmods.length : 'omitido'}`);
notes.push(`robots_disallow=${disallow.join(',') || '(nenhum)'}`);
notes.push('casa_studio=NOINDEX');
notes.push('comparativo_geral=caixas_de_som');

console.log(JSON.stringify({
  ok: errors.length === 0,
  errors,
  notes,
}, null, 2));

if (errors.length) process.exitCode = 1;
