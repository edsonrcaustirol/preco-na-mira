#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { generateCentralProducts, CENTRAL_PRODUCTS_OWNER } from './build-central-products.mjs';
import { CENTRAL_AFFILIATE_HISTORY_SNAPSHOT } from '../central/src/affiliate-history-snapshot.mjs';

assert.equal(CENTRAL_AFFILIATE_HISTORY_SNAPSHOT.contract, 'pnm.central-history/v1');
assert.equal(CENTRAL_AFFILIATE_HISTORY_SNAPSHOT.source, 'github-actions-versioned-snapshot');
assert.equal(CENTRAL_AFFILIATE_HISTORY_SNAPSHOT.results.length, 596);
assert.equal(new Set(CENTRAL_AFFILIATE_HISTORY_SNAPSHOT.results.map(item => item.product_id)).size, 596);
assert.equal(CENTRAL_AFFILIATE_HISTORY_SNAPSHOT.latestHealthyFull.run_id, '33294484400-1');
assert.equal(CENTRAL_AFFILIATE_HISTORY_SNAPSHOT.latestHealthyFull.scope, 'FULL');
assert.equal(CENTRAL_AFFILIATE_HISTORY_SNAPSHOT.latestHealthyFull.status, 'SUCCESS');
assert.equal(CENTRAL_AFFILIATE_HISTORY_SNAPSHOT.latestHealthyFull.source_sha, 'af24f5477a89ed048e5f5f3c47da45aef45ef4c9');
assert.equal(CENTRAL_AFFILIATE_HISTORY_SNAPSHOT.results.some(item => item.product_id === 'rejunte-epoxi-super-facil-1kg-quartzolit-1kg-varias-cores'), false);
assert.equal(CENTRAL_AFFILIATE_HISTORY_SNAPSHOT.results.some(item => item.product_id === 'rejunte-epoxi-super-facil-1kg-quartzolit-varias-cores'), true);

const canonical = fs.readFileSync(CENTRAL_PRODUCTS_OWNER, 'utf8');
assert.match(canonical, /^const\s+PRODUTOS\s*=/);
const generated = generateCentralProducts();
assert.equal(generated.total, 601);

const [{ CENTRAL_PRODUCTS_PROJECTION, CENTRAL_PRODUCT_LINK_FINGERPRINTS }, { createEmptyCentralLinkHealthReadModel }, { buildCentralOperationalReadModel }, { renderOperationalHistory }] = await Promise.all([
  import(`../central/src/generated/products.mjs?o81=${Date.now()}`),
  import(`../central/src/link-health.mjs?o81=${Date.now()}`),
  import('../central/src/operational-read-model.mjs'),
  import('../central/src/operational-pages.mjs'),
]);
assert.equal(CENTRAL_PRODUCTS_PROJECTION.products.length, 601);
assert.equal(Object.keys(CENTRAL_PRODUCT_LINK_FINGERPRINTS).length, 601);
assert.equal(CENTRAL_PRODUCTS_PROJECTION.products.every(product => /^sha256:[0-9a-f]{64}$/.test(String(CENTRAL_PRODUCT_LINK_FINGERPRINTS[product.id] || ''))), true);

const linkHealth = createEmptyCentralLinkHealthReadModel({ historyStatus: 'unbound' });
assert.equal(linkHealth.availability, 'available');
assert.equal(linkHealth.historyStatus, 'snapshot');
assert.equal(linkHealth.coverage.productsTotal, 601);
assert.equal(linkHealth.coverage.currentResults, 596);
assert.equal(linkHealth.coverage.staleResults, 0);
assert.equal(linkHealth.coverage.notAudited, 5);
assert.equal(linkHealth.summary.attention, 56);
assert.equal(linkHealth.summary.nonVerifiable, 109);

const operational = buildCentralOperationalReadModel({ projection: CENTRAL_PRODUCTS_PROJECTION, history: null, historyStatus: 'unbound', linkHealth });
assert.equal(operational.history.status, 'snapshot');
assert.equal(operational.history.latestRun.runId, '33294484400-1');
assert.equal(operational.monitor.observedScheduledRun, true);
assert.equal(operational.health.currentResults, 596);
assert.equal(operational.health.notAudited, 5);

const html = renderOperationalHistory({ historyStatus: 'unbound', history: null });
for (const expected of ['SNAPSHOT AUDITADO', '33294484400-1', '>596<', 'D1 remoto: NÃO PROVISIONADO', 'SUCCESS']) assert.match(html, new RegExp(expected));

console.log(JSON.stringify({
  o81CentralHistorySnapshot: 'PASS',
  catalog: 601,
  auditedCurrent: 596,
  stale: 0,
  notAudited: 5,
  attention: 56,
  nonVerifiable: 109,
  sourceRun: '33294484400-1',
  d1ClaimedProvisioned: false,
}, null, 2));
