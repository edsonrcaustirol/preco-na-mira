import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const BASE_URL = 'https://edsonrcaustirol.github.io/preco-na-mira/';
const PRIVATE_PAGES = new Set([
  'busca.html',
  'favoritos.html',
  'minha-lista.html'
]);
const LOCAL_ONLY_PAGES = new Set([
  'gerenciador.html',
  'importador.html'
]);
const zipUpdate = (args) => {
  try {
    execFileSync('zip', args, { cwd: ROOT });
  } catch (error) {
    // O código 12 significa apenas que todos os arquivos já estavam atualizados.
    if (error.status !== 12) throw error;
  }
};

const archiveEntries = execFileSync('unzip', ['-Z1', 'site-base.zip'], {
  cwd: ROOT,
  encoding: 'utf8'
}).trim().split(/\r?\n/);

const htmlPages = readdirSync(ROOT).filter((name) => /^[^/]+\.html$/.test(name) && !LOCAL_ONLY_PAGES.has(name)).sort();
const localOnlyEntries = archiveEntries.filter((name) => LOCAL_ONLY_PAGES.has(name));
const publicPages = htmlPages.filter((name) => !PRIVATE_PAGES.has(name) && !LOCAL_ONLY_PAGES.has(name));

if (localOnlyEntries.length) {
  execFileSync('zip', ['-q', '-d', 'site-base.zip', ...localOnlyEntries], { cwd: ROOT });
}

for (const page of publicPages) {
  const path = resolve(ROOT, page);
  let html = readFileSync(path, 'utf8');

  if (/<meta\s+name=["']robots["']/i.test(html)) {
    html = html.replace(
      /<meta\s+name=["']robots["']\s+content=["'][^"']*["']\s*\/?\s*>/i,
      '<meta name="robots" content="index,follow">'
    );
  } else {
    html = html.replace(/<\/head>/i, '<meta name="robots" content="index,follow"></head>');
  }

  writeFileSync(path, html);
}

const robots = [
  'User-agent: *',
  'Allow: /',
  'Disallow: /preco-na-mira/gerenciador.html',
  'Disallow: /preco-na-mira/importador.html',
  'Disallow: /preco-na-mira/busca.html',
  'Disallow: /preco-na-mira/favoritos.html',
  'Disallow: /preco-na-mira/minha-lista.html',
  `Sitemap: ${BASE_URL}sitemap.xml`,
  ''
].join('\n');
writeFileSync(resolve(ROOT, 'robots.txt'), robots);

const productSource = readFileSync(resolve(ROOT, 'data/produtos.js'), 'utf8');
const productIds = [...productSource.matchAll(/\n\s+"id":\s+"([^"]+)"/g)].map((match) => match[1]);
const urls = [
  ...publicPages.map((page) => page === 'index.html' ? BASE_URL : `${BASE_URL}${page}`),
  ...productIds.map((id) => `${BASE_URL}produto.html?id=${encodeURIComponent(id)}`)
];

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map((url) => `  <url><loc>${url.replace(/&/g, '&amp;')}</loc></url>`),
  '</urlset>',
  ''
].join('\n');
writeFileSync(resolve(ROOT, 'sitemap.xml'), xml);

zipUpdate(['-q', '-u', 'site-base.zip', ...htmlPages, 'robots.txt', 'sitemap.xml']);
zipUpdate(['-q', '-u', 'site-base.zip', 'data/produtos.js', 'data/experiencias.js']);
zipUpdate(['-q', '-r', '-u', 'site-base.zip', 'assets']);

console.log(JSON.stringify({
  paginasIndexaveis: publicPages.length,
  produtosNoSitemap: productIds.length,
  urlsNoSitemap: urls.length
}));
