#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MOBILE_FIELDS, validateCatalog } from './validar-catalogo-operacional.mjs';
import { synchronizeCatalog } from './sincronizar-catalogo.mjs';

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

function card(id) { return `<article data-pnm-product-id="${id}"></article>`; }

function writeSecondaryDerived(root, products) {
  const offers = products.slice(0, 30);
  writeProductArray(path.join(root, 'data', 'produtos-ofertas.js'), projected(offers));
  fs.writeFileSync(path.join(root, 'data', 'dewalt-pendentes.js'), `window.PNM_DEWALT_PENDING=${JSON.stringify([{id:1,link:'https://meli.la/d1'},{id:2,link:'https://meli.la/d2'}])};\n`);
  fs.writeFileSync(path.join(root, 'catalogo.html'), `<!-- PNM:SEO:CATALOGO:START -->${products.map(item => card(item.id)).join('')}<!-- PNM:SEO:CATALOGO:END -->`);
  fs.writeFileSync(path.join(root, 'ofertas.html'), `<!-- PNM:SEO:OFERTAS:START -->${offers.map(item => card(item.id)).join('')}<!-- PNM:SEO:OFERTAS:END -->`);
  fs.writeFileSync(path.join(root, 'index.html'), `<!-- PNM:SEO:HOME-HIGHLIGHTS:START -->${products.slice(0, 6).map(item => card(item.id)).join('')}<!-- PNM:SEO:HOME-HIGHLIGHTS:END -->`);
}

function writeCanonical(root, products) { writeProductArray(path.join(root, 'data', 'produtos-index.js'), products); }
function expectOk(root, label) {
  const result = validateCatalog(root);
  assert.equal(result.ok, true, `${label}: ${result.summary.errors.join(' | ')}`);
}
function expectFail(root, pattern, label) {
  const result = validateCatalog(root);
  assert.equal(result.ok, false, `${label}: deveria falhar`);
  assert.match(result.summary.errors.join('\n'), pattern, `${label}: falha esperada não encontrada`);
}
function syncAndValidate(root, products, label) {
  const result = synchronizeCatalog(root);
  writeSecondaryDerived(root, products);
  expectOk(root, label);
  assert.equal(result.owner, products.length);
  assert.equal(result.mobile, products.length);
  assert.equal(result.pages, products.length);
  return result;
}

function lifecycleTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pnm-e2-lifecycle-'));
  try {
    let products = Array.from({length: 30}, (_, index) => product(index + 1));
    writeCanonical(root, products);
    syncAndValidate(root, products, 'baseline');

    products = [...products, product(31)];
    writeCanonical(root, products);
    expectFail(root, /Fonte\/mobile divergem|Páginas de produto ausentes|Catálogo diverge/, 'novo produto sem build');
    syncAndValidate(root, products, 'novo produto sincronizado');

    products = [...products, product(32), product(33), product(34), product(35)];
    writeCanonical(root, products);
    syncAndValidate(root, products, 'lote sincronizado');

    products = products.map((item, index) => index === 0 ? {...item, nome: 'Produto Fixture 1 Editado', linkAfiliado: 'https://meli.la/fixture01editado'} : item);
    writeCanonical(root, products);
    expectFail(root, /Derivado mobile desatualizado|Nome da página divergente|Link afiliado da página divergente/, 'edição sem build');
    syncAndValidate(root, products, 'edição sincronizada');

    const removed = products.at(-1);
    products = products.slice(0, -1);
    writeCanonical(root, products);
    expectFail(root, /Fonte\/mobile divergem|Páginas de produto órfãs/, 'remoção sem build');
    syncAndValidate(root, products, 'remoção sincronizada');
    assert.equal(fs.existsSync(path.join(root, `produto-${removed.id}.html`)), false);

    const stableProducts = structuredClone(products);
    const mobileBefore = fs.readFileSync(path.join(root, 'data', 'produtos-mobile.js'), 'utf8');

    writeCanonical(root, [...stableProducts, {...stableProducts[0]}]);
    assert.throws(() => synchronizeCatalog(root), /ID duplicado/);
    assert.equal(fs.readFileSync(path.join(root, 'data', 'produtos-mobile.js'), 'utf8'), mobileBefore);

    writeCanonical(root, [...stableProducts, {...product(90), imagem: ''}]);
    assert.throws(() => synchronizeCatalog(root), /Produto incompleto/);
    assert.equal(fs.readFileSync(path.join(root, 'data', 'produtos-mobile.js'), 'utf8'), mobileBefore);

    const legacyTrailingHyphen = {...product(92), id: 'fixture-legado-', linkAfiliado: 'https://meli.la/fixturelegado'};
    writeCanonical(root, [...stableProducts, legacyTrailingHyphen]);
    syncAndValidate(root, [...stableProducts, legacyTrailingHyphen], 'id legado com hífen final');
    assert.equal(fs.existsSync(path.join(root, 'produto-fixture-legado-.html')), true);

    const stableWithLegacy = [...stableProducts, legacyTrailingHyphen];
    const mobileWithLegacy = fs.readFileSync(path.join(root, 'data', 'produtos-mobile.js'), 'utf8');
    const traversal = {...product(93), id: '../escape', linkAfiliado: 'https://meli.la/fixtureescape'};
    writeCanonical(root, [...stableWithLegacy, traversal]);
    assert.throws(() => synchronizeCatalog(root), /ID inválido/);
    assert.equal(fs.readFileSync(path.join(root, 'data', 'produtos-mobile.js'), 'utf8'), mobileWithLegacy);
    assert.equal(fs.existsSync(path.join(root, '..', 'produto-escape.html')), false);

    const leadingHyphen = {...product(94), id: '-fixture-invalido', linkAfiliado: 'https://meli.la/fixtureleading'};
    writeCanonical(root, [...stableWithLegacy, leadingHyphen]);
    assert.throws(() => synchronizeCatalog(root), /ID inválido/);
    assert.equal(fs.readFileSync(path.join(root, 'data', 'produtos-mobile.js'), 'utf8'), mobileWithLegacy);

    writeCanonical(root, stableProducts);
    syncAndValidate(root, stableProducts, 'restauração após regressões de ID');

    const transactionCandidate = product(91);
    const stableMobile = fs.readFileSync(path.join(root, 'data', 'produtos-mobile.js'), 'utf8');
    writeCanonical(root, [...stableProducts, transactionCandidate]);
    assert.throws(() => synchronizeCatalog(root, { failAfter: 1 }), /Falha transacional simulada/);
    assert.equal(fs.readFileSync(path.join(root, 'data', 'produtos-mobile.js'), 'utf8'), stableMobile);
    assert.equal(fs.existsSync(path.join(root, `produto-${transactionCandidate.id}.html`)), false);

    writeCanonical(root, stableProducts);
    syncAndValidate(root, stableProducts, 'restauração pós-falha simulada');

    return {
      add: 'PASS — owner isolado falha e sincronizador cria mobile + página',
      batch: 'PASS — lote cria derivados em uma única execução',
      edit: 'PASS — nome/link são sincronizados a partir do owner',
      remove: 'PASS — página órfã é removida automaticamente',
      duplicate: 'PASS — duplicidade falha antes de qualquer escrita',
      incomplete: 'PASS — produto incompleto falha antes de qualquer escrita',
      legacyId: 'PASS — ID legado terminado em hífen é aceito e gera página prevista',
      unsafeId: 'PASS — path traversal e hífen inicial continuam bloqueados antes da escrita',
      transaction: 'PASS — falha simulada restaura derivados anteriores',
    };
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

function offerOverrideTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pnm-e2-offers-'));
  try {
    const products = Array.from({length: 40}, (_, index) => {
      const item = product(index + 1);
      item.marca = `Marca Única ${index + 1}`;
      if (index === 0) { item.destaque = true; item.selo = 'Premium'; item.oferta = false; }
      if (index === 39) item.oferta = true;
      return item;
    });
    writeProductArray(path.join(root, 'data', 'produtos-mobile.js'), projected(products));
    fs.writeFileSync(path.join(root, 'ofertas.html'), ['<!doctype html><html><head><title>Fixture</title>','<link rel="canonical" href="https://preconamira.com.br/ofertas">','<meta property="og:url" content="https://preconamira.com.br/ofertas">','<meta property="og:title" content="Fixture">','<meta name="twitter:title" content="Fixture">','<!-- PNM:SEO:HEAD:START --><!-- PNM:SEO:HEAD:END -->','</head><body data-pnm-static-page="1">','<!-- PNM:SEO:OFERTAS:START --><!-- PNM:SEO:OFERTAS:END -->','<!-- PNM:SEO:OFERTAS:PAGINATION:START --><!-- PNM:SEO:OFERTAS:PAGINATION:END -->','</body></html>'].join(''));
    const run = spawnSync(process.execPath, [REFINE_SCRIPT], { cwd: root, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr || run.stdout);
    const html = fs.readFileSync(path.join(root, 'ofertas.html'), 'utf8');
    const ids = [...html.matchAll(/data-pnm-product-id="([^"]+)"/g)].map(match => match[1]);
    assert.equal(ids.length, 30);
    assert.equal(ids.includes('fixture-produto-40'), true);
    assert.equal(ids.includes('fixture-produto-01'), false);
    return { offerOn: 'PASS — oferta:true força inclusão na curadoria de 30', offerOff: 'PASS — oferta:false impede inclusão na curadoria' };
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

const lifecycle = lifecycleTest();
const offers = offerOverrideTest();
console.log(JSON.stringify({ fixtureOnly: true, productionDataModified: false, pipelineAdd: lifecycle.add, pipelineBatch: lifecycle.batch, pipelineEdit: lifecycle.edit, pipelineRemove: lifecycle.remove, duplicateGuard: lifecycle.duplicate, incompleteGuard: lifecycle.incomplete, legacyTrailingHyphenId: lifecycle.legacyId, unsafeIdGuard: lifecycle.unsafeId, transactionalRollback: lifecycle.transaction, testOfferOn: offers.offerOn, testOfferOff: offers.offerOff }, null, 2));
