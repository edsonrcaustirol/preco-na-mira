#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildCentralProductsProjection,
  generateCentralProducts,
  renderCentralProductsModule,
} from './build-central-products.mjs';
import {
  CENTRAL_PRODUCT_FIELDS,
  CENTRAL_PRODUCTS_CONTRACT,
  CENTRAL_PRODUCTS_SOURCE,
  filterCentralProducts,
  queryCentralProducts,
  searchCentralProducts,
  sortCentralProducts,
} from '../central/src/products.mjs';
import { CENTRAL_CONTRACTS, centralCapabilities } from '../central/src/contracts.mjs';
import { handleCentralRequest } from '../central/src/worker.mjs';
import { renderProductsPage } from '../central/src/products-page.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OWNER_PATH = path.join(ROOT, CENTRAL_PRODUCTS_SOURCE);
const GENERATED_RELATIVE = 'central/src/generated/products.mjs';
const GENERATED_PATH = path.join(ROOT, GENERATED_RELATIVE);
const CENTRAL_HOST = 'central.preconamira.com.br';
const ACCESS_ISSUER = 'https://fixture-team.cloudflareaccess.com';
const ACCESS_AUD = 'fixture-audience';
const FIXED_NOW = 2_000_000_000;

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function assertProjection() {
  const source = fs.readFileSync(OWNER_PATH, 'utf8');
  const projection = buildCentralProductsProjection(source);
  const second = buildCentralProductsProjection(source);

  assert.equal(projection.contract, CENTRAL_PRODUCTS_CONTRACT);
  assert.equal(projection.contract, 'pnm.central-products/v1');
  assert.equal(projection.source, 'data/produtos-index.js');
  assert.equal(projection.sourceFingerprint, `sha256:${crypto.createHash('sha256').update(source, 'utf8').digest('hex')}`);
  assert.equal(projection.total, 556, 'catálogo projetado deve continuar com 556 produtos');
  assert.equal(projection.products.length, projection.total);
  assert.deepEqual(second, projection, 'projeção deve ser determinística');
  assert.equal(renderCentralProductsModule(second), renderCentralProductsModule(projection), 'módulo gerado deve ser determinístico');

  const ids = projection.products.map(product => product.id);
  assert.equal(new Set(ids).size, projection.total, 'IDs projetados devem ser únicos');
  for (const product of projection.products) {
    assert.equal(typeof product.id, 'string');
    assert.ok(product.id.trim(), 'id essencial ausente');
    assert.equal(typeof product.nome, 'string');
    assert.ok(product.nome.trim(), 'nome essencial ausente');
    assert.equal(typeof product.linkAfiliado, 'string');
    assert.ok(product.linkAfiliado.trim(), 'link afiliado essencial ausente');
    for (const key of Object.keys(product)) {
      assert.equal(CENTRAL_PRODUCT_FIELDS.includes(key), true, `campo não permitido na projeção: ${key}`);
    }
  }

  const build = generateCentralProducts();
  assert.equal(build.contract, 'pnm.central-products/v1');
  assert.equal(build.source, 'data/produtos-index.js');
  assert.equal(build.total, 556);
  assert.equal(build.output, GENERATED_RELATIVE);
  assert.equal(fs.existsSync(GENERATED_PATH), true, 'módulo gerado deve existir após o build');
  assert.match(fs.readFileSync(GENERATED_PATH, 'utf8'), /ARQUIVO GERADO — NÃO EDITAR MANUALMENTE/);
  assert.match(read('.gitignore'), /^central\/src\/generated\/$/m, 'projeção gerada deve ficar fora do versionamento');

  return projection;
}

function assertSearchFiltersAndSort(projection) {
  const sample = projection.products[0];
  const nameNeedle = sample.nome.slice(0, Math.min(8, sample.nome.length));
  const idNeedle = sample.id.slice(Math.max(0, sample.id.length - 7));
  assert.ok(searchCentralProducts(projection.products, nameNeedle).some(product => product.id === sample.id), 'busca por nome falhou');
  assert.ok(searchCentralProducts(projection.products, idNeedle).some(product => product.id === sample.id), 'busca parcial por ID falhou');
  assert.ok(searchCentralProducts(projection.products, sample.marca).some(product => product.id === sample.id), 'busca por marca falhou');
  assert.ok(searchCentralProducts(projection.products, sample.categoria).some(product => product.id === sample.id), 'busca por categoria falhou');
  assert.ok(searchCentralProducts(projection.products, sample.linkAfiliado).some(product => product.id === sample.id), 'busca por link falhou');

  const categoryFiltered = filterCentralProducts(projection.products, { categoria: sample.categoria });
  assert.ok(categoryFiltered.length > 0);
  assert.equal(categoryFiltered.every(product => product.categoria === sample.categoria), true, 'filtro categoria falhou');
  const brandFiltered = filterCentralProducts(projection.products, { marca: sample.marca });
  assert.ok(brandFiltered.length > 0);
  assert.equal(brandFiltered.every(product => product.marca === sample.marca), true, 'filtro marca falhou');

  const flags = [
    { id: 'a', nome: 'A', oferta: true, destaque: false },
    { id: 'b', nome: 'B', oferta: false, destaque: true },
    { id: 'c', nome: 'C' },
  ];
  assert.deepEqual(filterCentralProducts(flags, { oferta: 'true' }).map(product => product.id), ['a']);
  assert.deepEqual(filterCentralProducts(flags, { oferta: 'false' }).map(product => product.id), ['b', 'c']);
  assert.deepEqual(filterCentralProducts(flags, { destaque: 'true' }).map(product => product.id), ['b']);
  assert.deepEqual(filterCentralProducts(flags, { destaque: 'false' }).map(product => product.id), ['a', 'c']);

  const sortable = [
    { id: 'z', nome: 'Zeta' },
    { id: 'a', nome: 'Ábaco' },
    { id: 'm', nome: 'Médio' },
  ];
  assert.deepEqual(sortCentralProducts(sortable, 'name-asc').map(product => product.id), ['a', 'm', 'z']);
  assert.deepEqual(sortCentralProducts(sortable, 'name-desc').map(product => product.id), ['z', 'm', 'a']);
  assert.deepEqual(queryCentralProducts({ products: sortable }, { query: 'aba', order: 'name-asc' }).map(product => product.id), ['a']);
}

function assertUi(projection) {
  const nonce = 'fixtureNonce123';
  const html = renderProductsPage(projection, nonce);
  assert.match(html, /pnm\.central-products\/v1/);
  assert.match(html, /data-total="556"/);
  assert.match(html, /id="q"/);
  assert.match(html, /id="cat"/);
  assert.match(html, /id="brand"/);
  assert.match(html, /id="offer"/);
  assert.match(html, /id="highlight"/);
  assert.match(html, /Nome A–Z/);
  assert.match(html, /Nome Z–A/);
  assert.match(html, /DADOS DO PRODUTO/);
  assert.match(html, /PUBLICAÇÃO/);
  assert.match(html, /LINK MERCADO LIVRE/);
  assert.match(html, /SAÚDE DO LINK/);
  assert.match(html, /Saúde dos links será integrada na próxima etapa\./);
  assert.match(html, /<button type="button" disabled>EDITAR<\/button>/);
  assert.match(html, /<button type="button" disabled>NOVO PRODUTO<\/button>/);
  assert.match(html, /loading="lazy"/);
  assert.doesNotMatch(html, /<table\b/i, 'não deve existir tabela horizontal');
  assert.match(html, /overflow-wrap:anywhere/);
  assert.match(html, /@media\(max-width:800px\)/);
  assert.match(html, /\.detail-grid\{grid-template-columns:1fr\}/);
  assert.match(html, /p\.linkAfiliado/, 'busca local deve considerar o link afiliado');
  assert.match(html, new RegExp(`<script nonce="${nonce}">`));

  const gridMatch = html.match(/<section class="grid" id="grid"[^>]*>([\s\S]*?)<\/section>/);
  assert.ok(gridMatch, 'grade de produtos ausente');
  assert.equal(gridMatch[1].includes(projection.products[0].linkAfiliado), false, 'listagem não pode exibir URL afiliada completa');
  assert.equal((gridMatch[1].match(/loading="lazy"/g) || []).length, 556, 'todas as miniaturas devem usar lazy loading');
}

function createAccessFixture() {
  const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicJwk = pair.publicKey.export({ format: 'jwk' });
  Object.assign(publicJwk, { kid: 'fixture-key', alg: 'RS256', use: 'sig' });
  const env = {
    PNM_CENTRAL_ACCESS_AUD: ACCESS_AUD,
    PNM_CENTRAL_ACCESS_ISSUER: ACCESS_ISSUER,
    PNM_CENTRAL_EXPECTED_HOST: CENTRAL_HOST,
  };
  let fetches = 0;
  const fetchImpl = async url => {
    fetches += 1;
    assert.equal(String(url), `${ACCESS_ISSUER}/cdn-cgi/access/certs`);
    return new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const encode = value => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
  const token = () => {
    const header = encode({ alg: 'RS256', typ: 'JWT', kid: 'fixture-key' });
    const payload = encode({
      iss: ACCESS_ISSUER,
      aud: [ACCESS_AUD],
      sub: 'fixture-admin',
      iat: FIXED_NOW - 60,
      nbf: FIXED_NOW - 60,
      exp: FIXED_NOW + 3600,
    });
    const input = `${header}.${payload}`;
    const signature = crypto.sign('RSA-SHA256', Buffer.from(input), pair.privateKey).toString('base64url');
    return `${input}.${signature}`;
  };
  return { env, fetchImpl, token, getFetches: () => fetches };
}

async function assertReadOnlyRuntime() {
  const fixture = createAccessFixture();
  const headers = { 'cf-access-jwt-assertion': fixture.token() };
  const options = { fetchImpl: fixture.fetchImpl, nowSeconds: FIXED_NOW };

  const response = await handleCentralRequest(new Request(`https://${CENTRAL_HOST}/produtos`, { headers }), fixture.env, options);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-security-policy') || '', /script-src 'nonce-[A-Za-z0-9]+'/);
  assert.doesNotMatch(response.headers.get('content-security-policy') || '', /script-src 'unsafe-inline'/);
  const html = await response.text();
  assert.match(html, /data-total="556"/);
  assert.match(html, /Saúde dos links será integrada na próxima etapa\./);

  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const blocked = await handleCentralRequest(new Request(`https://${CENTRAL_HOST}/produtos`, { method, headers }), fixture.env, options);
    assert.equal(blocked.status, 405, `${method} deve permanecer bloqueado`);
    assert.equal(blocked.headers.get('allow'), 'GET, HEAD');
  }
  assert.ok(fixture.getFetches() >= 5, 'somente JWKS fictício deve ser consultado nos testes protegidos');
}

function assertSecurityAndOwnership() {
  const config = JSON.parse(read('central/wrangler.jsonc'));
  assert.equal(config.workers_dev, false);
  assert.equal(config.preview_urls, false);
  assert.equal('routes' in config, false, 'rota administrativa continua ausente');
  assert.equal('route' in config, false, 'rota administrativa singular continua ausente');
  assert.equal('d1_databases' in config, false, 'D1 continua ausente');
  assert.equal('triggers' in config, false, 'scheduler continua ausente');
  assert.deepEqual(config.build, { command: 'node scripts/build-central-products.mjs' });

  assert.equal(CENTRAL_CONTRACTS.catalog.owner, 'data/produtos-index.js');
  assert.equal(CENTRAL_CONTRACTS.catalog.centralDatabaseOwner, false);
  assert.equal(CENTRAL_CONTRACTS.catalog.projection.contract, 'pnm.central-products/v1');
  assert.equal(CENTRAL_CONTRACTS.catalog.projection.source, CENTRAL_CONTRACTS.catalog.owner);
  assert.equal(CENTRAL_CONTRACTS.catalog.projection.authoritative, false);
  assert.equal(CENTRAL_CONTRACTS.catalog.projection.readOnly, true);
  assert.equal(CENTRAL_CONTRACTS.catalog.projection.networkRequired, false);
  assert.equal(CENTRAL_CONTRACTS.mutations.products, false);
  assert.equal(CENTRAL_CONTRACTS.mutations.github, false);
  assert.equal(CENTRAL_CONTRACTS.githubTransaction.mutationEnabled, false);
  assert.equal(CENTRAL_CONTRACTS.authentication.workerJwtVerification, true);
  assert.equal(CENTRAL_CONTRACTS.authentication.algorithm, 'RS256');
  assert.equal(centralCapabilities().productMutationEnabled, false);
  assert.equal(centralCapabilities().githubMutationEnabled, false);

  const relevantPaths = [
    'central/src/contracts.mjs',
    'central/src/products.mjs',
    'central/src/products-page.mjs',
    'central/src/worker.mjs',
    'scripts/build-central-products.mjs',
  ];
  const source = relevantPaths.map(read).join('\n');
  assert.equal(/api\.github\.com/i.test(source), false, 'Central não pode mutar GitHub');
  assert.equal(/gh[pousr]_[A-Za-z0-9_]{20,}/.test(source), false, 'possível token GitHub hardcoded');
  assert.equal(/(?:password|secret|token)\s*[:=]\s*["'][^"']{8,}["']/i.test(source), false, 'possível secret hardcoded');
  assert.equal(/\bfetch\s*\(/.test(read('central/src/products.mjs')), false, 'projeção não depende de rede');
  assert.equal(/\bfetch\s*\(/.test(read('scripts/build-central-products.mjs')), false, 'build da projeção não depende de rede');
  assert.equal(/\/api\/products?/i.test(source), false, 'não deve existir endpoint de produto com escrita');

  const canonicalDeclaration = /^const\s+PRODUTOS\s*=/.test(fs.readFileSync(OWNER_PATH, 'utf8'));
  assert.equal(canonicalDeclaration, true, 'owner esperado não foi reconhecido');
  for (const relativePath of relevantPaths) {
    assert.equal(/^const\s+PRODUTOS\s*=/m.test(read(relativePath)), false, `segundo owner detectado em ${relativePath}`);
  }

  const packageJson = JSON.parse(read('package.json'));
  assert.equal(packageJson.scripts['test:l2-4a-central-products'], 'node scripts/test-l2-4a-central-products.mjs');
  assert.equal(packageJson.scripts['build:central-products'], 'node scripts/build-central-products.mjs');
  const check = packageJson.scripts.check;
  const preservedGates = [
    'test:l2-2-central-foundation',
    'test:affiliate-integrity',
    'test:m3-2-related-scope',
    'audit:m3-2-related-scope',
    'build:site',
    'test:e2-catalog-operations',
    'validate:e2-catalog',
    'test:e1-1-mobile-listings',
    'test:m1',
    'test:m2-1',
    'test:m3-1',
    'test:m2-2',
    'audit:strict',
    'wrangler deploy --dry-run',
  ];
  for (const gate of preservedGates) assert.ok(check.includes(gate), `gate existente removido: ${gate}`);
  assert.ok(check.includes('test:l2-4a-central-products'));
  assert.ok(check.includes('wrangler deploy --dry-run --config central/wrangler.jsonc'));
}

const projection = assertProjection();
assertSearchFiltersAndSort(projection);
assertUi(projection);
assertSecurityAndOwnership();
await assertReadOnlyRuntime();

console.log(JSON.stringify({
  l24aCentralProducts: 'PASS',
  contract: 'pnm.central-products/v1',
  source: 'data/produtos-index.js',
  total: projection.total,
  deterministicProjection: true,
  uniqueIds: true,
  search: ['nome', 'id-parcial', 'marca', 'categoria', 'link-afiliado'],
  filters: ['categoria', 'marca', 'oferta', 'destaque'],
  sort: ['Nome A–Z', 'Nome Z–A'],
  detailReadOnly: true,
  lazyLoading: true,
  productMutationEnabled: false,
  githubMutationEnabled: false,
  d1: false,
  scheduler: false,
  adminRoute: false,
  workersDev: false,
  previewUrls: false,
  liveMercadoLivreCalls: 0,
}, null, 2));
