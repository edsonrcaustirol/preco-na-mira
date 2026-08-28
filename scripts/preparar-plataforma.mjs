#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OFFICIAL_ORIGIN = 'https://preconamira.com.br';
const LEGACY_ORIGIN = 'https://preco-na-mira.preco-na-mira.workers.dev';
const PLATFORM_CSS = 'assets/pnm-platform-v18.css';
const MOBILE_CSS = 'assets/pnm-mobile-v183.css';
const PLATFORM_JS = 'assets/pnm-platform-v18.js';
const SOCIAL_IMAGE = `${OFFICIAL_ORIGIN}/assets/og-preco-na-mira.png`;
const SKIP_DEPLOYED = new Set(['automacao.html', 'gerenciador.html']);
const NOINDEX = new Set([
  '404.html', 'automacao.html', 'busca.html', 'carrinho.html',
  'cobertura-imagens.html', 'favoritos.html', 'gerenciador.html',
  'jornadas.html', 'minha-lista.html', 'produto.html', 'projeto.html',
]);
const DESCRIPTION_OVERRIDES = {
  'favoritos.html': 'Seus produtos favoritos agora ficam organizados na Central de Salvos do Preço na Mira.',
  'montar-casa.html': 'Monte ambientes da casa por etapas, compare produtos compatíveis com o espaço e organize as escolhas antes de comprar.',
  'montar-cozinha.html': 'Monte sua cozinha por etapas, compare eletrodomésticos por função e organize um conjunto coerente antes de comprar.',
  'montar-espaco-compacto.html': 'Planeje studios e apartamentos pequenos com produtos adequados às medidas, ao uso e à circulação do ambiente.',
};

function walk(dir = ROOT) {
  const output = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', '.audit', '.wrangler'].includes(entry.name)) continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) output.push(...walk(absolute));
    else output.push(absolute);
  }
  return output;
}

const htmlFiles = walk().filter(file => file.endsWith('.html'));
const htmlNames = new Set(htmlFiles.filter(file => path.dirname(file) === ROOT).map(file => path.basename(file)));

function extensionless(fileName) {
  return fileName === 'index.html' ? '/' : `/${fileName.replace(/\.html$/i, '')}`;
}

function canonicalizeOfficialUrls(content) {
  content = content.replaceAll(LEGACY_ORIGIN, OFFICIAL_ORIGIN);
  return content.replace(/https:\/\/preconamira\.com\.br\/([a-z0-9-]+)\.html(?=([?#"'\\<]|$))/gi, `${OFFICIAL_ORIGIN}/$1`);
}

function replaceMeta(content, selector, value, attribute = 'name') {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matcher = new RegExp(`<meta\\b(?=[^>]*\\b${attribute}=(?:"${escaped}"|'${escaped}'))[^>]*>`, 'i');
  const tag = `<meta ${attribute}="${selector}" content="${value}">`;
  if (matcher.test(content)) return content.replace(matcher, tag);
  return content.replace(/<\/head>/i, `${tag}</head>`);
}

function metaValue(content, selector, attribute = 'name') {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matcher = new RegExp(`<meta\\b(?=[^>]*\\b${attribute}=(?:"${escaped}"|'${escaped}'))(?=[^>]*\\bcontent=(?:"([^"]*)"|'([^']*)'))[^>]*>`, 'i');
  const match = content.match(matcher);
  return match?.[1] ?? match?.[2] ?? '';
}

function titleValue(content) {
  return String((content.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').replace(/\s+/g, ' ').trim();
}

function replaceCanonical(content, value) {
  const tag = `<link rel="canonical" href="${value}">`;
  if (/<link\b(?=[^>]*\brel=(?:"canonical"|'canonical'))[^>]*>/i.test(content)) {
    return content.replace(/<link\b(?=[^>]*\brel=(?:"canonical"|'canonical'))[^>]*>/i, tag);
  }
  return content.replace(/<\/head>/i, `${tag}</head>`);
}

function existingCanonical(content, fileName) {
  const match = content.match(/<link\b(?=[^>]*\brel=(?:"canonical"|'canonical'))(?=[^>]*\bhref=(?:"([^"]+)"|'([^']+)'))[^>]*>/i);
  return canonicalizeOfficialUrls(match?.[1] || match?.[2] || `${OFFICIAL_ORIGIN}${extensionless(fileName)}`);
}

function normalizeRootHtmlReferences(content) {
  for (const fileName of htmlNames) {
    if (fileName === '404.html') continue;
    const escaped = fileName.replace('.', '\\.');
    const target = fileName === 'index.html' ? '/' : fileName.replace(/\.html$/i, '');
    content = content.replace(new RegExp(`(?<![\\w./-])${escaped}(?=([?#"'\\s<)]|$))`, 'g'), target);
  }
  return content;
}

function absoluteSocialImage(content, fileName) {
  const isProduct = /^produto-/.test(fileName) && fileName !== 'produto.html';
  if (!isProduct) {
    content = replaceMeta(content, 'og:image', SOCIAL_IMAGE, 'property');
    content = replaceMeta(content, 'twitter:image', SOCIAL_IMAGE);
    return content;
  }
  content = content.replace(/<meta\b(?=[^>]*\bproperty=(?:"og:image"|'og:image'))[^>]*>/gi, tag => tag.replace(/content=(?:"assets\/|'assets\/)/i, `content="${OFFICIAL_ORIGIN}/assets/`));
  content = content.replace(/<meta\b(?=[^>]*\bname=(?:"twitter:image"|'twitter:image'))[^>]*>/gi, tag => tag.replace(/content=(?:"assets\/|'assets\/)/i, `content="${OFFICIAL_ORIGIN}/assets/`));
  content = content.replace(/"image":\["assets\//g, `"image":["${OFFICIAL_ORIGIN}/assets/`);
  return content;
}

function syncSocialTextMetadata(content, fileName) {
  const title = titleValue(content);
  const description = metaValue(content, 'description');
  const isProduct = /^produto-/.test(fileName) && fileName !== 'produto.html';
  if (title) {
    content = replaceMeta(content, 'og:title', title, 'property');
    content = replaceMeta(content, 'twitter:title', title);
  }
  if (description) {
    content = replaceMeta(content, 'og:description', description, 'property');
    content = replaceMeta(content, 'twitter:description', description);
  }
  content = replaceMeta(content, 'og:type', isProduct ? 'product' : 'website', 'property');
  return content;
}

function prepareHtml(file) {
  const fileName = path.basename(file);
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  content = canonicalizeOfficialUrls(content);
  content = normalizeRootHtmlReferences(content);
  const canonical = existingCanonical(content, fileName);
  content = replaceCanonical(content, canonical);
  content = replaceMeta(content, 'og:url', canonical, 'property');
  content = replaceMeta(content, 'og:site_name', 'Preço na Mira', 'property');
  content = replaceMeta(content, 'twitter:card', 'summary_large_image');
  content = absoluteSocialImage(content, fileName);

  if (DESCRIPTION_OVERRIDES[fileName]) content = replaceMeta(content, 'description', DESCRIPTION_OVERRIDES[fileName]);
  if (fileName === 'ambiente-cozinha.html') {
    content = replaceMeta(content, 'description', 'Explore a cozinha por função, compare eletrodomésticos e monte um conjunto coerente para seu espaço e rotina.');
  }
  if (fileName === 'tvs.html') content = content.replace(/<title>[^<]*<\/title>/i, '<title>TVs — Compare modelos | Preço na Mira</title>');
  if (/^produto-/.test(fileName) && fileName !== 'produto.html') {
    content = content.replaceAll('Foto real validada • V17.3.3', 'Foto real do produto');
    content = content.replaceAll('Foto oficial do produto • V17.3.3', 'Foto oficial do produto');
  }
  if (fileName === 'busca.html') content = content.replace('CENTRAL DE BUSCA • V17.2', 'CENTRAL DE BUSCA');
  if (NOINDEX.has(fileName)) content = replaceMeta(content, 'robots', 'noindex,follow');
  content = syncSocialTextMetadata(content, fileName);

  if (!SKIP_DEPLOYED.has(fileName)) {
    if (!content.includes(PLATFORM_CSS)) content = content.replace(/<\/head>/i, `<link rel="stylesheet" href="${PLATFORM_CSS}"></head>`);
    if (!content.includes(MOBILE_CSS)) content = content.replace(/<\/head>/i, `<link rel="stylesheet" href="${MOBILE_CSS}"></head>`);
    if (!content.includes(PLATFORM_JS)) content = content.replace(/<\/head>/i, `<script defer src="${PLATFORM_JS}"></script></head>`);
  }

  if (content !== original) fs.writeFileSync(file, content);
  return content !== original;
}

function prepareScripts(files) {
  let changed = 0;
  for (const file of files.filter(item => item.endsWith('.js') && !item.endsWith(PLATFORM_JS))) {
    const original = fs.readFileSync(file, 'utf8');
    let content = canonicalizeOfficialUrls(original);
    content = normalizeRootHtmlReferences(content);
    content = content.replace(/(produto-\$\{[^}]+\})\.html/g, '$1');
    if (content !== original) {
      fs.writeFileSync(file, content);
      changed += 1;
    }
  }
  return changed;
}

function sitemapEntry(fileName) {
  const loc = `${OFFICIAL_ORIGIN}${extensionless(fileName)}`;
  return `  <url><loc>${loc}</loc></url>`;
}

function isNoindexFile(fileName) {
  if (NOINDEX.has(fileName)) return true;
  const content = fs.readFileSync(path.join(ROOT, fileName), 'utf8');
  return /<meta\b(?=[^>]*\bname=(?:"robots"|'robots'))(?=[^>]*\bcontent=(?:"[^"]*noindex|'[^']*noindex))[^>]*>/i.test(content);
}

function socialMetadataProblems(fileName) {
  const content = fs.readFileSync(path.join(ROOT, fileName), 'utf8');
  const title = titleValue(content);
  const description = metaValue(content, 'description');
  const canonical = existingCanonical(content, fileName);
  const expectedType = /^produto-/.test(fileName) && fileName !== 'produto.html' ? 'product' : 'website';
  const checks = [
    ['OG_TITLE', metaValue(content, 'og:title', 'property') === title],
    ['OG_DESCRIPTION', metaValue(content, 'og:description', 'property') === description],
    ['OG_URL', metaValue(content, 'og:url', 'property') === canonical],
    ['OG_IMAGE', /^https:\/\//i.test(metaValue(content, 'og:image', 'property'))],
    ['OG_TYPE', metaValue(content, 'og:type', 'property') === expectedType],
    ['TWITTER_CARD', metaValue(content, 'twitter:card') === 'summary_large_image'],
    ['TWITTER_TITLE', metaValue(content, 'twitter:title') === title],
    ['TWITTER_DESCRIPTION', metaValue(content, 'twitter:description') === description],
    ['TWITTER_IMAGE', /^https:\/\//i.test(metaValue(content, 'twitter:image'))],
  ];
  return checks.filter(([, ok]) => !ok).map(([code]) => `${fileName}:${code}`);
}

const changedHtml = htmlFiles.reduce((count, file) => count + Number(prepareHtml(file)), 0);
const changedScripts = prepareScripts(walk());
const sitemapPages = htmlFiles
  .filter(file => path.dirname(file) === ROOT)
  .map(file => path.basename(file))
  .filter(file => !isNoindexFile(file) && !SKIP_DEPLOYED.has(file))
  .sort((a, b) => a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b));
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapPages.map(sitemapEntry).join('\n')}\n</urlset>\n`;
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap);
fs.writeFileSync(path.join(ROOT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /gerenciador\nDisallow: /automacao\n\nSitemap: ${OFFICIAL_ORIGIN}/sitemap.xml\n`);

const socialProblems = sitemapPages.flatMap(socialMetadataProblems);
if (socialProblems.length) {
  throw new Error(`Metadados sociais incompletos ou divergentes: ${socialProblems.slice(0, 20).join(', ')}${socialProblems.length > 20 ? ` (+${socialProblems.length - 20})` : ''}`);
}

console.log(JSON.stringify({ changedHtml, changedScripts, sitemapUrls: sitemapPages.length, socialIndexablePages: sitemapPages.length, socialProblems: socialProblems.length }, null, 2));
