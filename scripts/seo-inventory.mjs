#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://preconamira.com.br';
const DEFAULT_ROOT = process.cwd();

export function parseArrayFile(file) {
  const source = fs.readFileSync(file, 'utf8');
  const start = source.indexOf('[');
  const end = source.lastIndexOf(']');
  if (start < 0 || end <= start) throw new Error(`Array inválido: ${file}`);
  const parsed = JSON.parse(source.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error(`Array esperado: ${file}`);
  return parsed;
}

function decodeHtml(value = '') {
  return String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ').trim();
}

function stripTags(value = '') {
  return decodeHtml(String(value).replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '));
}

export function attrs(markup = '') {
  const result = {};
  const re = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = re.exec(markup))) result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  return result;
}

export function meta(html, key, attr = 'name') {
  const expected = String(key).toLowerCase();
  for (const match of html.matchAll(/<meta\b([^>]*)>/gi)) {
    const values = attrs(match[1]);
    if (String(values[attr] || '').toLowerCase() === expected) return values.content || '';
  }
  return '';
}

export function canonical(html) {
  for (const match of html.matchAll(/<link\b([^>]*)>/gi)) {
    const values = attrs(match[1]);
    if (String(values.rel || '').toLowerCase().split(/\s+/).includes('canonical')) return values.href || '';
  }
  return '';
}

export function titleOf(html) {
  return stripTags((html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
}

export function h1Values(html) {
  return [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(match => stripTags(match[1]));
}

function headingCounts(html) {
  const output = {};
  for (let level = 1; level <= 6; level += 1) output[`h${level}`] = (html.match(new RegExp(`<h${level}\\b`, 'gi')) || []).length;
  return output;
}

function htmlLang(html) {
  const match = html.match(/<html\b([^>]*)>/i);
  return match ? attrs(match[1]).lang || '' : '';
}

function firstImage(html) {
  const match = html.match(/<img\b([^>]*)>/i);
  if (!match) return { src: '', alt: '' };
  const values = attrs(match[1]);
  return { src: values.src || '', alt: values.alt || '' };
}

export function parseStructuredData(html) {
  const types = new Set();
  let count = 0;
  let invalid = 0;
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const values = attrs(match[1]);
    if (String(values.type || '').toLowerCase() !== 'application/ld+json') continue;
    count += 1;
    try {
      const json = JSON.parse(match[2]);
      const visit = value => {
        if (Array.isArray(value)) return value.forEach(visit);
        if (!value || typeof value !== 'object') return;
        const type = value['@type'];
        if (Array.isArray(type)) type.forEach(item => types.add(String(item)));
        else if (type) types.add(String(type));
        if (Array.isArray(value['@graph'])) value['@graph'].forEach(visit);
      };
      visit(json);
    } catch {
      invalid += 1;
    }
  }
  return { present: count > 0, count, invalid, types: [...types].sort() };
}

function normalizeRoute(value) {
  if (!value) return null;
  let input = String(value).trim();
  if (!input || input.startsWith('#') || /^(?:mailto:|tel:|javascript:|data:)/i.test(input)) return null;
  try {
    if (/^https?:\/\//i.test(input)) {
      const url = new URL(input);
      if (url.origin !== ORIGIN) return null;
      input = `${url.pathname}${url.search}`;
    }
  } catch { return null; }
  input = input.split('#')[0].split('?')[0];
  if (!input) input = '/';
  if (!input.startsWith('/')) input = `/${input}`;
  input = input.replace(/\/index\.html$/i, '/').replace(/\.html$/i, '');
  if (input.length > 1) input = input.replace(/\/+$/, '');
  return input;
}

function routeFor(fileName) {
  return fileName === 'index.html' ? '/' : `/${fileName.replace(/\.html$/i, '')}`;
}

export function classifyPage(fileName) {
  if (fileName === 'index.html') return 'HOME';
  if (/^catalogo(?:-pagina-\d+)?\.html$/i.test(fileName)) return 'CATÁLOGO';
  if (/^ofertas(?:-pagina-\d+)?\.html$/i.test(fileName)) return 'OFERTAS';
  if (/^produto-.+\.html$/i.test(fileName) && fileName !== 'produto.html') return 'PRODUTO';
  if (/^(?:tvs|audio|notebooks|celulares|tablets|monitores|perifericos|casa|cozinha|gamer|ferramentas|obra|energia|iluminacao|seguranca|rede|armazenamento)\.html$/i.test(fileName)) return 'CATEGORIA';
  if (/(?:^|[-_])(montar|projeto|jornada|ambiente)(?:[-_.]|$)|^(?:universos|casa-studio|pequenos-espacos|obra-base)\.html$/i.test(fileName)) return 'PROJETOS/JORNADAS';
  if (/^(?:sobre|quem-somos|contato|metodologia|transparencia|politica|privacidade|termos|aviso|faq)/i.test(fileName)) return 'CONTEÚDO/INSTITUCIONAL';
  return 'OUTROS';
}

export function parseRobots(content = '') {
  return [...content.matchAll(/^\s*Disallow:\s*(\S+)\s*$/gmi)].map(match => normalizeRoute(match[1])).filter(Boolean);
}

function routeBlocked(route, rules) {
  return rules.some(rule => rule === '/' || route === rule || route.startsWith(`${rule}/`));
}

function internalLinks(html) {
  const links = [];
  for (const match of html.matchAll(/<a\b([^>]*)>/gi)) {
    const route = normalizeRoute(attrs(match[1]).href);
    if (route) links.push(route);
  }
  return [...new Set(links)].sort();
}

function templateSignature(html) {
  const tags = [...html.matchAll(/<\/?([a-z][a-z0-9-]*)\b/gi)].map(match => match[1].toLowerCase()).join('>');
  return crypto.createHash('sha256').update(tags).digest('hex').slice(0, 16);
}

function qualityForProduct(product = {}) {
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

function issue(priority, code, detail) { return { priority, code, detail }; }

export function analyzeHtmlPage({ fileName, html, sitemapSet = new Set(), blockedRules = [], product }) {
  const route = routeFor(fileName);
  const expectedCanonical = `${ORIGIN}${route}`;
  const foundCanonical = canonical(html);
  const title = titleOf(html);
  const description = meta(html, 'description');
  const robotsMeta = meta(html, 'robots');
  const noindex = /\bnoindex\b/i.test(robotsMeta);
  const blocked = routeBlocked(route, blockedRules);
  const indexable = fileName !== '404.html' && !noindex && !blocked;
  const h1s = h1Values(html);
  const schema = parseStructuredData(html);
  const mainImage = firstImage(html);
  const pageType = classifyPage(fileName);
  const quality = pageType === 'PRODUTO' ? qualityForProduct(product) : null;
  const issues = [];

  if (indexable && !foundCanonical) issues.push(issue('P0', 'CANONICAL_AUSENTE', 'Página indexável sem canonical.'));
  if (indexable && foundCanonical && foundCanonical !== expectedCanonical) issues.push(issue('P0', 'CANONICAL_DIVERGENTE', `${foundCanonical} != ${expectedCanonical}`));
  if (indexable && !title) issues.push(issue('P1', 'TITLE_AUSENTE', 'Página indexável sem title.'));
  if (indexable && !description) issues.push(issue('P1', 'META_DESCRIPTION_AUSENTE', 'Página indexável sem meta description.'));
  if (indexable && h1s.length === 0) issues.push(issue('P1', 'H1_AUSENTE', 'Página indexável sem H1.'));
  if (h1s.length > 1) issues.push(issue('P2', 'H1_MULTIPLO', `${h1s.length} H1 encontrados.`));
  if (indexable && !sitemapSet.has(expectedCanonical)) issues.push(issue('P2', 'AUSENTE_SITEMAP', 'Página indexável ausente do sitemap.'));
  if (!indexable && sitemapSet.has(expectedCanonical)) issues.push(issue('P0', 'NAO_INDEXAVEL_NO_SITEMAP', 'Página noindex/bloqueada listada no sitemap.'));
  if (!htmlLang(html)) issues.push(issue('P2', 'LANG_AUSENTE', 'Atributo lang ausente no html.'));
  if (!meta(html, 'viewport')) issues.push(issue('P2', 'VIEWPORT_AUSENTE', 'Meta viewport ausente.'));
  if (schema.invalid) issues.push(issue('P1', 'SCHEMA_INVALIDO', `${schema.invalid} bloco(s) JSON-LD inválido(s).`));
  if (pageType === 'PRODUTO') {
    const pageId = fileName.slice('produto-'.length, -'.html'.length);
    if (!product) issues.push(issue('P0', 'PRODUTO_SEM_OWNER', `ID ${pageId} não existe no owner.`));
    if (product && h1s[0] !== String(product.nome || '').trim()) issues.push(issue('P1', 'IDENTIDADE_DIVERGENTE', 'H1 diverge do nome no owner.'));
    if (!schema.types.includes('Product')) issues.push(issue('P2', 'PRODUCT_SCHEMA_AUSENTE', 'Página de produto sem Product schema.'));
    if (!mainImage.src || !mainImage.alt) issues.push(issue('P2', 'IMAGEM_ALT_INSUFICIENTE', 'Imagem principal ou alt ausente.'));
    if (quality === 'C') issues.push(issue('P2', 'PRODUTO_NIVEL_C', 'Dados insuficientes para enriquecimento programático seguro.'));
  }
  if (title.length > 0 && (title.length < 15 || title.length > 75)) issues.push(issue('P3', 'TITLE_COMPRIMENTO', `${title.length} caracteres.`));
  if (description.length > 0 && (description.length < 50 || description.length > 190)) issues.push(issue('P3', 'META_COMPRIMENTO', `${description.length} caracteres.`));

  return {
    path: route, file: fileName, type: pageType, structuralStatus: 'EXISTE', indexable,
    robotsMeta, blockedByRobots: blocked, canonical: foundCanonical,
    canonicalRelation: !foundCanonical ? 'AUSENTE' : foundCanonical === expectedCanonical ? 'SELF' : 'OTHER',
    title, titleLength: title.length, metaDescription: description, metaDescriptionLength: description.length,
    h1: h1s[0] || '', h1Count: h1s.length, headings: headingCounts(html), lang: htmlLang(html), viewport: meta(html, 'viewport'),
    structuredData: schema.present, schemaTypes: schema.types, schemaInvalidBlocks: schema.invalid,
    breadcrumbs: /aria-label=(?:"Breadcrumb"|'Breadcrumb')|pnm-product-breadcrumb|"@type"\s*:\s*"BreadcrumbList"/i.test(html),
    outboundInternalLinks: internalLinks(html), inboundInternalLinks: 0,
    mainImage: mainImage.src, mainImageAlt: mainImage.alt, inSitemap: sitemapSet.has(expectedCanonical),
    productId: pageType === 'PRODUTO' ? fileName.slice('produto-'.length, -'.html'.length) : null,
    productIdentity: product ? { nome: product.nome || '', marca: product.marca || '', categoria: product.categoria || '' } : null,
    productDataLevel: quality, contentInsufficient: quality === 'C', templateSignature: templateSignature(html),
    templateDuplicateGroupSize: 1, issues,
  };
}

function summarize(pages, sitemapProblems, orphanCandidates, missingProductPages) {
  const countIssue = code => pages.reduce((sum, page) => sum + page.issues.filter(item => item.code === code).length, 0);
  const priorities = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const page of pages) for (const item of page.issues) priorities[item.priority] += 1;
  const byType = {};
  for (const page of pages) byType[page.type] = (byType[page.type] || 0) + 1;
  const levels = { A: 0, B: 0, C: 0 };
  for (const page of pages.filter(item => item.type === 'PRODUTO')) if (page.productDataLevel) levels[page.productDataLevel] += 1;
  return {
    totalUrls: pages.length,
    urlsByType: Object.fromEntries(Object.entries(byType).sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))),
    indexable: pages.filter(page => page.indexable).length,
    noindexOrBlocked: pages.filter(page => !page.indexable).length,
    canonicalProblems: countIssue('CANONICAL_AUSENTE') + countIssue('CANONICAL_DIVERGENTE'),
    titleProblems: countIssue('TITLE_AUSENTE'), metaDescriptionProblems: countIssue('META_DESCRIPTION_AUSENTE'),
    h1Problems: countIssue('H1_AUSENTE') + countIssue('H1_MULTIPLO'),
    schemaProblems: countIssue('SCHEMA_INVALIDO') + countIssue('PRODUCT_SCHEMA_AUSENTE'), sitemapProblems,
    orphanCandidates: orphanCandidates.length, missingProductPages: missingProductPages.length,
    productPageProblems: pages.filter(page => page.type === 'PRODUTO' && page.issues.some(item => item.priority !== 'P3')).length,
    productDataLevels: levels, priorities,
  };
}

export function buildInventory(rootDir = DEFAULT_ROOT) {
  const root = path.resolve(rootDir);
  const htmlFiles = fs.readdirSync(root).filter(name => name.endsWith('.html')).sort((a, b) => a.localeCompare(b));
  const products = parseArrayFile(path.join(root, 'data', 'produtos-index.js'));
  const productById = new Map(products.map(item => [String(item.id), item]));
  const sitemapText = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  const sitemapUrls = [...sitemapText.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => decodeHtml(match[1]));
  const sitemapSet = new Set(sitemapUrls);
  const blockedRules = parseRobots(fs.readFileSync(path.join(root, 'robots.txt'), 'utf8'));
  const pages = htmlFiles.map(fileName => {
    const productId = /^produto-.+\.html$/i.test(fileName) && fileName !== 'produto.html' ? fileName.slice(8, -5) : null;
    return analyzeHtmlPage({ fileName, html: fs.readFileSync(path.join(root, fileName), 'utf8'), sitemapSet, blockedRules, product: productId ? productById.get(productId) : undefined });
  });
  const byRoute = new Map(pages.map(page => [page.path, page]));
  for (const page of pages) for (const target of page.outboundInternalLinks) if (byRoute.has(target)) byRoute.get(target).inboundInternalLinks += 1;
  const signatures = new Map();
  for (const page of pages) signatures.set(page.templateSignature, (signatures.get(page.templateSignature) || 0) + 1);
  for (const page of pages) page.templateDuplicateGroupSize = signatures.get(page.templateSignature) || 1;
  const orphanCandidates = pages.filter(page => page.indexable && page.path !== '/' && page.inboundInternalLinks === 0).map(page => page.path);
  for (const route of orphanCandidates) byRoute.get(route).issues.push(issue('P2', 'ORFA_CANDIDATA', 'Sem links internos de entrada reproduzíveis no HTML estático.'));

  const existingCanonicalUrls = new Set(pages.map(page => `${ORIGIN}${page.path}`));
  const sitemapMissingFiles = sitemapUrls.filter(url => url.startsWith(ORIGIN) && !existingCanonicalUrls.has(url));
  const sitemapMissingIndexable = pages.filter(page => page.indexable && !page.inSitemap).map(page => page.path);
  const sitemapProblems = sitemapMissingFiles.length + sitemapMissingIndexable.length + pages.filter(page => !page.indexable && page.inSitemap).length;
  const ownerIds = new Set(products.map(item => String(item.id)));
  const pageIds = new Set(pages.filter(page => page.type === 'PRODUTO').map(page => page.productId));
  const missingProductPages = [...ownerIds].filter(id => !pageIds.has(id));

  const report = {
    contract: 'pnm.seo-inventory/v1',
    generatedFrom: ['root HTML após build', 'sitemap.xml', 'robots.txt', 'data/produtos-index.js'],
    authoritative: false, deterministic: true, origin: ORIGIN, owner: 'data/produtos-index.js', summary: null,
    sitemap: { urls: sitemapUrls.length, missingFiles: sitemapMissingFiles, missingIndexable: sitemapMissingIndexable },
    orphanCandidates, missingProductPages, pages,
  };
  report.summary = summarize(pages, sitemapProblems, orphanCandidates, missingProductPages);
  return report;
}

function markdown(report) {
  const s = report.summary;
  const lines = [
    '# Inventário SEO — Preço na Mira', '', '> Artefato derivado e regenerável. Não é owner do catálogo.', '',
    `- Contrato: ${report.contract}`, `- URLs: ${s.totalUrls}`, `- Indexáveis: ${s.indexable}`, `- Noindex/bloqueadas: ${s.noindexOrBlocked}`,
    `- Produtos A/B/C: ${s.productDataLevels.A}/${s.productDataLevels.B}/${s.productDataLevels.C}`,
    `- Canonical problems: ${s.canonicalProblems}`, `- Title problems: ${s.titleProblems}`, `- Meta description problems: ${s.metaDescriptionProblems}`,
    `- H1 problems: ${s.h1Problems}`, `- Schema problems: ${s.schemaProblems}`, `- Sitemap problems: ${s.sitemapProblems}`,
    `- Órfãs/candidatas: ${s.orphanCandidates}`, `- Product-page problems: ${s.productPageProblems}`,
    `- Prioridades P0/P1/P2/P3: ${s.priorities.P0}/${s.priorities.P1}/${s.priorities.P2}/${s.priorities.P3}`,
    '', '## URLs por tipo', '', ...Object.entries(s.urlsByType).map(([type, count]) => `- ${type}: ${count}`),
  ];
  return `${lines.join('\n')}\n`;
}

function runCli() {
  const report = buildInventory(process.cwd());
  const outputDir = path.join(process.cwd(), '.audit');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'seo-inventory.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'seo-inventory.md'), markdown(report));
  console.log(JSON.stringify({ contract: report.contract, deterministic: true, authoritative: false, owner: report.owner, ...report.summary, output: '.audit/seo-inventory.json' }, null, 2));
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) runCli();
