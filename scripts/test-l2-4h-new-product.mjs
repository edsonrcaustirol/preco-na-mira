#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseArrayFile } from './seo-inventory.mjs';
import {
  analyzeNewProductInput,
  analyzeNewProductBatch,
  CENTRAL_NEW_PRODUCT_CONTRACT,
  CENTRAL_NEW_PRODUCT_BATCH_CONTRACT,
  NEW_PRODUCT_PROVENANCE,
} from '../central/src/new-product.mjs';
import { renderNewProductPage } from '../central/src/new-product-page.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, p))).digest('hex');
const ownerPath = 'data/produtos-index.js';
const mobilePath = 'data/produtos-mobile.js';
const ownerBefore = hash(ownerPath);
const mobileBefore = hash(mobilePath);
const generatedPath = path.join(ROOT, 'central/src/generated/products.mjs');
if (!fs.existsSync(generatedPath)) {
  const built = spawnSync(process.execPath, ['scripts/build-central-products.mjs'], { cwd: ROOT, stdio: 'inherit', shell: false });
  assert.equal(built.status, 0);
}
const { CENTRAL_PRODUCTS_PROJECTION } = await import('../central/src/generated/products.mjs');
const products = CENTRAL_PRODUCTS_PROJECTION.products;
const ownerProducts = parseArrayFile(path.join(ROOT, ownerPath));
assert.equal(products.length, ownerProducts.length, 'projeção da Central deve refletir o owner atual');

function completeInput(index, overrides = {}) {
  return {
    linkAfiliado: `https://meli.la/m11-fixture-${index}`,
    id: `m11-fixture-${index}`,
    nome: `Produto M1.1 Fixture ${index}`,
    marca: 'Marca Fixture',
    categoria: 'Tecnologia',
    imagem: `assets/m11-fixture-${index}.webp`,
    imagemAlt: `Foto do Produto M1.1 Fixture ${index}`,
    resumo: `Resumo fixture ${index}`,
    ...overrides,
  };
}

const short = analyzeNewProductInput({
  linkAfiliado: '  https://meli.la/AbC123?utm_source=x#frag  ',
  nome: 'Produto Teste',
  marca: 'Marca X',
  categoria: 'TV',
  imagem: 'assets/x.webp',
  imagemAlt: 'Foto',
  resumo: 'Resumo',
}, products);
assert.equal(short.contract, CENTRAL_NEW_PRODUCT_CONTRACT);
assert.equal(short.link.ok, true);
assert.equal(short.link.shortUrl, true);
assert.match(short.link.normalized, /\?utm_source=x#frag$/);
assert.doesNotMatch(short.link.comparisonKey, /utm_source|#frag/);
assert.equal(short.fields.linkAfiliado.provenance, NEW_PRODUCT_PROVENANCE.AUTOMATIC);
assert.equal(short.fields.loja.value, 'Mercado Livre');
assert.equal(short.fields.id.provenance, NEW_PRODUCT_PROVENANCE.SUGGESTED);
assert.equal(short.fields.marca.provenance, NEW_PRODUCT_PROVENANCE.HUMAN);
assert.equal(short.state, 'REVISÃO');
assert.equal(short.canAdvanceText, 'NÃO');
assert.ok(short.pending.some(item => item.code === 'CONFIRM_SUGGESTED_ID'));
assert.equal(short.publicationState, 'NÃO PUBLICADO');
assert.equal(short.publicationEnabled, false);
assert.equal(short.conceptualDiff.applicablePatch, false);
assert.equal(short.l11.contract, 'pnm.affiliate-integrity/v1');
assert.equal(short.l11.browserDispatch, false);

const ready = analyzeNewProductInput(completeInput(1), products);
assert.equal(ready.state, 'PRONTO');
assert.equal(ready.canAdvanceText, 'SIM');
assert.match(ready.why, /completos/i);

assert.equal(analyzeNewProductInput({ link: 'https://www.mercadolivre.com.br/item/ABC?tracking=1' }, []).link.ok, true);
for (const bad of [
  'https://example.com/item',
  'https://mercadolivre.com.br.evil.example/item',
  'https://meli.la:8443/item',
  'not a url',
]) {
  const result = analyzeNewProductInput({ link: bad }, []);
  assert.equal(result.state, 'BLOQUEADO');
  assert.equal(result.canAdvanceText, 'NÃO');
}

const first = products[0];
const duplicate = analyzeNewProductInput({ linkAfiliado: first.linkAfiliado }, products);
assert.equal(duplicate.state, 'DUPLICADO');
assert.equal(duplicate.duplicate.objective, true);
assert.equal(duplicate.duplicate.product.id, first.id);
assert.ok(duplicate.blocking.some(item => item.code === 'DUPLICATE_LINK'));

const trackingDuplicate = analyzeNewProductInput({ linkAfiliado: `${first.linkAfiliado}?utm_source=m1#historico` }, products);
assert.equal(trackingDuplicate.state, 'DUPLICADO');
assert.equal(trackingDuplicate.duplicate.objective, true);
assert.equal(trackingDuplicate.duplicate.product.id, first.id);

const collision = analyzeNewProductInput({ ...completeInput(2), id: first.id }, products);
assert.equal(collision.state, 'DUPLICADO');
assert.equal(collision.idCollision.objective, true);
assert.ok(collision.blocking.some(item => item.code === 'DUPLICATE_ID'));

const incomplete = analyzeNewProductInput({ linkAfiliado: 'https://meli.la/m11-incomplete' }, products);
assert.equal(incomplete.state, 'REVISÃO');
assert.equal(incomplete.canAdvanceText, 'NÃO');
assert.ok(incomplete.pending.length > 0);

const textBatch = analyzeNewProductBatch('https://meli.la/m11-line-a\nhttps://meli.la/m11-line-b', []);
assert.equal(textBatch.contract, CENTRAL_NEW_PRODUCT_BATCH_CONTRACT);
assert.equal(textBatch.summary.total, 2);
assert.deepEqual(textBatch.items.map(item => item.line), [1, 2]);
assert.ok(textBatch.items.every(item => item.state === 'REVISÃO'));

const validBatchInput = [completeInput(10), completeInput(11)];
const validBatch = analyzeNewProductBatch(validBatchInput, products);
assert.equal(validBatch.state, 'PRONTO');
assert.equal(validBatch.canAdvanceText, 'SIM');
assert.deepEqual(validBatch.summary, { total: 2, prontos: 2, revisao: 0, bloqueados: 0, duplicados: 0 });
assert.ok(validBatch.items.every(item => item.result.publicationEnabled === false));

const mixedBatchInput = [
  completeInput(20),
  { linkAfiliado: first.linkAfiliado },
  { linkAfiliado: 'https://example.com/item' },
  { linkAfiliado: 'https://meli.la/m11-review-only' },
  { linkAfiliado: 'https://mercadolivre.com.br.evil.example/item' },
];
const mixedBatch = analyzeNewProductBatch(mixedBatchInput, products);
assert.equal(mixedBatch.state, 'REVISÃO');
assert.equal(mixedBatch.canAdvanceText, 'NÃO');
assert.deepEqual(mixedBatch.summary, { total: 5, prontos: 1, revisao: 1, bloqueados: 2, duplicados: 1 });
assert.deepEqual(mixedBatch.items.map(item => item.state), ['PRONTO', 'DUPLICADO', 'BLOQUEADO', 'REVISÃO', 'BLOQUEADO']);
assert.equal(mixedBatch.preview.length, 5);
assert.equal(mixedBatch.conceptualDiff.records.length, 5);
assert.equal(mixedBatch.conceptualDiff.applicablePatch, false);
assert.match(mixedBatch.publicationMessage, /ANÁLISE != PUBLICAÇÃO/);

const internalDuplicate = analyzeNewProductBatch([
  completeInput(30),
  completeInput(31, { linkAfiliado: 'https://meli.la/m11-fixture-30?utm_source=duplicate#x' }),
], products);
assert.equal(internalDuplicate.summary.duplicados, 1);
assert.equal(internalDuplicate.items[0].state, 'PRONTO');
assert.equal(internalDuplicate.items[1].state, 'DUPLICADO');
assert.equal(internalDuplicate.items[1].result.batchDuplicate.objective, true);
assert.equal(internalDuplicate.items[1].result.batchDuplicate.conflicts[0].firstLine, 1);
assert.ok(internalDuplicate.items[1].result.blocking.some(item => item.code === 'DUPLICATE_IN_BATCH'));

const internalIdDuplicate = analyzeNewProductBatch([
  completeInput(40),
  completeInput(41, { id: 'm11-fixture-40' }),
], products);
assert.equal(internalIdDuplicate.summary.duplicados, 1);
assert.equal(internalIdDuplicate.items[1].state, 'DUPLICADO');
assert.equal(internalIdDuplicate.items[1].result.batchDuplicate.conflicts[0].type, 'ID');

const emptyBatch = analyzeNewProductBatch('', products);
assert.equal(emptyBatch.state, 'BLOQUEADO');
assert.equal(emptyBatch.summary.total, 0);
assert.equal(emptyBatch.canAdvanceText, 'NÃO');
assert.equal(emptyBatch.errors[0].code, 'BATCH_EMPTY');

assert.deepEqual(analyzeNewProductInput(completeInput(50), products), analyzeNewProductInput(completeInput(50), products));
assert.deepEqual(analyzeNewProductBatch(mixedBatchInput, products), analyzeNewProductBatch(mixedBatchInput, products));

const html = renderNewProductPage(CENTRAL_PRODUCTS_PROJECTION, 'fixtureNonce');
for (const expected of [
  '1. LINK', '2. ANÁLISE', '3. DADOS', '4. REVISÃO',
  'AUTOMÁTICO', 'SUGERIDO', 'HUMANO', 'BLOQUEANTE',
  'NÃO PUBLICADO', 'Diff conceitual', 'PODE AVANÇAR?',
  'Cadastro em massa', 'ANALISAR LOTE', 'Resultado por item',
  'Preview do lote', 'ANÁLISE != PUBLICAÇÃO',
]) assert.match(html, new RegExp(expected));
assert.match(html, /um link por linha/i);
assert.match(html, /porta não padrão/);
assert.match(html, /<button class="publish" type="button" disabled>PUBLICAR<\/button>/);
assert.match(html, /overflow-x:hidden/);
assert.match(html, /word-break:break-word|overflow-wrap:anywhere/);
assert.match(html, /script nonce="fixtureNonce"/);

const newProductSource = read('central/src/new-product.mjs');
const pageSource = read('central/src/new-product-page.mjs');
const workerSource = read('central/src/worker.mjs');
const source = [newProductSource, pageSource, workerSource].join('\n');
assert.doesNotMatch(source, /api\.github\.com|GITHUB_TOKEN|gh[pousr]_[A-Za-z0-9_]{20,}/i);
assert.doesNotMatch(newProductSource, /\bfetch\s*\(|spawnSync|validateCatalog|recordAuditHistory|\bD1\b/);
assert.match(newProductSource, /analyzeNewProductBatch[\s\S]*analyzeNewProductInput\(entry, products\)/);
assert.doesNotMatch(pageSource, /\bfetch\s*\(|XMLHttpRequest|WebSocket/);
assert.match(workerSource, /READ_METHODS = new Set\(\['GET', 'HEAD'\]\)/);
assert.match(workerSource, /renderNewProductPage/);

const config = JSON.parse(read('central/wrangler.jsonc'));
assert.equal(config.workers_dev, false);
assert.equal(config.preview_urls, false);
assert.equal('routes' in config, false);
assert.equal('d1_databases' in config, false);
assert.equal('triggers' in config, false);

const pkg = JSON.parse(read('package.json'));
assert.equal(pkg.scripts['test:l2-4h-new-product'], 'node scripts/test-l2-4h-new-product.mjs');
for (const gate of [
  'test:l2-2-central-foundation', 'test:l2-4a-central-products', 'test:l2-4b-central-link-health',
  'test:l2-4c-affiliate-executor', 'test:l2-4d-operational-history', 'test:l2-4e-health-history',
  'test:l2-4f-link-monitor', 'test:l2-4g-central-operational', 'test:l2-4h-new-product',
  'test:affiliate-integrity', 'test:e2-catalog-operations',
]) assert.ok(pkg.scripts.check.includes(gate));

assert.equal(hash(ownerPath), ownerBefore, 'teste M1.1 não pode alterar owner');
assert.equal(hash(mobilePath), mobileBefore, 'teste M1.1 não pode alterar derivado mobile');
console.log(JSON.stringify({
  m11CatalogOperations: 'PASS',
  contract: CENTRAL_NEW_PRODUCT_CONTRACT,
  batchContract: CENTRAL_NEW_PRODUCT_BATCH_CONTRACT,
  products: products.length,
  individualStates: ['PRONTO', 'REVISÃO', 'DUPLICADO', 'BLOQUEADO'],
  trackingIdentityNormalization: true,
  nonStandardPortRejected: true,
  ownerDuplicateDetection: true,
  idCollisionBlocking: true,
  batchOneLinkPerLine: true,
  batchValid: true,
  batchMixed: true,
  batchOwnerDuplicate: true,
  batchInternalDuplicate: true,
  idempotent: true,
  preview: true,
  conceptualDiff: true,
  publicationEnabled: false,
  ownerChanged: false,
  mobileChanged: false,
  githubMutation: false,
  liveNetwork: false,
}, null, 2));
