import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { analyzeHtmlPage, buildInventory, classifyPage, parseStructuredData } from './seo-inventory.mjs';

const ORIGIN = 'https://preconamira.com.br';

function baseHtml({ title = 'Produto Fixture — Preço na Mira', description = 'Descrição factual suficientemente detalhada para a fixture de teste do inventário SEO.', h1 = 'Produto Fixture', canonical = `${ORIGIN}/produto-fixture`, robots = 'index,follow', extraHead = '', body = '' } = {}) {
  return `<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="${robots}"><title>${title}</title><meta name="description" content="${description}"><link rel="canonical" href="${canonical}">${extraHead}</head><body><main><h1>${h1}</h1><img src="/fixture.webp" alt="Foto do Produto Fixture">${body}</main></body></html>`;
}

const product = {
  id: 'fixture', nome: 'Produto Fixture', marca: 'Marca Fixture', categoria: 'Tecnologia',
  imagem: 'fixture.webp', imagemAlt: 'Foto do Produto Fixture', linkAfiliado: 'https://meli.la/fixture', loja: 'Mercado Livre',
  resumo: 'Resumo factual da fixture.', chamada: 'Chamada factual da fixture.', chips: ['A', 'B'], fonteTecnica: 'https://example.com/fonte',
};
const sitemapSet = new Set([`${ORIGIN}/produto-fixture`]);

function issueCodes(page) { return page.issues.map(item => item.code); }

function analyze(overrides = {}, fileName = 'produto-fixture.html') {
  return analyzeHtmlPage({ fileName, html: baseHtml(overrides), sitemapSet, blockedRules: [], product });
}

test('classificação de tipos de página é determinística', () => {
  assert.equal(classifyPage('index.html'), 'HOME');
  assert.equal(classifyPage('catalogo-pagina-2.html'), 'CATÁLOGO');
  assert.equal(classifyPage('ofertas.html'), 'OFERTAS');
  assert.equal(classifyPage('produto-fixture.html'), 'PRODUTO');
  assert.equal(classifyPage('tvs.html'), 'CATEGORIA');
  assert.equal(classifyPage('montar-casa.html'), 'PROJETOS/JORNADAS');
});

test('hubs modernos são categorias sem engolir guias e rankings', () => {
  for (const file of ['smartphones.html', 'soundbars.html', 'projetores.html', 'fones-de-ouvido.html', 'caixas-de-som.html', 'pecas-pc.html', 'casa-inteligente.html']) {
    assert.equal(classifyPage(file), 'CATEGORIA', file);
  }
  for (const file of ['melhores-smartphones.html', 'melhores-soundbars.html', 'melhores-projetores.html', 'soundbar-para-tv.html', 'projetor-para-quarto.html']) {
    assert.equal(classifyPage(file), 'OUTROS', file);
  }
});

test('title ausente é detectado', () => {
  const html = baseHtml().replace(/<title>[\s\S]*?<\/title>/i, '');
  const page = analyzeHtmlPage({ fileName: 'produto-fixture.html', html, sitemapSet, blockedRules: [], product });
  assert.ok(issueCodes(page).includes('TITLE_AUSENTE'));
});

test('H1 ausente é detectado', () => {
  const html = baseHtml().replace(/<h1>[\s\S]*?<\/h1>/i, '');
  const page = analyzeHtmlPage({ fileName: 'produto-fixture.html', html, sitemapSet, blockedRules: [], product });
  assert.ok(issueCodes(page).includes('H1_AUSENTE'));
});

test('H1 múltiplo é detectado', () => {
  const page = analyze({ body: '<h1>Segundo H1</h1>' });
  assert.ok(issueCodes(page).includes('H1_MULTIPLO'));
});

test('canonical ausente é detectado', () => {
  const html = baseHtml().replace(/<link rel="canonical"[^>]*>/i, '');
  const page = analyzeHtmlPage({ fileName: 'produto-fixture.html', html, sitemapSet, blockedRules: [], product });
  assert.ok(issueCodes(page).includes('CANONICAL_AUSENTE'));
});

test('canonical divergente é detectado', () => {
  const page = analyze({ canonical: `${ORIGIN}/outra-pagina` });
  assert.ok(issueCodes(page).includes('CANONICAL_DIVERGENTE'));
});

test('noindex não vira indexável e sitemap inconsistente é detectado', () => {
  const page = analyze({ robots: 'noindex,follow' });
  assert.equal(page.indexable, false);
  assert.ok(issueCodes(page).includes('NAO_INDEXAVEL_NO_SITEMAP'));
});

test('structured data inválido é detectado', () => {
  const page = analyze({ extraHead: '<script type="application/ld+json">{"@type":</script>' });
  assert.ok(issueCodes(page).includes('SCHEMA_INVALIDO'));
});

test('Product schema ausente é detectado por regra de produto', () => {
  const page = analyze();
  assert.ok(issueCodes(page).includes('PRODUCT_SCHEMA_AUSENTE'));
});

test('structured data válido coleta tipos', () => {
  const parsed = parseStructuredData('<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Product"},{"@type":"BreadcrumbList"}]}</script>');
  assert.deepEqual(parsed.types, ['BreadcrumbList', 'Product']);
  assert.equal(parsed.invalid, 0);
});

test('página de produto sem identidade suficiente no owner vira nível C', () => {
  const poor = { id: 'fixture', nome: 'Produto Fixture', imagem: 'x.webp', imagemAlt: 'Foto' };
  const page = analyzeHtmlPage({ fileName: 'produto-fixture.html', html: baseHtml(), sitemapSet, blockedRules: [], product: poor });
  assert.equal(page.productDataLevel, 'C');
  assert.ok(issueCodes(page).includes('PRODUTO_NIVEL_C'));
});

test('URL duplicada/variante relevante aparece como canonical divergente', () => {
  const page = analyze({ canonical: `${ORIGIN}/produto-fixture/` });
  assert.ok(issueCodes(page).includes('CANONICAL_DIVERGENTE'));
});

test('inventário completo retorna o mesmo resultado para a mesma entrada e detecta órfã', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pnm-seo-inventory-'));
  try {
    fs.mkdirSync(path.join(root, 'data'));
    fs.writeFileSync(path.join(root, 'data', 'produtos-index.js'), `const PRODUTOS = ${JSON.stringify([product])};\n`);
    fs.writeFileSync(path.join(root, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`);
    fs.writeFileSync(path.join(root, 'sitemap.xml'), `<?xml version="1.0"?><urlset><url><loc>${ORIGIN}/</loc></url><url><loc>${ORIGIN}/produto-fixture</loc></url></urlset>`);
    fs.writeFileSync(path.join(root, 'index.html'), baseHtml({ canonical: `${ORIGIN}/`, title: 'Preço na Mira — Fixture', description: 'Página inicial factual suficientemente detalhada para o teste.', h1: 'Preço na Mira', body: '<a href="produto-fixture">Produto</a>' }));
    fs.writeFileSync(path.join(root, 'produto-fixture.html'), baseHtml({ extraHead: '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Produto Fixture"}</script>' }));
    fs.writeFileSync(path.join(root, 'isolada.html'), baseHtml({ canonical: `${ORIGIN}/isolada`, title: 'Página isolada de teste', description: 'Uma página isolada usada somente para validar a detecção reproduzível de links.', h1: 'Isolada' }));
    const first = buildInventory(root);
    const second = buildInventory(root);
    assert.deepEqual(first, second);
    assert.ok(first.orphanCandidates.includes('/isolada'));
    assert.equal(first.summary.totalUrls, 3);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
