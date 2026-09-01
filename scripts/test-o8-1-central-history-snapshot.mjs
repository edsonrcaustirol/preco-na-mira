#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { generateCentralProducts, CENTRAL_PRODUCTS_OWNER } from './build-central-products.mjs';
import { CENTRAL_AFFILIATE_HISTORY_SNAPSHOT } from '../central/src/affiliate-history-snapshot.mjs';

assert.equal(CENTRAL_AFFILIATE_HISTORY_SNAPSHOT.contract, 'pnm.central-history/v1');
assert.equal(CENTRAL_AFFILIATE_HISTORY_SNAPSHOT.source, 'github-actions-versioned-snapshot');
assert.ok(CENTRAL_AFFILIATE_HISTORY_SNAPSHOT.results.length > 0);
assert.equal(
  new Set(CENTRAL_AFFILIATE_HISTORY_SNAPSHOT.results.map(item => item.product_id)).size,
  CENTRAL_AFFILIATE_HISTORY_SNAPSHOT.results.length,
);
assert.equal(CENTRAL_AFFILIATE_HISTORY_SNAPSHOT.latestHealthyFull.scope, 'FULL');
assert.equal(CENTRAL_AFFILIATE_HISTORY_SNAPSHOT.latestHealthyFull.status, 'SUCCESS');
assert.match(CENTRAL_AFFILIATE_HISTORY_SNAPSHOT.latestHealthyFull.source_sha, /^[0-9a-f]{40}$/i);
const snapshotTotals = JSON.parse(CENTRAL_AFFILIATE_HISTORY_SNAPSHOT.latestHealthyFull.totals_json || '{}');
assert.equal(snapshotTotals.TOTAL, CENTRAL_AFFILIATE_HISTORY_SNAPSHOT.results.length);
assert.equal(CENTRAL_AFFILIATE_HISTORY_SNAPSHOT.results.some(item => item.product_id === 'rejunte-epoxi-super-facil-1kg-quartzolit-1kg-varias-cores'), false);
assert.equal(CENTRAL_AFFILIATE_HISTORY_SNAPSHOT.results.some(item => item.product_id === 'rejunte-epoxi-super-facil-1kg-quartzolit-varias-cores'), true);

const canonical = fs.readFileSync(CENTRAL_PRODUCTS_OWNER, 'utf8');
assert.match(canonical, /^const\s+PRODUTOS\s*=/);
const generated = generateCentralProducts();
assert.ok(generated.total > 0);

const [{ CENTRAL_PRODUCTS_PROJECTION, CENTRAL_PRODUCT_LINK_FINGERPRINTS }, { createEmptyCentralLinkHealthReadModel }, { buildCentralOperationalReadModel }, { renderOperationalHistory }] = await Promise.all([
  import(`../central/src/generated/products.mjs?o82=${Date.now()}`),
  import(`../central/src/link-health.mjs?o82=${Date.now()}`),
  import('../central/src/operational-read-model.mjs'),
  import('../central/src/operational-pages.mjs'),
]);
assert.equal(CENTRAL_PRODUCTS_PROJECTION.products.length, generated.total);
assert.equal(Object.keys(CENTRAL_PRODUCT_LINK_FINGERPRINTS).length, generated.total);
assert.equal(CENTRAL_PRODUCTS_PROJECTION.products.every(product => /^sha256:[0-9a-f]{64}$/.test(String(CENTRAL_PRODUCT_LINK_FINGERPRINTS[product.id] || ''))), true);

const currentProductIds = new Set(CENTRAL_PRODUCTS_PROJECTION.products.map(product => product.id));
let expectedCurrent = 0;
let expectedStale = 0;
const auditedCurrentProductIds = new Set();
for (const result of CENTRAL_AFFILIATE_HISTORY_SNAPSHOT.results) {
  if (!currentProductIds.has(result.product_id)) continue;
  auditedCurrentProductIds.add(result.product_id);
  if (CENTRAL_PRODUCT_LINK_FINGERPRINTS[result.product_id] === result.link_fingerprint) expectedCurrent += 1;
  else expectedStale += 1;
}
const expectedNotAudited = Math.max(0, generated.total - auditedCurrentProductIds.size);

const linkHealth = createEmptyCentralLinkHealthReadModel({ historyStatus: 'unbound' });
assert.equal(linkHealth.availability, 'available');
assert.equal(linkHealth.historyStatus, 'snapshot');
assert.equal(linkHealth.coverage.productsTotal, generated.total);
assert.equal(linkHealth.coverage.currentResults, expectedCurrent);
assert.equal(linkHealth.coverage.staleResults, expectedStale);
assert.equal(linkHealth.coverage.notAudited, expectedNotAudited);
assert.equal(linkHealth.coverage.currentResults + linkHealth.coverage.staleResults + linkHealth.coverage.notAudited, generated.total);
assert.equal(linkHealth.summary.total, expectedCurrent);

const operational = buildCentralOperationalReadModel({ projection: CENTRAL_PRODUCTS_PROJECTION, history: null, historyStatus: 'unbound', linkHealth });
assert.equal(operational.history.status, 'snapshot');
assert.equal(operational.history.latestRun.runId, CENTRAL_AFFILIATE_HISTORY_SNAPSHOT.latestHealthyFull.run_id);
assert.equal(
  operational.monitor.observedScheduledRun,
  CENTRAL_AFFILIATE_HISTORY_SNAPSHOT.recentRuns.some(item => item?.trigger === 'schedule'),
);
assert.equal(operational.health.currentResults, expectedCurrent);
assert.equal(operational.health.staleResults, expectedStale);
assert.equal(operational.health.notAudited, expectedNotAudited);

const html = renderOperationalHistory({ historyStatus: 'unbound', history: null });
for (const expected of [
  'SNAPSHOT AUDITADO',
  CENTRAL_AFFILIATE_HISTORY_SNAPSHOT.latestHealthyFull.run_id,
  `>${expectedCurrent}<`,
  'D1 remoto: NÃO PROVISIONADO',
  'SUCCESS',
]) assert.match(html, new RegExp(expected));

console.log(JSON.stringify({
  o82DynamicCentralHistorySnapshot: 'PASS',
  catalog: generated.total,
  auditedCurrent: expectedCurrent,
  stale: expectedStale,
  notAudited: expectedNotAudited,
  sourceRun: CENTRAL_AFFILIATE_HISTORY_SNAPSHOT.latestHealthyFull.run_id,
  snapshotResults: CENTRAL_AFFILIATE_HISTORY_SNAPSHOT.results.length,
  observedScheduledRun: operational.monitor.observedScheduledRun,
  d1ClaimedProvisioned: false,
}, null, 2));
