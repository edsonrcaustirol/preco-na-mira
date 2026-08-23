#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import centralWorker, { missingAdminConfig } from '../central/src/worker.mjs';
import { CENTRAL_AREAS, CENTRAL_CONTRACTS, centralCapabilities } from '../central/src/contracts.mjs';
import { renderCentralShell } from '../central/src/ui.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CANONICAL = path.join(ROOT, 'data', 'produtos-index.js');
const BASELINE_OWNER_BLOB = 'b01b5773dc489e2437b672abbe7c05beb71c2c4c';
const CENTRAL_HOST = 'central.preconamira.com.br';

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function gitBlobSha(content) {
  const body = Buffer.from(content, 'utf8');
  return crypto.createHash('sha1').update(`blob ${body.length}\0`).update(body).digest('hex');
}

function assertOwnerUnchanged() {
  assert.equal(gitBlobSha(fs.readFileSync(CANONICAL, 'utf8')), BASELINE_OWNER_BLOB, 'owner canônico foi alterado na L2.2');
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
  assert.equal(centralConfig.main, 'src/worker.mjs');
  assert.notEqual(centralConfig.name, publicConfig.name);
  assert.equal(centralConfig.workers_dev, false);
  assert.equal(centralConfig.preview_urls, false);
  assert.equal('routes' in centralConfig, false, 'rota administrativa não deve existir antes do Access');
  assert.equal('d1_databases' in centralConfig, false, 'D1 não deve ser preparado como owner nesta etapa');
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
}

function assertMutationDisabled() {
  const capabilities = centralCapabilities();
  assert.equal(capabilities.githubMutationEnabled, false);
  assert.equal(capabilities.productMutationEnabled, false);
  assert.equal(capabilities.automaticMergeEnabled, false);
  assert.equal(CENTRAL_CONTRACTS.mutations.batch, false);
  assert.equal(CENTRAL_CONTRACTS.mutations.automaticLinkCorrection, false);
  assert.equal(CENTRAL_CONTRACTS.mutations.automaticLinkMonitor, false);
  const source = [read('central/src/worker.mjs'), read('central/src/contracts.mjs'), read('central/src/ui.mjs')].join('\n');
  assert.equal(/api\.github\.com/i.test(source), false, 'Worker administrativo não pode chamar GitHub nesta etapa');
  assert.equal(/gh[pousr]_[A-Za-z0-9_]{20,}/.test(source), false, 'possível token GitHub hardcoded');
  assert.equal(/(?:password|secret|token)\s*[:=]\s*["'][^"']{8,}["']/i.test(source), false, 'possível secret hardcoded');
}

function assertShellAreas() {
  const html = renderCentralShell();
  for (const area of CENTRAL_AREAS) {
    assert.equal(html.includes(area.label), true, `shell ausente: ${area.label}`);
    assert.equal(html.includes(`id="${area.id}"`), true, `seção ausente: ${area.id}`);
  }
}

async function assertFailClosedRuntime() {
  assert.deepEqual(missingAdminConfig({}), ['PNM_CENTRAL_ACCESS_AUD', 'PNM_CENTRAL_EXPECTED_HOST']);
  const baseRequest = new Request(`https://${CENTRAL_HOST}/`);
  let response = await centralWorker.fetch(baseRequest, {});
  assert.equal(response.status, 503, 'configuração administrativa ausente deve falhar com 503');

  const env = {
    PNM_CENTRAL_ACCESS_AUD: 'fixture-audience',
    PNM_CENTRAL_EXPECTED_HOST: CENTRAL_HOST,
  };
  response = await centralWorker.fetch(baseRequest, env);
  assert.equal(response.status, 403, 'sem Cloudflare Access assertion deve falhar com 403');

  const accessHeaders = { 'cf-access-jwt-assertion': 'fixture-assertion' };
  response = await centralWorker.fetch(new Request(`https://${CENTRAL_HOST}/`, { headers: accessHeaders }), env);
  assert.equal(response.status, 200, 'shell protegida deve responder quando a barreira estiver presente');
  assert.match(await response.text(), /Central Operacional/);

  response = await centralWorker.fetch(new Request(`https://${CENTRAL_HOST}/api/capabilities`, { headers: accessHeaders }), env);
  assert.equal(response.status, 200);
  const capabilities = await response.json();
  assert.equal(capabilities.githubMutationEnabled, false);
  assert.equal(capabilities.productMutationEnabled, false);
  assert.equal(capabilities.d1AuthoritativeCatalog, false);

  response = await centralWorker.fetch(new Request(`https://${CENTRAL_HOST}/produtos`, {
    method: 'POST',
    headers: accessHeaders,
  }), env);
  assert.equal(response.status, 405, 'POST deve permanecer bloqueado');
  assert.equal(response.headers.get('allow'), 'GET, HEAD');

  response = await centralWorker.fetch(new Request('https://preconamira.com.br/', { headers: accessHeaders }), env);
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
  cloudflareAccessPrepared: true,
  e2Reusable: true,
  affiliateIntegrityReusable: true,
  githubMutationEnabled: false,
  productMutationEnabled: false,
  hardcodedSecrets: 0,
  d1AuthoritativeCatalog: false,
  shellAreas: CENTRAL_AREAS.map(area => area.label),
}, null, 2));
