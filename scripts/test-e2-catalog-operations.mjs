#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MOBILE_FIELDS, validateCatalog } from './validar-catalogo-operacional.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REFINE_SCRIPT = path.join(REPO_ROOT, 'scripts', 'refinar-ofertas-curadas.mjs');

function product(index) {
  const id = `fixture-produto-${String(index).padStart(2, '0')}`;
  return {
    id,
    nome: `Produto Fixture ${index}`,
    marca: `Marca ${index}`,
    categoria: 'Tecnologia',
    categoriaId: 'tecnologia',
    tipoProduto: 'tecnologia',
    imagem: `assets/${id}.webp`,
    imagemAlt: `Foto ${index}`,
    linkAfiliado: `https://meli.la/fixture${String(index).padStart(2, '0')}`,
    loja: 'Mercado Livre',
    resumo: `Resumo ${index}`,
    chamada: `Motivo ${index}`,
    imagemFallback: 'assets/product-photo-unavailable.svg',
    imagemTipo: 'oficial',
  };
}

function writeProductArray(file, products, prefix = 'const PRODUTOS = ') {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${prefix}${JSON.stringify(products)};\n`);
}

function projected(products) {
  return products.map(item => Object.fromEntries(MOBILE_FIELDS.filter(field => item[field] !== undefined).map(field => [field, item[field]])));
}

function card(id) {
  return `<article data-pnm-product-id="${id}"></article>`;
}

function productPage(item) {
  return `<!doctype html><html><body data-product-id="${item.id}"><h1>${item.nome}</h1><a href="${item.linkAfiliado}">oferta</a></body></html>`;
}

function writeDerived(root, products) {
  writeProductArray(path.join(root, 'data', 'produtos-mobile.js'), projected(products));
  const offers = products.slice(0, 30);
  writeProductArray(path.join(root, 'data', 'produtos-ofertas.js'), projected(offers));
  fs.writeFileSync(path.join(root, 'data', 'dewalt-pendentes.js'), `window.PNM_DEWALT_PENDING=${JSON.stringify([{id:1,link:'https://meli.la/d1'},{id:2,link:'https://meli.la/d2'}])};\n`);

  fs.writeFileSync(path.join(root, 'catalogo.html'),
    `<!-- PNM:SEO:CATALOGO:START -->${products.map(item => card(item.id)).join('')}<!-- PNM:SEO:CATALOGO:END -->`);
  fs.writeFileSync(path.join(root, 'ofertas.html'),
    `<!-- PNM:SEO:OFERTAS:START -->${offers.map(item => card(item.id)).join('')}<!-- PNM:SEO:OFERTAS:END -->`);
  fs.writeFileSync(path.join(root, 'index.html'),
    `<!-- PNM:SEO:HOME-HIGHLIGHTS:START -->${products.slice(0, 6).map(item => card(item.id)).join('')}<!-- PNM:SEO:HOME-HIGHLIGHTS:END -->`);
}

function writePages(root, products) {
  for (const item of products) fs.writeFileSync(path.join(root, `produto-${item.id}.html`), productPage(item));
}

function writeCanonical(root, products) {
  writeProductArray(path.join(root, 'data', 'produtos-index.js'), products);
}

function expectOk(root, label) {
  const result = validateCatalog(root);
  assert.equal(result.ok, true, `${label}: ${result.summary.errors.join(' | ')}`);
}

function expectFail(root, pattern, label) {
  const result = validateCatalog(root);
  assert.equal(result.ok, false, `${label}: deveria falhar`);
  assert.match(result.summary.errors.join('\n'), pattern, `${label}: falha esperada não encontrada`);
}

function lifecycleTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pnm-e2-lifecycle-'));
  try {
    let products = Array.from({length: 30}, (_, index) => product(index + 1));
    writeCanonical(root, products);
    writeDerived(root, products);
    writePages(root, products);
    expectOk(root, 'baseline');

    const added = product(31);
    products = [...products, added];
    writeCanonical(root, products);
    expectFail(root, /Fonte\/mobile divergem|Páginas de produto ausentes|Catálogo diverge/, 'novo produto sem build');
    writeDerived(root, products);
    writePages(root, [added]);
    expectOk(root, 'novo produto sincronizado');

    products = products.map((item, index) => index === 0
      ? {...item, nome: 'Produto Fixture 1 Editado', linkAfiliado: 'https://meli.la/fixture01editado'}
      : item);
    writeCanonical(root, products);
    expectFail(root, /Derivado mobile desatualizado|Nome da página divergente|Link afiliado da página divergente/, 'edição sem build');
    writeDerived(root, products);
    writePages(root, products);
    expectOk(root, 'edição sincronizada');

    const removed = products.at(-1);
    products = products.slice(0, -1);
    writeCanonical(root, products);
    writeDerived(root, products);
    expectFail(root, /Páginas de produto órfãs/, 'remoção com página órfã');
    fs.unlinkSync(path.join(root, `produto-${removed.id}.html`));
    expectOk(root, 'remoção sincronizada');

    return {
      newProduct: 'PASS — divergência detectada antes da sincronização e ciclo coerente depois',
      edit: 'PASS — derivado/página desatualizados falham; sincronização restaura coerência',
      remove: 'PASS — página órfã falha; remoção completa restaura coerência',
    };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function offerOverrideTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pnm-e2-offers-'));
  try {
    const products = Array.from({length: 40}, (_, index) => {
      const item = product(index + 1);
      item.marca = `Marca Única ${index + 1}`;
      if (index === 0) {
        item.destaque = true;
        item.selo = 'Premium';
        item.oferta = false;
      }
      if (index === 39) item.oferta = true;
      return item;
    });
    writeProductArray(path.join(root, 'data', 'produtos-mobile.js'), projected(products));
    fs.writeFileSync(path.join(root, 'ofertas.html'), [
      '<!doctype html><html><head><title>Fixture</title>',
      '<link rel="canonical" href="https://preconamira.com.br/ofertas">',
      '<meta property="og:url" content="https://preconamira.com.br/ofertas">',
      '<meta property="og:title" content="Fixture">',
      '<meta name="twitter:title" content="Fixture">',
      '<!-- PNM:SEO:HEAD:START --><!-- PNM:SEO:HEAD:END -->',
      '</head><body data-pnm-static-page="1">',
      '<!-- PNM:SEO:OFERTAS:START --><!-- PNM:SEO:OFERTAS:END -->',
      '<!-- PNM:SEO:OFERTAS:PAGINATION:START --><!-- PNM:SEO:OFERTAS:PAGINATION:END -->',
      '</body></html>',
    ].join(''));

    const run = spawnSync(process.execPath, [REFINE_SCRIPT], { cwd: root, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr || run.stdout);
    const html = fs.readFileSync(path.join(root, 'ofertas.html'), 'utf8');
    const ids = [...html.matchAll(/data-pnm-product-id="([^"]+)"/g)].map(match => match[1]);
    assert.equal(ids.length, 30, 'curadoria deve manter 30 ofertas');
    assert.equal(ids.includes('fixture-produto-40'), true, 'oferta:true deve forçar inclusão');
    assert.equal(ids.includes('fixture-produto-01'), false, 'oferta:false deve forçar exclusão');

    return {
      offerOn: 'PASS — oferta:true força inclusão na curadoria de 30',
      offerOff: 'PASS — oferta:false impede inclusão na curadoria',
    };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const lifecycle = lifecycleTest();
const offers = offerOverrideTest();
console.log(JSON.stringify({
  fixtureOnly: true,
  productionDataModified: false,
  testNewProduct: lifecycle.newProduct,
  testEdit: lifecycle.edit,
  testRemove: lifecycle.remove,
  testOfferOn: offers.offerOn,
  testOfferOff: offers.offerOff,
}, null, 2));
