#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, '.audit');
const OFFICIAL_ORIGIN = 'https://preconamira.com.br';
const LEGACY_ORIGIN = 'https://preco-na-mira.preco-na-mira.workers.dev';
const IGNORE_DIRS = new Set(['.git', 'node_modules', '.audit']);
const EXCLUDED_FROM_DEPLOY = new Set(['automacao.html', 'gerenciador.html']);

const toPosix = value => value.split(path.sep).join('/');
const rel = value => toPosix(path.relative(ROOT, value));
const read = file => fs.readFileSync(file, 'utf8');

function walk(dir = ROOT) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && IGNORE_DIRS.has(entry.name)) continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else files.push(absolute);
  }
  return files;
}

function unique(values) {
  return [...new Set(values)];
}

function attrs(markup) {
  const result = {};
  const expression = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = expression.exec(markup))) {
    result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return result;
}

function attrValues(html, tagName) {
  const values = [];
  const expression = new RegExp(`<${tagName}\\b([^>]*)>`, 'gi');
  let match;
  while ((match = expression.exec(html))) values.push(attrs(match[1]));
  return values;
}

function textContent(html, tagName) {
  const expression = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
  const values = [];
  let match;
  while ((match = expression.exec(html))) {
    values.push(match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  }
  return values;
}

function metaValue(html, key, attr = 'name') {
  return attrValues(html, 'meta').find(meta => meta[attr] === key)?.content || '';
}

function linkValue(html, relValue) {
  return attrValues(html, 'link').find(link => (link.rel || '').split(/\s+/).includes(relValue))?.href || '';
}

function resolveLocalReference(fromFile, rawValue) {
  if (!rawValue || rawValue.startsWith('#')) return null;
  const clean = rawValue.split('#')[0].split('?')[0];
  if (!clean || /^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(clean)) return null;
  const decoded = (() => {
    try { return decodeURIComponent(clean); } catch { return clean; }
  })();
  const absolute = decoded.startsWith('/')
    ? path.join(ROOT, decoded.replace(/^\/+/, ''))
    : path.resolve(path.dirname(fromFile), decoded);
  const candidates = [absolute];
  if (!path.extname(absolute)) candidates.push(`${absolute}.html`, path.join(absolute, 'index.html'));
  return { rawValue, candidates, exists: candidates.some(candidate => fs.existsSync(candidate)) };
}

function auditHtml(file) {
  const html = read(file);
  const fileName = rel(file);
  const htmlTag = html.match(/<html\b([^>]*)>/i);
  const titles = textContent(html, 'title');
  const h1 = textContent(html, 'h1');
  const canonical = linkValue(html, 'canonical');
  const description = metaValue(html, 'description');
  const robots = metaValue(html, 'robots');
  const viewport = metaValue(html, 'viewport');
  const images = attrValues(html, 'img');
  const anchors = attrValues(html, 'a');
  const scripts = attrValues(html, 'script');
  const stylesheets = attrValues(html, 'link').filter(link => link.rel === 'stylesheet');
  const ids = [...html.matchAll(/<[^>]+>/g)].map(match => attrs(match[0]).id).filter(Boolean);
  const duplicateIds = unique(ids.filter((id, index) => ids.indexOf(id) !== index));
  const inlineHandlers = [...html.matchAll(/\s(on[a-z]+)\s*=/gi)].map(match => match[1].toLowerCase());
  const localReferences = [
    ...anchors.map(anchor => anchor.href),
    ...images.map(image => image.src),
    ...scripts.map(script => script.src),
    ...stylesheets.map(style => style.href),
  ].filter(Boolean).map(value => resolveLocalReference(file, value)).filter(Boolean);
  const missingReferences = localReferences.filter(reference => !reference.exists).map(reference => reference.rawValue);
  const blankLinkRelProblems = anchors.filter(anchor => anchor.target === '_blank' && !/\bnoopener\b/i.test(anchor.rel || ''));

  return {
    file: fileName,
    route: fileName === 'index.html' ? '/' : `/${fileName.replace(/\.html$/i, '')}`,
    excludedFromDeploy: EXCLUDED_FROM_DEPLOY.has(fileName),
    noindex: /\bnoindex\b/i.test(robots),
    isProduct: /^produto-.*\.html$/.test(path.basename(fileName)),
    title: titles[0] || '',
    description,
    canonical,
    legacyCanonical: canonical.startsWith(LEGACY_ORIGIN),
    canonicalOnOfficialDomain: canonical.startsWith(OFFICIAL_ORIGIN),
    language: htmlTag ? (attrs(htmlTag[1]).lang || '') : '',
    viewport,
    h1,
    og: {
      title: metaValue(html, 'og:title', 'property'),
      description: metaValue(html, 'og:description', 'property'),
      url: metaValue(html, 'og:url', 'property'),
      image: metaValue(html, 'og:image', 'property'),
    },
    images: {
      total: images.length,
      missingAlt: images.filter(image => !String(image.alt || '').trim()).length,
      missingDimensions: images.filter(image => !image.width || !image.height).length,
      eagerBelowFoldCandidates: images.filter(image => image.loading !== 'lazy' && image.loading !== 'eager').length,
    },
    duplicateIds,
    inlineHandlers: unique(inlineHandlers),
    unsafeJavascriptLinks: anchors.filter(anchor => /^javascript:/i.test(anchor.href || '')).map(anchor => anchor.href),
    blankLinkRelProblems: blankLinkRelProblems.length,
    missingReferences: unique(missingReferences),
  };
}

function loadProducts(file) {
  const code = read(file);
  const context = vm.createContext({ window: {}, globalThis: {} });
  vm.runInContext(`${code}\n;globalThis.__PNM_PRODUCTS__ = typeof PRODUTOS !== 'undefined' ? PRODUTOS : (window.PRODUTOS || []);`, context, { filename: rel(file), timeout: 5000 });
  return context.globalThis.__PNM_PRODUCTS__ || [];
}

function auditProducts() {
  const canonicalFile = path.join(ROOT, 'data', 'produtos-index.js');
  const products = loadProducts(canonicalFile);
  const ids = products.map(product => product?.id).filter(Boolean);
  const duplicateIds = unique(ids.filter((id, index) => ids.indexOf(id) !== index));
  const required = ['id', 'nome', 'marca', 'categoria', 'imagem', 'imagemAlt', 'linkAfiliado', 'loja', 'resumo'];
  const coverage = Object.fromEntries(required.map(field => [field, products.filter(product => String(product?.[field] || '').trim()).length]));
  const missingByField = Object.fromEntries(required.map(field => [field, products.filter(product => !String(product?.[field] || '').trim()).map(product => product?.id || '(sem id)')]));
  const imageProblems = [];
  const staticPageProblems = [];
  const fallbackProducts = [];
  const affiliateProblems = [];
  const affiliateMap = new Map();
  const localImages = [];
  const externalImages = [];

  for (const product of products) {
    const image = String(product?.imagem || '');
    const fallback = String(product?.imagemFallback || '');
    const imagePath = image && !/^https?:/i.test(image) ? path.join(ROOT, image) : '';
    if (!image) imageProblems.push({ id: product?.id, problem: 'sem caminho de imagem' });
    else if (imagePath && !fs.existsSync(imagePath)) imageProblems.push({ id: product?.id, image, problem: 'arquivo de imagem ausente' });
    if (/product-photo-unavailable|fallback|placeholder/i.test(image)) fallbackProducts.push({ id: product?.id, name: product?.nome, image });
    if (/^https?:/i.test(image)) externalImages.push({ id: product?.id, image, host: (() => { try { return new URL(image).hostname; } catch { return ''; } })() });
    else if (image) localImages.push({ id: product?.id, image });
    if (fallback && !/^https?:/i.test(fallback) && !fs.existsSync(path.join(ROOT, fallback))) imageProblems.push({ id: product?.id, fallback, problem: 'fallback ausente' });
    const staticPage = path.join(ROOT, `produto-${product?.id}.html`);
    if (product?.id && !fs.existsSync(staticPage)) staticPageProblems.push({ id: product.id, page: rel(staticPage) });
    const affiliate = String(product?.linkAfiliado || '');
    if (affiliate && !/^https:\/\/(?:meli\.la|www\.mercadolivre\.com\.br|mercadolivre\.com)/i.test(affiliate)) {
      affiliateProblems.push({ id: product?.id, link: affiliate, problem: 'domínio de destino fora da lista esperada' });
    }
    if (affiliate) {
      const list = affiliateMap.get(affiliate) || [];
      list.push(product?.id);
      affiliateMap.set(affiliate, list);
    }
  }

  return {
    source: rel(canonicalFile),
    total: products.length,
    duplicateIds,
    coverage,
    missingByField,
    imageProblems,
    fallbackProducts,
    staticPageProblems,
    affiliateProblems,
    duplicateAffiliateLinks: [...affiliateMap.entries()].filter(([, productIds]) => productIds.length > 1).map(([link, productIds]) => ({ link, productIds })),
    imageHosting: {
      local: localImages.length,
      external: externalImages.length,
      externalHosts: Object.entries(externalImages.reduce((hosts, item) => {
        hosts[item.host || '(inválido)'] = (hosts[item.host || '(inválido)'] || 0) + 1;
        return hosts;
      }, {})).sort((a, b) => b[1] - a[1]).map(([host, count]) => ({ host, count })),
      externalProducts: externalImages,
    },
    derivedCoverage: {
      benefits: products.filter(product => Array.isArray(product?.chips) && product.chips.length > 0).length,
      whyBuy: products.filter(product => String(product?.chamada || '').trim()).length,
      technicalSource: products.filter(product => String(product?.fonteTecnica || '').trim()).length,
      technicalSpecs: products.filter(product => product?.compat || (Array.isArray(product?.chips) && product.chips.length > 0)).length,
      price: products.filter(product => product?.preco || product?.price).length,
      priceNotice: products.filter(product => /preço|valor|oferta/i.test(String(product?.observacao || product?.nota || ''))).length,
    },
  };
}

function auditSitemap(htmlAudits) {
  const sitemapPath = path.join(ROOT, 'sitemap.xml');
  const robotsPath = path.join(ROOT, 'robots.txt');
  const sitemap = fs.existsSync(sitemapPath) ? read(sitemapPath) : '';
  const robots = fs.existsSync(robotsPath) ? read(robotsPath) : '';
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  const officialUrls = urls.filter(url => url.startsWith(OFFICIAL_ORIGIN));
  const legacyUrls = urls.filter(url => url.startsWith(LEGACY_ORIGIN));
  const indexableRoutes = htmlAudits.filter(page => !page.excludedFromDeploy && !page.noindex);
  const noindexRoutes = htmlAudits.filter(page => !page.excludedFromDeploy && page.noindex);
  const indexableCanonicals = new Set(indexableRoutes.map(page => page.canonical || `${OFFICIAL_ORIGIN}${page.route}`));
  return {
    exists: Boolean(sitemap),
    urls: urls.length,
    officialUrls: officialUrls.length,
    legacyUrls: legacyUrls.length,
    duplicateUrls: unique(urls.filter((url, index) => urls.indexOf(url) !== index)),
    htmlPagesNotListed: indexableRoutes.filter(page => !urls.includes(page.canonical || `${OFFICIAL_ORIGIN}${page.route}`)).map(page => page.file),
    noindexPagesListed: noindexRoutes.filter(page => {
      const canonical = page.canonical || `${OFFICIAL_ORIGIN}${page.route}`;
      return urls.includes(canonical) && !indexableCanonicals.has(canonical);
    }).map(page => page.file),
    robotsSitemap: (robots.match(/^Sitemap:\s*(.+)$/mi) || [])[1] || '',
    robotsUsesLegacyDomain: robots.includes(LEGACY_ORIGIN),
  };
}

function auditSecrets(files) {
  const textFiles = files.filter(file => !/\.(?:png|jpe?g|gif|webp|ico|zip|woff2?|ttf|pdf)$/i.test(file));
  const patterns = [
    ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ['github-token', /gh[pousr]_[A-Za-z0-9_]{30,}/],
    ['cloudflare-api-token', /(?:CLOUDFLARE_API_TOKEN|CF_API_TOKEN)\s*[:=]\s*["']?[A-Za-z0-9_-]{20,}/i],
    ['generic-secret', /(?:api[_-]?key|secret|token|password)\s*[:=]\s*["'][^"']{12,}["']/i],
  ];
  const findings = [];
  for (const file of textFiles) {
    const content = read(file);
    for (const [type, pattern] of patterns) if (pattern.test(content)) findings.push({ file: rel(file), type });
  }
  return findings;
}

const allFiles = walk();
const htmlFiles = allFiles.filter(file => file.endsWith('.html')).sort();
const html = htmlFiles.map(auditHtml);
const titleGroups = new Map();
for (const page of html) {
  if (page.noindex || page.excludedFromDeploy) continue;
  const list = titleGroups.get(page.title) || [];
  list.push(page.file);
  titleGroups.set(page.title, list);
}

const report = {
  generatedAt: new Date().toISOString(),
  officialOrigin: OFFICIAL_ORIGIN,
  legacyOrigin: LEGACY_ORIGIN,
  inventory: {
    files: allFiles.length,
    htmlPages: html.length,
    productPages: html.filter(page => page.isProduct).length,
    publicPages: html.filter(page => !page.isProduct && !page.excludedFromDeploy).map(page => page.file),
    excludedPages: html.filter(page => page.excludedFromDeploy).map(page => page.file),
    assets: allFiles.filter(file => rel(file).startsWith('assets/')).length,
    dataFiles: allFiles.filter(file => rel(file).startsWith('data/')).length,
  },
  html: {
    pages: html,
    missingTitle: html.filter(page => !page.title).map(page => page.file),
    duplicateTitles: [...titleGroups.entries()].filter(([title, pages]) => title && pages.length > 1).map(([title, pages]) => ({ title, pages })),
    missingDescription: html.filter(page => !page.description).map(page => page.file),
    missingCanonical: html.filter(page => !page.canonical).map(page => page.file),
    legacyCanonicals: html.filter(page => page.legacyCanonical).map(page => page.file),
    missingLanguage: html.filter(page => !page.language).map(page => page.file),
    missingViewport: html.filter(page => !page.viewport).map(page => page.file),
    invalidH1Count: html.filter(page => !page.noindex && !page.excludedFromDeploy && page.h1.length !== 1).map(page => ({ file: page.file, count: page.h1.length })),
    missingReferences: html.filter(page => !page.excludedFromDeploy).flatMap(page => page.missingReferences.map(reference => ({ file: page.file, reference }))),
    duplicateIds: html.filter(page => page.duplicateIds.length).map(page => ({ file: page.file, ids: page.duplicateIds })),
    inlineHandlers: html.filter(page => page.inlineHandlers.length).map(page => ({ file: page.file, handlers: page.inlineHandlers })),
    unsafeJavascriptLinks: html.filter(page => page.unsafeJavascriptLinks.length).map(page => ({ file: page.file, links: page.unsafeJavascriptLinks })),
    blankLinkRelProblems: html.filter(page => page.blankLinkRelProblems).map(page => ({ file: page.file, count: page.blankLinkRelProblems })),
    imageAccessibility: {
      total: html.reduce((sum, page) => sum + page.images.total, 0),
      missingAlt: html.reduce((sum, page) => sum + page.images.missingAlt, 0),
      missingDimensions: html.reduce((sum, page) => sum + page.images.missingDimensions, 0),
    },
  },
  products: auditProducts(),
  sitemap: auditSitemap(html),
  potentialSecrets: auditSecrets(allFiles),
};

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUTPUT_DIR, 'site-audit.json'), `${JSON.stringify(report, null, 2)}\n`);

const summary = {
  pages: report.inventory.htmlPages,
  productPages: report.inventory.productPages,
  products: report.products.total,
  missingReferences: report.html.missingReferences.length,
  legacyCanonicals: report.html.legacyCanonicals.length,
  missingDescriptions: report.html.missingDescription.length,
  invalidH1: report.html.invalidH1Count.length,
  imageProblems: report.products.imageProblems.length,
  fallbackProducts: report.products.fallbackProducts.length,
  duplicateProductIds: report.products.duplicateIds.length,
  duplicateAffiliateLinks: report.products.duplicateAffiliateLinks.length,
  potentialSecrets: report.potentialSecrets.length,
  output: '.audit/site-audit.json',
};

console.log(JSON.stringify(summary, null, 2));

const critical = summary.missingReferences
  + summary.imageProblems
  + summary.duplicateProductIds
  + summary.potentialSecrets
  + summary.legacyCanonicals
  + summary.missingDescriptions
  + summary.invalidH1
  + report.html.unsafeJavascriptLinks.length
  + report.sitemap.htmlPagesNotListed.length
  + report.sitemap.noindexPagesListed.length;
if (process.argv.includes('--strict') && critical > 0) process.exitCode = 1;
