#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildCentralLinkHealthReadModel, createEmptyCentralLinkHealthReadModel } from '../central/src/link-health.mjs';
import { buildCentralOperationalReadModel, productHealthState } from '../central/src/operational-read-model.mjs';
import { renderOperationalDashboard, renderOperationalHistory } from '../central/src/operational-pages.mjs';
import { renderOperationalProductsPage } from '../central/src/products-operational-page.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const generatedPath = path.join(ROOT, 'central/src/generated/products.mjs');
if (!fs.existsSync(generatedPath)) {
  const built = spawnSync(process.execPath, ['scripts/build-central-products.mjs'], { cwd: ROOT, stdio: 'inherit', shell: false });
  assert.equal(built.status, 0, 'projeção read-only deve ser gerável deterministicamente');
}
const { CENTRAL_PRODUCTS_PROJECTION } = await import('../central/src/generated/products.mjs');
const expectedTotal = CENTRAL_PRODUCTS_PROJECTION.total;

const emptyHealth = createEmptyCentralLinkHealthReadModel({ historyStatus: 'available', coverage: { productsTotal: CENTRAL_PRODUCTS_PROJECTION.total, currentResults: 0, staleResults: 0, notAudited: CENTRAL_PRODUCTS_PROJECTION.total } });
const emptyOperational = buildCentralOperationalReadModel({ projection: CENTRAL_PRODUCTS_PROJECTION, history: null, historyStatus: 'unbound', linkHealth: emptyHealth });
assert.equal(emptyOperational.catalog.total, expectedTotal);
assert.equal(emptyOperational.catalog.owner, 'data/produtos-index.js');
assert.equal(emptyOperational.history.remoteProvisioned, false);
assert.equal(emptyOperational.monitor.configured, true);
assert.equal(emptyOperational.monitor.observedScheduledRun, false);
assert.equal(emptyOperational.health.currentResults, null, 'sem D1, cobertura histórica não pode virar zero real');
assert.match(renderOperationalDashboard(emptyOperational), /Histórico remoto ainda não provisionado/);
assert.match(renderOperationalDashboard(emptyOperational), new RegExp(`>${expectedTotal}<`));
assert.doesNotMatch(renderOperationalDashboard(emptyOperational), /PRECISA DE ATENÇÃO<\/span><strong>0</, 'ausência de D1 não pode inventar zero histórico');
assert.doesNotMatch(renderOperationalDashboard(emptyOperational), /AUDITORIA ATUAL<\/span><strong>0</, 'ausência de D1 não pode inventar cobertura zero');

const currentHealth = buildCentralLinkHealthReadModel({ run: { runId: 'full-1', scope: 'FULL', sourceSha: 'a'.repeat(40), finishedAt: '2026-08-25T01:00:00Z', status: 'SUCCESS' }, results: [{ productId: CENTRAL_PRODUCTS_PROJECTION.products[0].id, classification: 'CORRETO', auditedLink: CENTRAL_PRODUCTS_PROJECTION.products[0].linkAfiliado, reason: 'ok', checkedAt: '2026-08-25T01:00:00Z', runId: 'full-1' }], historyStatus: 'available', coverage: { productsTotal: expectedTotal, currentResults: 1, staleResults: 0, notAudited: expectedTotal - 1 } });
assert.equal(productHealthState(CENTRAL_PRODUCTS_PROJECTION.products[0].id, currentHealth).state, 'current');
const operationalWithSchedule = buildCentralOperationalReadModel({
  projection: CENTRAL_PRODUCTS_PROJECTION,
  historyStatus: 'available',
  linkHealth: currentHealth,
  history: {
    recentRuns: [{ run_id: 'full-1', trigger: 'schedule', scope: 'FULL', status: 'SUCCESS', source_sha: 'a'.repeat(40), finished_at: '2026-08-25T01:00:00Z' }],
    latestHealthyFull: { run_id: 'full-1', trigger: 'schedule', scope: 'FULL', status: 'SUCCESS', source_sha: 'a'.repeat(40), finished_at: '2026-08-25T01:00:00Z' },
    results: [{}],
    events: [],
  },
});
assert.equal(operationalWithSchedule.monitor.observedScheduledRun, true, 'execução agendada só é observada quando existe run schedule persistida');
assert.equal(operationalWithSchedule.health.currentResults, 1);

const productHtml = renderOperationalProductsPage(CENTRAL_PRODUCTS_PROJECTION, currentHealth, 'nonceFixture');
assert.match(productHtml, /Resultado atual compatível com o link atual/);
assert.match(productHtml, /AUDITAR NOVAMENTE/);
assert.match(productHtml, /disabled>AUDITAR NOVAMENTE/);
assert.match(productHtml, /overflow-x:hidden/);

const historyHtml = renderOperationalHistory({ historyStatus: 'available', history: { recentRuns: [{ run_id: 'r1', scope: 'FULL', status: 'PARTIAL', source_sha: 'b'.repeat(40), finished_at: '2026-08-25T01:00:00Z' }], latestHealthyFull: { run_id: 'r0', scope: 'FULL', status: 'SUCCESS', finished_at: '2026-08-22T01:00:00Z' }, results: [{ run_id: 'r1', product_id: 'p1', classification: 'NÃO_COMPROVÁVEL', scope: 'FULL', status: 'PARTIAL', checked_at: '2026-08-25T01:00:00Z' }], events: [{ event_id: 'e1', run_id: 'r1', product_id: 'p1', event_type: 'RESULT_NOT_VERIFIABLE', occurred_at: '2026-08-25T01:00:00Z' }] } });
assert.match(historyHtml, /RESULT_NOT_VERIFIABLE/);
assert.match(historyHtml, /NÃO_COMPROVÁVEL/);
assert.doesNotMatch(historyHtml, /<pre[ >]/i, 'JSON cru não deve ser UX principal');
assert.match(historyHtml, /overflow-x:hidden/);

const worker = read('central/src/worker.mjs');
const config = JSON.parse(read('central/wrangler.jsonc'));
assert.match(worker, /renderOperationalDashboard/);
assert.match(worker, /renderOperationalProductsPage/);
assert.match(worker, /renderOperationalHistory/);
assert.match(worker, /PNM_HISTORY_DB/);
assert.match(worker, /generated\/products\.mjs/);
assert.match(worker, /ERR_MODULE_NOT_FOUND/);
assert.match(worker, /verifyCloudflareAccessAssertion/);
assert.doesNotMatch(worker, /spawnSync|auditProducts|GITHUB_TOKEN/);
assert.equal(config.workers_dev, false);
assert.equal(config.preview_urls, false);
assert.equal('routes' in config, false);
assert.equal('d1_databases' in config, false);
assert.equal('triggers' in config, false);

const pkg = JSON.parse(read('package.json'));
assert.equal(pkg.scripts['test:l2-4g-central-operational'], 'node scripts/test-l2-4g-central-operational.mjs');
for (const gate of ['test:l2-4f-link-monitor', 'test:l2-4g-central-operational', 'test:affiliate-integrity', 'test:e2-catalog-operations']) assert.ok(pkg.scripts.check.includes(gate));
console.log(JSON.stringify({ l24gCentralOperational: 'PASS', products: expectedTotal, dashboard: true, productsHealth: true, historyUx: true, d1RemoteProvisioned: false, scheduledRunClaimRequiresEvidence: true, adminRoute: false, mobileNoHorizontalOverflow: true }, null, 2));
