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

const ready = analyzeNewProductInput(completeInput(1), products);
assert.equal(ready.contract, CENTRAL_NEW_PRODUCT_CONTRACT);
assert.equal(ready.state, 'PRONTO');
assert.equal(ready.canAdvanceText, 'SIM');
assert.equal(ready.fields.linkAfiliado.provenance, NEW_PRODUCT_PROVENANCE.AUTOMATIC);
assert.equal(ready.fields.loja.value, 'Mercado Livre');
assert.equal(ready.publicationEnabled, false, 'analisador continua sem mutação própria');
assert.equal(ready.conceptualDiff.applicablePatch, false);
assert.equal(ready.l11.contract, 'pnm.affiliate-integrity/v1');

const suggested = analyzeNewProductInput({ ...completeInput(2), id: '' }, products);
assert.equal(suggested.state, 'REVISÃO');
assert.ok(suggested.pending.some(item => item.code === 'CONFIRM_SUGGESTED_ID'));

const first = products[0];
const duplicate = analyzeNewProductInput({ linkAfiliado: first.linkAfiliado }, products);
assert.equal(duplicate.state, 'DUPLICADO');
assert.equal(duplicate.duplicate.objective, true);
assert.ok(duplicate.blocking.some(item => item.code === 'DUPLICATE_LINK'));

const incomplete = analyzeNewProductInput({ linkAfiliado: 'https://meli.la/m11-incomplete' }, products);
assert.equal(incomplete.state, 'REVISÃO');
assert.equal(incomplete.canAdvanceText, 'NÃO');
assert.ok(incomplete.pending.length > 0);

for (const bad of ['https://example.com/item', 'https://mercadolivre.com.br.evil.example/item', 'https://meli.la:8443/item', 'not a url']) {
  const result = analyzeNewProductInput({ link: bad }, []);
  assert.equal(result.state, 'BLOQUEADO');
}

const validBatch = analyzeNewProductBatch([completeInput(10), completeInput(11)], products);
assert.equal(validBatch.contract, CENTRAL_NEW_PRODUCT_BATCH_CONTRACT);
assert.equal(validBatch.state, 'PRONTO');
assert.equal(validBatch.canAdvanceText, 'SIM');
assert.deepEqual(validBatch.summary, { total: 2, prontos: 2, revisao: 0, bloqueados: 0, duplicados: 0 });
assert.ok(validBatch.items.every(item => item.result.publicationEnabled === false));

const mixedBatch = analyzeNewProductBatch([
  completeInput(20),
  { linkAfiliado: first.linkAfiliado },
  { linkAfiliado: 'https://example.com/item' },
  { linkAfiliado: 'https://meli.la/m11-review-only' },
], products);
assert.equal(mixedBatch.canAdvanceText, 'NÃO');
assert.equal(mixedBatch.summary.prontos, 1);
assert.equal(mixedBatch.summary.duplicados, 1);
assert.equal(mixedBatch.summary.bloqueados, 1);
assert.equal(mixedBatch.summary.revisao, 1);

const html = renderNewProductPage(CENTRAL_PRODUCTS_PROJECTION, 'fixtureNonce');
for (const expected of [
  '1. LINK', '2. CONFERIR', '3. PUBLICAR',
  'AUTOMÁTICO', 'SUGERIDO', 'HUMANO', 'BLOQUEANTE', 'NÃO PUBLICADO',
  'PODE PUBLICAR?', 'Cadastro em massa', 'ANALISAR LOTE', 'Resultado por item',
  'ANÁLISE != PUBLICAÇÃO', 'PUBLICAR PRODUTO',
]) assert.match(html, new RegExp(expected));
assert.match(html, /um link por linha/i);
assert.match(html, /impede cadastros duplicados/i);
assert.match(html, /id="publish-product" class="publish" type="button" disabled>PUBLICAR PRODUTO<\/button>/);
assert.match(html, /\/api\/new-product\/transactions/);
assert.match(html, /setInterval\(refreshTransaction,2500\)/);
assert.match(html, /PUBLICADO · produto disponível no site/);
assert.match(html, /startsWith\('https:\/\/github\.com\/'\)/);
assert.match(html, /overflow-x:hidden/);
assert.match(html, /word-break:break-word|overflow-wrap:anywhere/);
assert.match(html, /script nonce="fixtureNonce"/);

const newProductSource = read('central/src/new-product.mjs');
const pageSource = read('central/src/new-product-page.mjs');
const workerSource = read('central/src/worker.mjs');
assert.doesNotMatch(newProductSource, /\bfetch\s*\(|spawnSync|validateCatalog|recordAuditHistory|\bD1\b/);
assert.match(newProductSource, /analyzeNewProductBatch[\s\S]*analyzeNewProductInput\(entry, products\)/);
assert.match(pageSource, /fetch\('\/api\/new-product\/transactions'/);
assert.doesNotMatch(pageSource, /GITHUB_TOKEN|PNM_GITHUB_TOKEN|Bearer |api\.github\.com/i);
assert.doesNotMatch(pageSource, /XMLHttpRequest|WebSocket/);
assert.match(workerSource, /READ_METHODS = new Set\(\['GET', 'HEAD'\]\)/);
assert.match(workerSource, /NEW_PRODUCT_TRANSACTION_PATH = '\/api\/new-product\/transactions'/);
assert.match(workerSource, /enforceAdministrativeBoundary/);
assert.match(workerSource, /ORIGIN_REJECTED/);

const config = JSON.parse(read('central/wrangler.jsonc'));
assert.equal(config.workers_dev, false);
assert.equal(config.preview_urls, false);
assert.equal('routes' in config, false);
assert.equal('d1_databases' in config, false);
assert.equal('triggers' in config, false);
assert.equal('PNM_GITHUB_TOKEN' in (config.vars || {}), false);

const pkg = JSON.parse(read('package.json'));
assert.equal(pkg.scripts['test:l2-4h-new-product'], 'node scripts/test-l2-4h-new-product.mjs');
assert.equal(pkg.scripts['test:o3-new-product-transaction'], 'node scripts/test-o3-new-product-transaction.mjs');
for (const gate of [
  'test:l2-2-central-foundation', 'test:l2-4a-central-products', 'test:l2-4b-central-link-health',
  'test:l2-4c-affiliate-executor', 'test:l2-4d-operational-history', 'test:l2-4e-health-history',
  'test:l2-4f-link-monitor', 'test:l2-4g-central-operational', 'test:l2-4h-new-product',
  'test:o3-new-product-transaction', 'test:affiliate-integrity', 'test:e2-catalog-operations',
]) assert.ok(pkg.scripts.check.includes(gate));

assert.equal(hash(ownerPath), ownerBefore, 'teste M1.1/O3 compat não pode alterar owner');
assert.equal(hash(mobilePath), mobileBefore, 'teste M1.1/O3 compat não pode alterar derivado mobile');
console.log(JSON.stringify({
  m11CatalogOperations: 'PASS',
  contract: CENTRAL_NEW_PRODUCT_CONTRACT,
  batchContract: CENTRAL_NEW_PRODUCT_BATCH_CONTRACT,
  products: products.length,
  preparationAnalyzerMutation: false,
  transactionDelegatedToProtectedO3Backend: true,
  batchPublicationEnabled: false,
  ownerChanged: false,
  mobileChanged: false,
  frontendSecrets: 0,
  publicationStatusPollingAutomatic: true,
}, null, 2));
