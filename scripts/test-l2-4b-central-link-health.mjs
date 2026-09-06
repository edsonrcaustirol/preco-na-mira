#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CENTRAL_CONTRACTS, CENTRAL_AREAS } from '../central/src/contracts.mjs';
import {
  AFFILIATE_INTEGRITY_CONTRACT,
  CENTRAL_LINK_HEALTH_CONTRACT,
  LINK_HEALTH_ATTENTION_CLASSIFICATIONS,
  LINK_HEALTH_CLASSIFICATIONS,
  LINK_HEALTH_NON_VERIFIABLE,
  buildCentralLinkHealthReadModel,
  createEmptyCentralLinkHealthReadModel,
  filterCentralLinkHealthResults,
} from '../central/src/link-health.mjs';
import { renderLinkHealthPage } from '../central/src/link-health-page.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CENTRAL_HOST = 'central.preconamira.com.br';

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function assertOfficialContract() {
  assert.equal(CENTRAL_LINK_HEALTH_CONTRACT, 'pnm.central-link-health/v1');
  assert.equal(AFFILIATE_INTEGRITY_CONTRACT, 'pnm.affiliate-integrity/v1');
  assert.deepEqual([...LINK_HEALTH_CLASSIFICATIONS], [
    'CORRETO',
    'PROVÁVEL',
    'DIVERGENTE',
    'ANÚNCIO_INDISPONÍVEL',
    'DESTINO_GENÉRICO',
    'PROBLEMA_DE_LINK',
    'NÃO_COMPROVÁVEL',
  ]);
  assert.equal(LINK_HEALTH_CLASSIFICATIONS.length, 7, 'não criar oitavo estado');
  assert.deepEqual([...LINK_HEALTH_ATTENTION_CLASSIFICATIONS], [
    'DIVERGENTE',
    'ANÚNCIO_INDISPONÍVEL',
    'DESTINO_GENÉRICO',
    'PROBLEMA_DE_LINK',
  ]);
  assert.equal(LINK_HEALTH_NON_VERIFIABLE, 'NÃO_COMPROVÁVEL');
  assert.equal(LINK_HEALTH_ATTENTION_CLASSIFICATIONS.includes(LINK_HEALTH_NON_VERIFIABLE), false);
}

function assertEmptyReadModel() {
  const model = createEmptyCentralLinkHealthReadModel({ historyStatus: 'available' });
  assert.equal(model.contract, 'pnm.central-link-health/v1');
  assert.equal(model.sourceContract, 'pnm.affiliate-integrity/v1');
  assert.equal(model.availability, 'none');
  assert.equal(model.defaultView, 'attention');
  assert.equal(model.run, null);
  assert.equal(model.summary, null);
  assert.deepEqual(model.results, []);
  assert.equal(Object.isFrozen(model), true);

  const html = renderLinkHealthPage(model, 'fixtureNonce');
  assert.match(html, /Nenhuma auditoria disponível/);
  assert.match(html, /PRECISA DE ATENÇÃO/);
  assert.match(html, /NÃO_COMPROVÁVEL/);
  assert.match(html, /AUDITAR NOVAMENTE/);
  assert.match(html, /INFORMAR NOVO LINK/);
  assert.match(html, /<button type="button" disabled>AUDITAR NOVAMENTE<\/button>/);
  assert.match(html, /<button type="button" disabled>INFORMAR NOVO LINK<\/button>/);
  assert.match(html, /<script nonce="fixtureNonce">/);
  assert.match(html, /@media\(max-width:800px\)/);
  assert.doesNotMatch(html, /PRODUTO-FICTICIO/);
  for (const state of LINK_HEALTH_CLASSIFICATIONS) assert.match(html, new RegExp(state));
}

function assertPreparedReadModel() {
  const results = LINK_HEALTH_CLASSIFICATIONS.map((classification, index) => ({
    productId: `fixture-${index + 1}`,
    classification,
    auditedLink: `https://example.com/${index + 1}`,
    reason: `fixture-${classification}`,
    checkedAt: '2026-08-25T00:00:00Z',
    runId: 'run-fixture',
  }));
  const model = buildCentralLinkHealthReadModel({
    run: {
      runId: 'run-fixture',
      scope: 'FULL',
      sourceSha: '0123456789abcdef',
      finishedAt: '2026-08-25T00:00:00Z',
      status: 'SUCCESS',
    },
    results,
  });

  assert.equal(model.availability, 'available');
  assert.equal(model.summary.total, 7);
  assert.equal(model.summary.attention, 4);
  assert.equal(model.summary.nonVerifiable, 1);
  for (const state of LINK_HEALTH_CLASSIFICATIONS) assert.equal(model.summary.byClassification[state], 1);
  assert.equal(filterCentralLinkHealthResults(model, 'attention').length, 4);
  assert.equal(filterCentralLinkHealthResults(model, 'non-verifiable').length, 1);
  assert.equal(filterCentralLinkHealthResults(model, 'CORRETO').length, 1);
  assert.equal(filterCentralLinkHealthResults(model, 'all').length, 7);
  assert.deepEqual(filterCentralLinkHealthResults(model, 'ESTADO_INVENTADO'), []);

  const nonVerifiable = model.results.find(result => result.classification === 'NÃO_COMPROVÁVEL');
  assert.equal(nonVerifiable.requiresAttention, false);
  assert.equal(nonVerifiable.nonVerifiable, true);

  assert.throws(
    () => buildCentralLinkHealthReadModel({
      run: { runId: 'x' },
      results: [{ productId: 'x', classification: 'QUEBRADO' }],
    }),
    /invalid-link-health-classification/,
  );
  assert.throws(
    () => buildCentralLinkHealthReadModel({
      results: [{ productId: 'x', classification: 'CORRETO' }],
    }),
    /link-health-run-required/,
  );
}

function assertSecurityAndOwnership() {
  assert.equal(CENTRAL_CONTRACTS.catalog.owner, 'data/produtos-index.js');
  assert.equal(CENTRAL_CONTRACTS.catalog.centralDatabaseOwner, false);
  assert.equal(CENTRAL_CONTRACTS.mutations.products, false);
  assert.equal(CENTRAL_CONTRACTS.mutations.github, false);
  assert.equal(CENTRAL_CONTRACTS.mutations.automaticLinkCorrection, false);
  assert.equal(CENTRAL_CONTRACTS.mutations.automaticLinkMonitor, false);
  assert.equal(CENTRAL_CONTRACTS.affiliateIntegrity.auditDispatchEnabled, false);
  assert.equal(CENTRAL_CONTRACTS.authentication.workerJwtVerification, true);
  assert.equal(CENTRAL_CONTRACTS.authentication.algorithm, 'RS256');

  const healthArea = CENTRAL_AREAS.find(area => area.id === 'saude-links');
  assert.equal(healthArea?.state, 'somente-leitura');

  const config = JSON.parse(read('central/wrangler.jsonc'));
  assert.equal(config.workers_dev, false);
  assert.equal(config.preview_urls, false);
  assert.deepEqual(config.routes, [{ pattern: CENTRAL_HOST, custom_domain: true }]);
  assert.equal('route' in config, false);
  assert.equal('d1_databases' in config, false, 'primeiro deploy gratuito não deve depender de D1');
  assert.equal('triggers' in config, false);

  const worker = read('central/src/worker.mjs');
  assert.match(worker, /url\.pathname === '\/saude-links'/);
  assert.match(worker, /createEmptyCentralLinkHealthReadModel/);
  assert.match(worker, /renderLinkHealthPage/);
  assert.match(worker, /const READ_METHODS = new Set\(\['GET', 'HEAD'\]\)/);
  assert.doesNotMatch(worker, /api\.github\.com/i);

  const source = [
    read('central/src/contracts.mjs'),
    read('central/src/link-health.mjs'),
    read('central/src/link-health-page.mjs'),
    worker,
  ].join('\n');
  assert.doesNotMatch(source, /gh[pousr]_[A-Za-z0-9_]{20,}/);
  assert.doesNotMatch(source, /(?:password|secret)\s*[:=]\s*["'][^"']{8,}["']/i);
  assert.equal(/\bfetch\s*\(/.test(read('central/src/link-health.mjs')), false, 'read model não deve buscar rede');
  assert.equal(/\bfetch\s*\(/.test(read('central/src/link-health-page.mjs')), false, 'UI não deve disparar auditoria/rede');

  const owner = read('data/produtos-index.js');
  assert.match(owner, /^const\s+PRODUTOS\s*=/);
  assert.equal(/^const\s+PRODUTOS\s*=/m.test(read('central/src/link-health.mjs')), false);
  assert.equal(/^const\s+PRODUTOS\s*=/m.test(read('central/src/link-health-page.mjs')), false);
}

function assertPackageGate() {
  const packageJson = JSON.parse(read('package.json'));
  assert.equal(packageJson.scripts['test:l2-4b-central-link-health'], 'node scripts/test-l2-4b-central-link-health.mjs');
  const check = packageJson.scripts.check;
  for (const gate of [
    'test:l2-2-central-foundation',
    'test:l2-4a-central-products',
    'test:l2-4b-central-link-health',
    'test:affiliate-integrity',
    'test:e2-catalog-operations',
    'validate:e2-catalog',
    'wrangler deploy --dry-run',
    'wrangler deploy --dry-run --config central/wrangler.jsonc',
  ]) {
    assert.ok(check.includes(gate), `gate ausente: ${gate}`);
  }
}

assertOfficialContract();
assertEmptyReadModel();
assertPreparedReadModel();
assertSecurityAndOwnership();
assertPackageGate();

console.log(JSON.stringify({
  l24bCentralLinkHealth: 'PASS',
  contract: CENTRAL_LINK_HEALTH_CONTRACT,
  sourceContract: AFFILIATE_INTEGRITY_CONTRACT,
  classifications: LINK_HEALTH_CLASSIFICATIONS,
  attentionClassifications: LINK_HEALTH_ATTENTION_CLASSIFICATIONS,
  nonVerifiableSeparate: true,
  defaultView: 'attention',
  emptyAuditState: true,
  auditDispatchEnabled: false,
  productMutationEnabled: false,
  d1RequiredForInitialDeploy: false,
  scheduler: false,
  adminRoute: CENTRAL_HOST,
}, null, 2));