#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { analyzeNewProductInput, CENTRAL_NEW_PRODUCT_CONTRACT, NEW_PRODUCT_PROVENANCE } from '../central/src/new-product.mjs';
import { renderNewProductPage } from '../central/src/new-product-page.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const ownerPath = path.join(ROOT, 'data/produtos-index.js');
const ownerBefore = crypto.createHash('sha256').update(fs.readFileSync(ownerPath)).digest('hex');
const generatedPath = path.join(ROOT, 'central/src/generated/products.mjs');
if (!fs.existsSync(generatedPath)) { const built = spawnSync(process.execPath, ['scripts/build-central-products.mjs'], { cwd: ROOT, stdio: 'inherit', shell: false }); assert.equal(built.status, 0); }
const { CENTRAL_PRODUCTS_PROJECTION } = await import('../central/src/generated/products.mjs');
const products = CENTRAL_PRODUCTS_PROJECTION.products;
assert.equal(products.length, 556);

const short = analyzeNewProductInput({ linkAfiliado: '  https://meli.la/AbC123?utm_source=x#frag  ', nome: 'Produto Teste', marca: 'Marca X', categoria: 'TV', imagem: 'assets/x.webp', imagemAlt: 'Foto', resumo: 'Resumo' }, products);
assert.equal(short.contract, CENTRAL_NEW_PRODUCT_CONTRACT);
assert.equal(short.link.ok, true);
assert.equal(short.link.shortUrl, true);
assert.match(short.link.normalized, /\?utm_source=x#frag$/);
assert.equal(short.fields.linkAfiliado.provenance, NEW_PRODUCT_PROVENANCE.AUTOMATIC);
assert.equal(short.fields.loja.value, 'Mercado Livre');
assert.equal(short.fields.id.provenance, NEW_PRODUCT_PROVENANCE.SUGGESTED);
assert.equal(short.fields.marca.provenance, NEW_PRODUCT_PROVENANCE.HUMAN);
assert.equal(short.state, 'NÃO PUBLICADO');
assert.equal(short.publicationEnabled, false);
assert.equal(short.conceptualDiff.applicablePatch, false);
assert.equal(short.l11.contract, 'pnm.affiliate-integrity/v1');
assert.equal(short.l11.browserDispatch, false);

assert.equal(analyzeNewProductInput({ link: 'https://www.mercadolivre.com.br/item/ABC?tracking=1' }, []).link.ok, true);
assert.equal(analyzeNewProductInput({ link: 'https://example.com/item' }, []).link.ok, false);
assert.equal(analyzeNewProductInput({ link: 'https://mercadolivre.com.br.evil.example/item' }, []).link.ok, false);
assert.equal(analyzeNewProductInput({ link: 'not a url' }, []).link.ok, false);

const first = products[0];
const duplicate = analyzeNewProductInput({ linkAfiliado: first.linkAfiliado }, products);
assert.equal(duplicate.duplicate.objective, true);
assert.equal(duplicate.duplicate.product.id, first.id);
assert.ok(duplicate.blocking.some(item => item.code === 'DUPLICATE_LINK'));
const collision = analyzeNewProductInput({ linkAfiliado: 'https://meli.la/unique-fixture-code', id: first.id }, products);
assert.equal(collision.idCollision.objective, true);
assert.ok(collision.blocking.some(item => item.code === 'DUPLICATE_ID'));
const nonDuplicate = analyzeNewProductInput({ linkAfiliado: 'https://meli.la/unique-fixture-code-2' }, products);
assert.equal(nonDuplicate.duplicate.objective, false);

const html = renderNewProductPage(CENTRAL_PRODUCTS_PROJECTION, 'fixtureNonce');
for (const expected of ['1. LINK', '2. ANÁLISE', '3. DADOS', '4. REVISÃO', 'AUTOMÁTICO', 'SUGERIDO', 'HUMANO', 'BLOQUEANTE', 'NÃO PUBLICADO', 'Diff conceitual', 'Validação completa disponível após ativação segura da Central.']) assert.match(html, new RegExp(expected));
assert.match(html, /<button class="publish" type="button" disabled>PUBLICAR<\/button>/);
assert.match(html, /overflow-x:hidden/);
assert.match(html, /word-break:break-word|overflow-wrap:anywhere/);
assert.match(html, /script nonce="fixtureNonce"/);

const source = [read('central/src/new-product.mjs'), read('central/src/new-product-page.mjs'), read('central/src/worker.mjs')].join('\n');
assert.doesNotMatch(source, /api\.github\.com|GITHUB_TOKEN|gh[pousr]_[A-Za-z0-9_]{20,}/i);
assert.doesNotMatch(read('central/src/new-product.mjs'), /\bfetch\s*\(|spawnSync|validateCatalog|recordAuditHistory/);
assert.doesNotMatch(read('central/src/new-product-page.mjs'), /\bfetch\s*\(|XMLHttpRequest|WebSocket/);
assert.match(read('central/src/worker.mjs'), /READ_METHODS = new Set\(\['GET', 'HEAD'\]\)/);
assert.match(read('central/src/worker.mjs'), /renderNewProductPage/);

const config = JSON.parse(read('central/wrangler.jsonc'));
assert.equal(config.workers_dev, false);
assert.equal(config.preview_urls, false);
assert.equal('routes' in config, false);
assert.equal('d1_databases' in config, false);
assert.equal('triggers' in config, false);

const pkg = JSON.parse(read('package.json'));
assert.equal(pkg.scripts['test:l2-4h-new-product'], 'node scripts/test-l2-4h-new-product.mjs');
for (const gate of ['test:l2-2-central-foundation','test:l2-4a-central-products','test:l2-4b-central-link-health','test:l2-4c-affiliate-executor','test:l2-4d-operational-history','test:l2-4e-health-history','test:l2-4f-link-monitor','test:l2-4g-central-operational','test:l2-4h-new-product','test:affiliate-integrity','test:e2-catalog-operations']) assert.ok(pkg.scripts.check.includes(gate));
const ownerAfter = crypto.createHash('sha256').update(fs.readFileSync(ownerPath)).digest('hex');
assert.equal(ownerAfter, ownerBefore, 'teste H não pode alterar owner');
console.log(JSON.stringify({ l24hNewProduct: 'PASS', contract: CENTRAL_NEW_PRODUCT_CONTRACT, products: 556, structuralLinkValidation: true, objectiveDuplicateDetection: true, idCollisionBlocking: true, preview: true, conceptualDiff: true, publicationEnabled: false, ownerChanged: false, githubMutation: false, liveNetwork: false }, null, 2));
