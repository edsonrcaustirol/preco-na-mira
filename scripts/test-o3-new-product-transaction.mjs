#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { synchronizeCatalog } from './sincronizar-catalogo.mjs';
import { applyNewProductTransaction, readOwnerProducts } from './o3-new-product-transaction.mjs';
import {
  CENTRAL_NEW_PRODUCT_TRANSACTION_CONTRACT,
  dispatchNewProductTransaction,
  findIdentityConflict,
  getNewProductTransactionStatus,
  mercadoLivreListingId,
  publicationGate,
  transactionBranch,
} from '../central/src/new-product-transaction.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function product(index, overrides = {}) {
  const id = `o3-fixture-${index}`;
  return {
    id,
    nome: `Produto O3 Fixture ${index}`,
    marca: 'Marca Fixture',
    categoria: 'Tecnologia',
    imagem: `assets/${id}.webp`,
    imagemAlt: `Foto ${index}`,
    linkAfiliado: `https://meli.la/o3fixture${index}`,
    loja: 'Mercado Livre',
    resumo: `Resumo ${index}`,
    ...overrides,
  };
}

function writeOwner(root, products) {
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data', 'produtos-index.js'), `const PRODUTOS = ${JSON.stringify(products)};\n`);
}

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pnm-o3-'));
  const products = [product(1), product(2, { linkAfiliado: 'https://produto.mercadolivre.com.br/MLB-1234567890-produto-fixture-_JM' })];
  writeOwner(root, products);
  synchronizeCatalog(root);
  return { root, products };
}

function complete(index, overrides = {}) { return product(index, overrides); }

{
  const { root } = fixtureRoot();
  try {
    const result = applyNewProductTransaction(root, complete(3));
    assert.equal(result.contract, CENTRAL_NEW_PRODUCT_TRANSACTION_CONTRACT);
    assert.equal(result.ownerBefore, 2);
    assert.equal(result.ownerAfter, 3);
    assert.equal(result.mobileAfter, 3);
    assert.equal(result.pagesAfter, 3);
    assert.equal(fs.existsSync(path.join(root, 'produto-o3-fixture-3.html')), true);
    assert.equal(readOwnerProducts(root).products.length, 3);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

{
  const { root, products } = fixtureRoot();
  try {
    assert.throws(() => applyNewProductTransaction(root, complete(8, { linkAfiliado: products[0].linkAfiliado })), error => error?.code === 'DUPLICATE_PRODUCT');
    assert.throws(() => applyNewProductTransaction(root, { linkAfiliado: 'https://meli.la/incomplete' }), error => error?.code === 'BLOQUEADO_POR_DADO');
    assert.throws(() => applyNewProductTransaction(root, complete(9, { id: '../escape' })), error => error?.code === 'UNSAFE_ID');
    assert.equal(readOwnerProducts(root).products.length, 2);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

{
  const { root } = fixtureRoot();
  try {
    const ownerBefore = fs.readFileSync(path.join(root, 'data', 'produtos-index.js'), 'utf8');
    const mobileBefore = fs.readFileSync(path.join(root, 'data', 'produtos-mobile.js'), 'utf8');
    assert.throws(() => applyNewProductTransaction(root, complete(10), { syncOptions: { failAfter: 1 } }), /Falha transacional simulada/);
    assert.equal(fs.readFileSync(path.join(root, 'data', 'produtos-index.js'), 'utf8'), ownerBefore);
    assert.equal(fs.readFileSync(path.join(root, 'data', 'produtos-mobile.js'), 'utf8'), mobileBefore);
    assert.equal(fs.existsSync(path.join(root, 'produto-o3-fixture-10.html')), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

assert.equal(mercadoLivreListingId('https://produto.mercadolivre.com.br/MLB-1234567890-x-_JM'), 'MLB1234567890');
const listingProducts = [product(20, { linkAfiliado: 'https://produto.mercadolivre.com.br/MLB-1234567890-original-_JM' })];
const listingConflict = findIdentityConflict(complete(21, { linkAfiliado: 'https://www.mercadolivre.com.br/MLB-1234567890-outra-url' }), listingProducts);
assert.equal(listingConflict.type, 'DUPLICATE_LISTING');
assert.equal(findIdentityConflict(complete(22, { id: '-unsafe' }), [] ).type, 'UNSAFE_ID');

const closedGate = publicationGate({});
assert.equal(closedGate.enabled, false);
assert.equal(closedGate.directMainPushAllowed, false);
assert.equal(closedGate.automaticMergeAllowed, false);
assert.ok(closedGate.missing.includes('PNM_GITHUB_TOKEN'));

const fixtureToken = ['fixture', 'server', 'credential'].join('-');
const fullEnv = {
  PNM_CENTRAL_ACCESS_MODE: 'cloudflare-access',
  PNM_CENTRAL_ACCESS_AUD: 'fixture-aud',
  PNM_CENTRAL_ACCESS_ISSUER: 'https://fixture.cloudflareaccess.com',
  PNM_CENTRAL_EXPECTED_HOST: 'central.preconamira.com.br',
  PNM_GITHUB_REPOSITORY: 'edsonrcaustirol/preco-na-mira',
  PNM_GITHUB_BASE_BRANCH: 'main',
  PNM_GITHUB_WORKFLOW: 'o3-new-product-transaction.yml',
  PNM_GITHUB_TOKEN: fixtureToken,
};
assert.equal(publicationGate(fullEnv).enabled, true);
assert.equal(transactionBranch('np-0123456789abcdef01234567'), 'central/new-product-np-0123456789abcdef01234567');

let fetchCalls = 0;
const noConfig = await dispatchNewProductTransaction({ env: {}, input: complete(30), products: [], fetchImpl: async () => { fetchCalls += 1; throw new Error('should-not-run'); } });
assert.equal(noConfig.code, 'PUBLICATION_GATE_CLOSED');
assert.equal(fetchCalls, 0);

const incompleteDispatch = await dispatchNewProductTransaction({ env: fullEnv, input: { linkAfiliado: 'https://meli.la/o3-missing' }, products: [], fetchImpl: async () => { fetchCalls += 1; } });
assert.equal(incompleteDispatch.code, 'BLOQUEADO_POR_DADO');

const duplicateDispatch = await dispatchNewProductTransaction({ env: fullEnv, input: complete(31, { linkAfiliado: 'https://www.mercadolivre.com.br/MLB-1234567890-outra' }), products: listingProducts, fetchImpl: async () => { fetchCalls += 1; } });
assert.equal(duplicateDispatch.code, 'DUPLICATE_PRODUCT');

let dispatchRequest;
const dispatched = await dispatchNewProductTransaction({
  env: fullEnv,
  input: complete(32),
  products: [],
  transactionId: 'np-0123456789abcdef01234567',
  fetchImpl: async (url, init) => { dispatchRequest = { url, init }; return { status: 204 }; },
});
assert.equal(dispatched.ok, true);
assert.equal(dispatched.state, 'PREPARANDO PUBLICAÇÃO');
assert.equal(dispatched.directMainPushAllowed, false);
assert.match(dispatchRequest.url, /actions\/workflows\/o3-new-product-transaction\.yml\/dispatches$/);
assert.equal(dispatchRequest.init.method, 'POST');
assert.match(dispatchRequest.init.headers.authorization, /^Bearer /);
assert.equal(JSON.stringify(dispatched).includes(fixtureToken), false);
const dispatchBody = JSON.parse(dispatchRequest.init.body);
assert.equal(dispatchBody.ref, 'main');
assert.equal(dispatchBody.inputs.transaction_id, 'np-0123456789abcdef01234567');
const decodedPayload = JSON.parse(Buffer.from(dispatchBody.inputs.payload_b64, 'base64').toString('utf8'));
assert.equal(decodedPayload.id, 'o3-fixture-32');

const status = await getNewProductTransactionStatus({
  env: fullEnv,
  transactionId: 'np-0123456789abcdef01234567',
  fetchImpl: async url => {
    if (url.includes('/pulls?')) return { ok: true, json: async () => [{ number: 62, html_url: 'https://github.com/example/pr/62', state: 'open', merged_at: null, head: { sha: 'abc123' } }] };
    return { ok: true, json: async () => ({ check_runs: [{ status: 'in_progress', conclusion: null }] }) };
  },
});
assert.equal(status.state, 'CI EM ANDAMENTO');
assert.equal(status.prNumber, 62);
assert.equal(JSON.stringify(status).includes(fixtureToken), false);

const workflow = read('.github/workflows/o3-new-product-transaction.yml');
assert.match(workflow, /workflow_dispatch:/);
assert.match(workflow, /contents: write/);
assert.match(workflow, /pull-requests: write/);
assert.match(workflow, /npm run check/);
assert.match(workflow, /git push --set-upstream origin "\$O3_BRANCH"/);
assert.match(workflow, /git push origin --delete "\$O3_BRANCH"/);
assert.doesNotMatch(workflow, /git push[^\n]*\bmain\b/);
assert.ok(workflow.indexOf('npm run check') < workflow.indexOf('git push --set-upstream origin'));
assert.doesNotMatch(workflow, /auto-merge|gh pr merge/i);

const transactionSource = read('central/src/new-product-transaction.mjs');
const pageSource = read('central/src/new-product-page.mjs');
const workerSource = read('central/src/worker.mjs');
assert.doesNotMatch(pageSource, /GITHUB_TOKEN|PNM_GITHUB_TOKEN|Bearer /);
assert.doesNotMatch(transactionSource, /gh[pousr]_[A-Za-z0-9_]{20,}/);
assert.match(workerSource, /api\/new-product\/transactions/);
assert.match(workerSource, /CLOUDFLARE_ACCESS_REQUIRED/);

console.log(JSON.stringify({
  o3NewProductTransaction: 'PASS',
  transactionContract: CENTRAL_NEW_PRODUCT_TRANSACTION_CONTRACT,
  fixtureAdd: true,
  duplicateBlocked: true,
  duplicateListingBlocked: true,
  incompleteBlocked: true,
  unsafeIdBlocked: true,
  rollback: true,
  githubUnavailableNoPartialMutation: true,
  publicationWithoutConfigDenied: true,
  directMainPushAllowed: false,
  automaticMergeAllowed: false,
  serverSideCredentialOnly: true,
}, null, 2));
