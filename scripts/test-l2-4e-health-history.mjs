#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CENTRAL_HISTORY_CONTRACT } from '../central/src/history-store.mjs';
import {
  buildCentralLinkHealthReadModelFromHistory,
  describeLinkHealthDelta,
  fingerprintAffiliateLink,
} from '../central/src/link-health-history.mjs';
import { renderLinkHealthPage } from '../central/src/link-health-page.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

async function assertHistoryMapping() {
  const links = {
    p1: 'https://example.com/current-1',
    p2: 'https://example.com/current-2',
    p3: 'https://example.com/current-3',
    old2: 'https://example.com/old-2',
  };
  const [fp1, fp2, fp3, oldFp2] = await Promise.all([
    fingerprintAffiliateLink(links.p1),
    fingerprintAffiliateLink(links.p2),
    fingerprintAffiliateLink(links.p3),
    fingerprintAffiliateLink(links.old2),
  ]);
  assert.match(fp1, /^sha256:[0-9a-f]{64}$/);
  assert.equal(await fingerprintAffiliateLink(`  ${links.p1}  `), fp1, 'fingerprint ignora whitespace periférico');
  assert.notEqual(fp2, oldFp2);

  const history = {
    contract: CENTRAL_HISTORY_CONTRACT,
    latestHealthyFull: { run_id: 'full-2', scope: 'FULL', source_sha: 'b'.repeat(40), finished_at: '2026-08-25T03:00:00Z', status: 'SUCCESS' },
    recentRuns: [{ run_id: 'full-2', scope: 'FULL', source_sha: 'b'.repeat(40), finished_at: '2026-08-25T03:00:00Z', status: 'SUCCESS' }],
    results: [
      { run_id: 'full-2', product_id: 'p1', audited_link: links.p1, link_fingerprint: fp1, classification: 'DIVERGENTE', reason: 'destino diverge', checked_at: '2026-08-25T02:59:00Z', scope: 'FULL', status: 'SUCCESS', source_sha: 'b'.repeat(40), finished_at: '2026-08-25T03:00:00Z' },
      { run_id: 'full-2', product_id: 'p3', audited_link: links.p3, link_fingerprint: fp3, classification: 'NÃO_COMPROVÁVEL', reason: 'rede externa', checked_at: '2026-08-25T02:58:00Z', scope: 'FULL', status: 'SUCCESS', source_sha: 'b'.repeat(40), finished_at: '2026-08-25T03:00:00Z' },
      { run_id: 'full-1', product_id: 'p2', audited_link: links.old2, link_fingerprint: oldFp2, classification: 'PROBLEMA_DE_LINK', reason: 'link antigo', checked_at: '2026-08-22T02:00:00Z', scope: 'FULL', status: 'SUCCESS', source_sha: 'a'.repeat(40), finished_at: '2026-08-22T03:00:00Z' },
      { run_id: 'full-1', product_id: 'p1', audited_link: links.p1, link_fingerprint: fp1, classification: 'CORRETO', reason: 'antes correto', checked_at: '2026-08-22T01:59:00Z', scope: 'FULL', status: 'SUCCESS', source_sha: 'a'.repeat(40), finished_at: '2026-08-22T03:00:00Z' },
    ],
  };
  const products = [
    { id: 'p1', linkAfiliado: links.p1 },
    { id: 'p2', linkAfiliado: links.p2 },
    { id: 'p3', linkAfiliado: links.p3 },
    { id: 'p4', linkAfiliado: 'https://example.com/current-4' },
  ];

  const model = await buildCentralLinkHealthReadModelFromHistory({ products, history });
  assert.equal(model.historyStatus, 'available');
  assert.equal(model.referenceFull.runId, 'full-2');
  assert.equal(model.summary.total, 2);
  assert.equal(model.summary.attention, 1);
  assert.equal(model.summary.nonVerifiable, 1);
  assert.deepEqual(model.coverage, { productsTotal: 4, currentResults: 2, staleResults: 1, notAudited: 1 });
  assert.equal(model.results.some(item => item.productId === 'p2'), false, 'resultado de link antigo não vira saúde atual');
  assert.equal(model.staleResults[0].productId, 'p2');
  assert.match(model.staleResults[0].reason, /obsoleto/i);
  assert.equal(model.results.find(item => item.productId === 'p1').delta, 'ENTERED_ATTENTION');
  assert.equal(model.results.find(item => item.productId === 'p3').delta, 'RESULT_NOT_VERIFIABLE');

  const html = renderLinkHealthPage(model, 'fixtureNonce');
  assert.match(html, /Resultados obsoletos/);
  assert.match(html, /RESULTADO OBSOLETO/);
  assert.match(html, /NÃO_COMPROVÁVEL/);
  assert.match(html, /Última FULL saudável/);
  assert.match(html, /AUDITAR NOVAMENTE/);
  assert.match(html, /<button type="button" disabled>AUDITAR NOVAMENTE<\/button>/);
  assert.doesNotMatch(html, />PIOROU</);
}

function assertDeltaVocabulary() {
  assert.equal(describeLinkHealthDelta(null, null), 'NOT_AUDITED');
  assert.equal(describeLinkHealthDelta(null, 'CORRETO'), 'NO_COMPARISON_REFERENCE');
  assert.equal(describeLinkHealthDelta('CORRETO', 'DIVERGENTE'), 'ENTERED_ATTENTION');
  assert.equal(describeLinkHealthDelta('PROBLEMA_DE_LINK', 'CORRETO'), 'LEFT_ATTENTION');
  assert.equal(describeLinkHealthDelta('CORRETO', 'PROVÁVEL'), 'CLASSIFICATION_CHANGED');
  assert.equal(describeLinkHealthDelta('CORRETO', 'CORRETO'), 'SAME_CLASSIFICATION');
  assert.equal(describeLinkHealthDelta('PROBLEMA_DE_LINK', 'NÃO_COMPROVÁVEL'), 'RESULT_NOT_VERIFIABLE');
}

function assertRuntimeSafety() {
  const worker = read('central/src/worker.mjs');
  const adapter = read('central/src/link-health-history.mjs');
  const history = read('central/src/history-store.mjs');
  const page = read('central/src/link-health-page.mjs');
  const wrangler = JSON.parse(read('central/wrangler.jsonc'));
  assert.match(worker, /env\?\.PNM_HISTORY_DB/);
  assert.match(worker, /readCentralOperationalHistory\(env\.PNM_HISTORY_DB\)/);
  assert.match(worker, /historyStatus: 'unbound'/);
  assert.match(worker, /historyStatus: 'unavailable'/);
  assert.match(history, /u\.status IN \('SUCCESS', 'PARTIAL'\)/);
  assert.match(history, /scope = 'FULL' AND status = 'SUCCESS'/);
  assert.doesNotMatch(adapter, /\bfetch\s*\(/);
  assert.doesNotMatch(page, /secrets\.|api\.github\.com/i);
  assert.doesNotMatch(`${adapter}\n${page}`, /newExceptions\s*=|PIOROU\s*=/);
  assert.equal('d1_databases' in wrangler, false, 'binding remoto segue não provisionado; não inventar database_id');
  assert.equal('routes' in wrangler, false);
  assert.equal('triggers' in wrangler, false);
}

function assertPackageGate() {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['test:l2-4e-health-history'], 'node scripts/test-l2-4e-health-history.mjs');
  for (const gate of ['test:l2-4b-central-link-health', 'test:l2-4c-affiliate-executor', 'test:l2-4d-operational-history', 'test:l2-4e-health-history', 'test:affiliate-integrity', 'test:e2-catalog-operations']) {
    assert.ok(pkg.scripts.check.includes(gate), `gate ausente: ${gate}`);
  }
}

await assertHistoryMapping();
assertDeltaVocabulary();
assertRuntimeSafety();
assertPackageGate();
console.log(JSON.stringify({ l24eHealthHistory: 'PASS', currentLinkFingerprintRequired: true, staleNeverCurrent: true, nonVerifiableSeparate: true, objectiveDeltaVocabulary: true, auditDispatchEnabled: false, remoteD1Provisioned: false }, null, 2));
