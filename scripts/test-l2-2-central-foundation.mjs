#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  handleCentralRequest,
  missingAdminConfig,
  normalizeAccessIssuer,
  verifyCloudflareAccessAssertion,
} from '../central/src/worker.mjs';
import { CENTRAL_AREAS, CENTRAL_CONTRACTS, centralCapabilities } from '../central/src/contracts.mjs';
import { renderCentralShell } from '../central/src/ui.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CANONICAL = path.join(ROOT, 'data', 'produtos-index.js');
const OWNER_AT_TEST_START = fs.readFileSync(CANONICAL, 'utf8');
const CENTRAL_HOST = 'central.preconamira.com.br';
const ACCESS_ISSUER = 'https://fixture-team.cloudflareaccess.com';
const ACCESS_AUD = 'fixture-audience';
const FIXED_NOW = 2_000_000_000;

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function assertOwnerUnchanged() {
  assert.equal(fs.readFileSync(CANONICAL, 'utf8'), OWNER_AT_TEST_START, 'owner canônico foi alterado na L2.2');
  assert.equal(CENTRAL_CONTRACTS.catalog.owner, 'data/produtos-index.js');
  assert.equal(CENTRAL_CONTRACTS.catalog.centralDatabaseOwner, false);
  assert.equal(CENTRAL_CONTRACTS.d1.authoritativeCatalog, false);
}

function assertSeparatedWorker() {
  const publicConfig = JSON.parse(read('wrangler.jsonc'));
  const centralConfig = JSON.parse(read('central/wrangler.jsonc'));
  assert.equal(publicConfig.name, 'preco-na-mira');
  assert.equal(publicConfig.main, 'src/worker.mjs');
  assert.equal(centralConfig.name, 'preco-na-mira-central');
  assert.equal(centralConfig.main, 'src/runtime-worker.mjs');
  assert.notEqual(centralConfig.name, publicConfig.name);
  assert.equal(centralConfig.workers_dev, false);
  assert.equal(centralConfig.preview_urls, false);
  assert.equal('routes' in centralConfig, false, 'rota administrativa deve continuar fora do site público');
  assert.equal(Array.isArray(centralConfig.d1_databases), true, 'Central deve declarar o D1 operacional');
  assert.equal(centralConfig.d1_databases.length, 1);
  assert.equal(centralConfig.d1_databases[0]?.binding, 'PNM_HISTORY_DB');
  assert.equal(CENTRAL_CONTRACTS.d1.authoritativeCatalog, false, 'D1 operacional não pode virar owner do catálogo');
  const runtimeSource = read('central/src/runtime-worker.mjs');
  assert.match(runtimeSource, /handleGithubOauthCentralRequest/, 'runtime deve preservar a barreira GitHub OAuth');
  assert.match(runtimeSource, /0001_operational_history\.sql/, 'runtime deve inicializar o schema operacional versionado');
}

function assertNoPublicNavigationExposure() {
  const publicHtmlFiles = fs.readdirSync(ROOT).filter(name => name.endsWith('.html'));
  for (const file of publicHtmlFiles) {
    const html = read(file);
    assert.equal(html.includes('central.preconamira.com.br'), false, `${file} expõe a Central publicamente`);
    assert.equal(/href=["']\/central(?:[\/"'#?]|$)/i.test(html), false, `${file} contém link público para /central`);
  }
}

function assertReusableContracts() {
  assert.equal(fs.existsSync(path.join(ROOT, CENTRAL_CONTRACTS.catalog.e2.validatorModule)), true);
  assert.equal(CENTRAL_CONTRACTS.catalog.e2.validateCommand, 'npm run validate:e2-catalog');
  assert.equal(CENTRAL_CONTRACTS.catalog.e2.lifecycleTestCommand, 'npm run test:e2-catalog-operations');
  assert.equal(fs.existsSync(path.join(ROOT, CENTRAL_CONTRACTS.affiliateIntegrity.cli)), true);
  assert.equal(CENTRAL_CONTRACTS.affiliateIntegrity.command, 'npm run audit:affiliate-integrity');
  assert.equal(CENTRAL_CONTRACTS.affiliateIntegrity.contract, 'pnm.affiliate-integrity/v1');
  assert.equal(CENTRAL_CONTRACTS.authentication.provider, 'github-oauth');
  assert.deepEqual(CENTRAL_CONTRACTS.authentication.requiredRuntime, [
    'PNM_CENTRAL_AUTH_MODE',
    'PNM_CENTRAL_EXPECTED_HOST',
    'PNM_GITHUB_OAUTH_CLIENT_ID',
    'PNM_GITHUB_OAUTH_CLIENT_SECRET',
    'PNM_GITHUB_ALLOWED_USER_ID',
    'PNM_GITHUB_ALLOWED_LOGIN',
    'PNM_CENTRAL_SESSION_SECRET',
  ]);
  assert.equal(CENTRAL_CONTRACTS.authentication.githubOAuth.pkce, true);
  assert.deepEqual(CENTRAL_CONTRACTS.authentication.githubOAuth.requestedScopes, []);
  assert.equal(CENTRAL_CONTRACTS.authentication.algorithm, 'RS256');
  assert.equal(CENTRAL_CONTRACTS.authentication.jwksPath, '/cdn-cgi/access/certs');
  assert.equal(CENTRAL_CONTRACTS.authentication.workerJwtVerification, true);
}

function assertMutationDisabled() {
  const capabilities = centralCapabilities();
  assert.equal(capabilities.githubMutationEnabled, false);
  assert.equal(capabilities.productMutationEnabled, false);
  assert.equal(capabilities.automaticMergeEnabled, false);
  assert.equal(CENTRAL_CONTRACTS.mutations.batch, false);
  assert.equal(CENTRAL_CONTRACTS.mutations.automaticLinkCorrection, false);
  assert.equal(CENTRAL_CONTRACTS.mutations.automaticLinkMonitor, false);
  const mutationSource = [read('central/src/worker.mjs'), read('central/src/ui.mjs')].join('\n');
  assert.equal(/api\.github\.com/i.test(mutationSource), false, 'núcleo histórico da Central não deve chamar GitHub diretamente');
  const secretSource = [
    read('central/src/worker.mjs'),
    read('central/src/contracts.mjs'),
    read('central/src/ui.mjs'),
    read('central/src/github-oauth-auth.mjs'),
    read('central/src/github-oauth-worker.mjs'),
  ].join('\n');
  assert.equal(/gh[pousr]_[A-Za-z0-9_]{20,}/.test(secretSource), false, 'possível token GitHub hardcoded');
  assert.equal(/(?:password|secret|token)\s*[:=]\s*["'][^"']{8,}["']/i.test(secretSource), false, 'possível secret hardcoded');
}

function assertShellAreas() {
  const html = renderCentralShell();
  for (const area of CENTRAL_AREAS) {
    assert.equal(html.includes(area.label), true, `shell ausente: ${area.label}`);
    assert.equal(html.includes(`id="${area.id}"`), true, `seção ausente: ${area.id}`);
  }
}

function createAccessFixture() {
  const validPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const invalidPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicJwk = validPair.publicKey.export({ format: 'jwk' });
  Object.assign(publicJwk, { kid: 'fixture-key', alg: 'RS256', use: 'sig' });

  const env = {
    PNM_CENTRAL_ACCESS_AUD: ACCESS_AUD,
    PNM_CENTRAL_ACCESS_ISSUER: ACCESS_ISSUER,
    PNM_CENTRAL_EXPECTED_HOST: CENTRAL_HOST,
  };

  let jwksFetches = 0;
  const fetchImpl = async url => {
    jwksFetches += 1;
    assert.equal(String(url), `${ACCESS_ISSUER}/cdn-cgi/access/certs`);
    return new Response(JSON.stringify({ keys: [publicJwk] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  function encodeJson(value) {
    return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
  }

  function token({ claims = {}, signer = validPair.privateKey, header = {} } = {}) {
    const encodedHeader = encodeJson({ alg: 'RS256', typ: 'JWT', kid: 'fixture-key', ...header });
    const encodedPayload = encodeJson({
      iss: ACCESS_ISSUER,
      aud: [ACCESS_AUD],
      sub: 'fixture-admin',
      iat: FIXED_NOW - 60,
      nbf: FIXED_NOW - 60,
      exp: FIXED_NOW + 3600,
      ...claims,
    });
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput), signer).toString('base64url');
    return `${signingInput}.${signature}`;
  }

  return {
    env,
    fetchImpl,
    token,
    invalidSigner: invalidPair.privateKey,
    getJwksFetches: () => jwksFetches,
  };
}

async function assertCryptographicAccessValidation() {
  const fixture = createAccessFixture();
  const options = { fetchImpl: fixture.fetchImpl, nowSeconds: FIXED_NOW };

  assert.equal(normalizeAccessIssuer(`${ACCESS_ISSUER}/`), ACCESS_ISSUER);
  assert.throws(() => normalizeAccessIssuer('https://example.com'));

  const valid = fixture.token();
  const payload = await verifyCloudflareAccessAssertion(valid, fixture.env, options);
  assert.equal(payload.sub, 'fixture-admin', 'assertion válida deve ser aceita');

  await assert.rejects(
    () => verifyCloudflareAccessAssertion('fixture-assertion', fixture.env, options),
    /invalid-jwt/,
    'assertion falsa/malformada deve ser rejeitada',
  );

  await assert.rejects(
    () => verifyCloudflareAccessAssertion(fixture.token({ signer: fixture.invalidSigner }), fixture.env, options),
    /invalid-signature/,
    'assinatura inválida deve ser rejeitada',
  );

  await assert.rejects(
    () => verifyCloudflareAccessAssertion(fixture.token({ claims: { iss: 'https://other-team.cloudflareaccess.com' } }), fixture.env, options),
    /invalid-issuer/,
    'issuer incorreto deve ser rejeitado',
  );

  await assert.rejects(
    () => verifyCloudflareAccessAssertion(fixture.token({ claims: { aud: ['other-audience'] } }), fixture.env, options),
    /invalid-audience/,
    'AUD incorreto deve ser rejeitado',
  );

  await assert.rejects(
    () => verifyCloudflareAccessAssertion(fixture.token({ claims: { exp: FIXED_NOW - 1 } }), fixture.env, options),
    /token-expired/,
    'token expirado deve ser rejeitado',
  );

  await assert.rejects(
    () => verifyCloudflareAccessAssertion(fixture.token({ claims: { nbf: FIXED_NOW + 1 } }), fixture.env, options),
    /token-not-active/,
    'token antes de nbf deve ser rejeitado',
  );

  await assert.rejects(
    () => verifyCloudflareAccessAssertion(fixture.token({ header: { alg: 'HS256' } }), fixture.env, options),
    /invalid-jwt-header/,
    'algoritmo diferente de RS256 deve ser rejeitado',
  );

  assert.ok(fixture.getJwksFetches() >= 1, 'validação deve consultar JWKS fictício nos testes');
  return fixture;
}

async function assertFailClosedRuntime() {
  assert.deepEqual(missingAdminConfig({}), [
    'PNM_CENTRAL_ACCESS_AUD',
    'PNM_CENTRAL_ACCESS_ISSUER',
    'PNM_CENTRAL_EXPECTED_HOST',
  ]);

  const fixture = await assertCryptographicAccessValidation();
  const options = { fetchImpl: fixture.fetchImpl, nowSeconds: FIXED_NOW };
  const baseRequest = new Request(`https://${CENTRAL_HOST}/`);

  let response = await handleCentralRequest(baseRequest, {}, options);
  assert.equal(response.status, 503, 'configuração administrativa ausente deve falhar com 503');
  const configBody = await response.json();
  assert.equal('missing' in configBody, false, 'resposta não deve expor detalhes internos de configuração');

  response = await handleCentralRequest(baseRequest, fixture.env, options);
  assert.equal(response.status, 403, 'sem Cloudflare Access assertion deve falhar com 403');

  response = await handleCentralRequest(new Request(`https://${CENTRAL_HOST}/`, {
    headers: { 'cf-access-jwt-assertion': 'fixture-assertion' },
  }), fixture.env, options);
  assert.equal(response.status, 403, 'assertion falsa deve falhar com 403');
  const invalidBody = await response.json();
  assert.equal(invalidBody.code, 'CLOUDFLARE_ACCESS_INVALID');
  assert.equal(JSON.stringify(invalidBody).includes('invalid-signature'), false, 'resposta não deve vazar motivo criptográfico interno');

  const validHeaders = { 'cf-access-jwt-assertion': fixture.token() };
  response = await handleCentralRequest(new Request(`https://${CENTRAL_HOST}/`, { headers: validHeaders }), fixture.env, options);
  assert.equal(response.status, 200, 'assertion válida deve liberar a shell protegida');
  assert.match(await response.text(), /Central Operacional/);

  response = await handleCentralRequest(new Request(`https://${CENTRAL_HOST}/api/capabilities`, { headers: validHeaders }), fixture.env, options);
  assert.equal(response.status, 200);
  const capabilities = await response.json();
  assert.equal(capabilities.githubMutationEnabled, false);
  assert.equal(capabilities.productMutationEnabled, false);
  assert.equal(capabilities.d1AuthoritativeCatalog, false);

  response = await handleCentralRequest(new Request(`https://${CENTRAL_HOST}/produtos`, {
    method: 'POST',
    headers: validHeaders,
  }), fixture.env, options);
  assert.equal(response.status, 405, 'POST deve permanecer bloqueado');
  assert.equal(response.headers.get('allow'), 'GET, HEAD');

  response = await handleCentralRequest(new Request('https://preconamira.com.br/', { headers: validHeaders }), fixture.env, options);
  assert.equal(response.status, 421, 'host público não pode servir a Central');
}

assertOwnerUnchanged();
assertSeparatedWorker();
assertNoPublicNavigationExposure();
assertReusableContracts();
assertMutationDisabled();
assertShellAreas();
await assertFailClosedRuntime();

console.log(JSON.stringify({
  centralFoundation: 'PASS',
  ownerUnchanged: true,
  publicNavigationExposure: false,
  separateAdminWorker: true,
  activeAuthentication: CENTRAL_CONTRACTS.authentication.provider,
  cloudflareAccessFallbackPrepared: true,
  cloudflareAccessJwtVerification: 'PASS',
  cloudflareAccessAlgorithm: 'RS256',
  cloudflareAccessJwks: 'fixture-only-no-network',
  issuerValidation: true,
  audienceValidation: true,
  expirationValidation: true,
  fakeAssertionRejected: true,
  invalidSignatureRejected: true,
  e2Reusable: true,
  affiliateIntegrityReusable: true,
  githubMutationEnabled: false,
  productMutationEnabled: false,
  hardcodedSecrets: 0,
  d1OperationalBinding: 'PNM_HISTORY_DB',
  d1AuthoritativeCatalog: false,
  shellAreas: CENTRAL_AREAS.map(area => area.label),
}, null, 2));
