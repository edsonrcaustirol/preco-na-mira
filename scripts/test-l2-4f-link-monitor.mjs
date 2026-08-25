#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CENTRAL_CONTRACTS } from '../central/src/contracts.mjs';
import { HISTORY_RETENTION_POLICY, pruneAuditHistory } from '../central/src/history-store.mjs';
import {
  ATTENTION_CLASSIFICATIONS,
  D1_RETENTION_POLICY,
  MONITOR_CONTRACT,
  NON_VERIFIABLE,
  buildFactualDelta,
  evaluateAuditRun,
  fingerprintLink,
  isExternalNonVerifiable,
} from './evaluate-affiliate-monitor.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

function report(results, selection = { all: true }) {
  return {
    contract: 'pnm.affiliate-integrity/v1',
    run: { selection },
    summary: { TOTAL: results.length },
    results,
  };
}

function item(product_id, classification, reason = 'resultado determinístico', linkAfiliado = `https://example.com/${product_id}`) {
  return { product_id, classification, reason, linkAfiliado, checkedAt: '2026-08-25T00:00:00Z' };
}

function assertStatusPolicy() {
  const intrinsic = report([
    item('p1', 'CORRETO'),
    item('p2', NON_VERIFIABLE, 'HTTP 200 sem evidência de identidade suficiente.'),
  ]);
  const success = evaluateAuditRun(intrinsic, { auditOutcome: 'success', scope: 'full' });
  assert.equal(success.status, 'SUCCESS', 'NÃO_COMPROVÁVEL contratual não degrada sozinho a FULL');
  assert.equal(success.quality.nonVerifiable, 1);
  assert.equal(success.quality.externalNonVerifiable, 0);

  const external = report([
    item('p1', 'CORRETO'),
    item('p2', NON_VERIFIABLE, 'Falha externa/ambiental: TIMEOUT'),
  ]);
  assert.equal(isExternalNonVerifiable(external.results[1]), true);
  const partial = evaluateAuditRun(external, { auditOutcome: 'success', scope: 'full' });
  assert.equal(partial.status, 'PARTIAL');
  assert.equal(partial.reason, 'EXTERNAL_UNVERIFIABLE_PRESENT');
  assert.equal(partial.quality.externalNonVerifiable, 1);
  assert.equal(external.results[1].classification, NON_VERIFIABLE, 'monitor não converte NÃO_COMPROVÁVEL em problema de link');

  const failed = evaluateAuditRun(null, { auditOutcome: 'failure', scope: 'full' });
  assert.equal(failed.status, 'FAILED');
  assert.equal(evaluateAuditRun(report([item('p1', 'CORRETO')], { all: false }), { auditOutcome: 'success', scope: 'full' }).status, 'FAILED');
}

function assertDeltaPolicy() {
  const previous = [
    item('p1', 'CORRETO'),
    item('p2', 'PROBLEMA_DE_LINK'),
    item('p3', NON_VERIFIABLE),
    item('p4', 'CORRETO'),
  ];
  const current = [
    item('p1', 'DIVERGENTE'),
    item('p2', 'CORRETO'),
    item('p3', 'PROVÁVEL'),
    item('p4', NON_VERIFIABLE, 'Falha transitória do destino (HTTP 503).'),
  ];
  const delta = buildFactualDelta(previous, current, { scope: 'full' });
  const types = Object.fromEntries(delta.events.map(event => [event.product_id, event.type]));
  assert.equal(types.p1, 'ENTERED_ATTENTION');
  assert.equal(types.p2, 'LEFT_ATTENTION');
  assert.equal(types.p3, 'BACK_TO_VERIFIABLE');
  assert.equal(types.p4, 'RESULT_NOT_VERIFIABLE');
  assert.equal(delta.events.some(event => /PIOR/i.test(event.type)), false);

  const incremental = buildFactualDelta(previous, [current[0]], { scope: 'incremental', selectedProductIds: ['p1'] });
  assert.equal(incremental.events.some(event => event.type === 'MISSING_RESULT'), false, 'incremental não recria missingProducts fora da seleção');
}

async function assertRetentionPolicy() {
  const calls = [];
  const db = {
    prepare(sql) {
      return { bind(...binds) { calls.push({ sql, binds }); return this; } };
    },
    async batch(statements) { calls.push({ batchSize: statements.length }); return []; },
  };
  const result = await pruneAuditHistory(db, { beforeIso: '2026-04-27T00:00:00Z', keepRecentRuns: 40 });
  assert.equal(result.preserveLatestHealthyFull, true);
  assert.equal(result.keepRecentRuns, 40);
  assert.equal(HISTORY_RETENTION_POLICY.maxAgeDays, 120);
  assert.deepEqual(D1_RETENTION_POLICY, HISTORY_RETENTION_POLICY);
  const sql = calls.find(call => call.sql)?.sql || '';
  assert.match(sql, /scope = 'FULL' AND status = 'SUCCESS'/);
  assert.match(sql, /NOT IN/);
}

function assertWorkflow() {
  const workflow = read('.github/workflows/auditar-links.yml');
  const wrapper = read('scripts/run-affiliate-integrity-workflow.mjs');
  const evaluator = read('scripts/evaluate-affiliate-monitor.mjs');
  const wrangler = JSON.parse(read('central/wrangler.jsonc'));
  assert.match(workflow, /cron: '17 5 \* \* 0,3'/);
  assert.match(workflow, /domingo→quarta = 3 dias; quarta→domingo = 4 dias/);
  assert.match(workflow, /github\.event_name == 'schedule'.*'full'/);
  assert.match(workflow, /group: affiliate-integrity-\$\{\{ github\.repository \}\}/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /run: node scripts\/run-affiliate-integrity-workflow\.mjs/);
  assert.match(workflow, /run: node scripts\/evaluate-affiliate-monitor\.mjs/);
  assert.equal((workflow.match(/run-affiliate-integrity-workflow\.mjs/g) || []).length, 1, 'um único executor oficial');
  assert.equal((workflow.match(/audit-affiliate-integrity\.mjs/g) || []).length, 0, 'workflow não cria auditor paralelo');
  assert.match(workflow, /retention-days: 30/);
  assert.doesNotMatch(workflow, /secrets\./);
  assert.doesNotMatch(workflow, /wrangler deploy/);
  assert.doesNotMatch(evaluator, /PROBLEMA_DE_LINK.*NÃO_COMPROVÁVEL|NÃO_COMPROVÁVEL.*PROBLEMA_DE_LINK/);
  assert.match(wrapper, /'schedule'/);
  assert.equal('routes' in wrangler, false);
  assert.equal('triggers' in wrangler, false, 'scheduler é GitHub Actions, não cron paralelo no Worker');
  assert.equal(wrangler.workers_dev, false);
  assert.equal(wrangler.preview_urls, false);
}

function assertContractsAndGate() {
  assert.equal(MONITOR_CONTRACT, 'pnm.affiliate-integrity-monitor/v1');
  assert.deepEqual(ATTENTION_CLASSIFICATIONS, ['DIVERGENTE', 'ANÚNCIO_INDISPONÍVEL', 'DESTINO_GENÉRICO', 'PROBLEMA_DE_LINK']);
  assert.equal(CENTRAL_CONTRACTS.catalog.owner, 'data/produtos-index.js');
  assert.equal(CENTRAL_CONTRACTS.d1.authoritativeCatalog, false);
  assert.equal(CENTRAL_CONTRACTS.d1.remoteProvisioned, false);
  assert.equal(CENTRAL_CONTRACTS.affiliateIntegrity.executor.scheduled, true);
  assert.equal(CENTRAL_CONTRACTS.affiliateIntegrity.executor.scheduleCron, '17 5 * * 0,3');
  assert.equal(CENTRAL_CONTRACTS.affiliateIntegrity.executor.scheduleSemantics, 'weekly-sunday-wednesday-intervals-of-three-or-four-days');
  assert.deepEqual(CENTRAL_CONTRACTS.affiliateIntegrity.runStatuses, ['SUCCESS', 'PARTIAL', 'FAILED']);
  assert.match(fingerprintLink(' https://example.com/x '), /^sha256:[0-9a-f]{64}$/);
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['test:l2-4f-link-monitor'], 'node scripts/test-l2-4f-link-monitor.mjs');
  for (const gate of ['test:l2-4e-health-history', 'test:l2-4f-link-monitor', 'test:affiliate-integrity', 'test:e2-catalog-operations']) {
    assert.ok(pkg.scripts.check.includes(gate), `gate ausente: ${gate}`);
  }
}

assertStatusPolicy();
assertDeltaPolicy();
await assertRetentionPolicy();
assertWorkflow();
assertContractsAndGate();
console.log(JSON.stringify({
  l24fLinkMonitor: 'PASS',
  schedule: '17 5 * * 0,3',
  scheduleSemantics: 'weekly-sunday-wednesday-intervals-of-three-or-four-days',
  singleFlight: true,
  executorReused: true,
  statuses: ['SUCCESS', 'PARTIAL', 'FAILED'],
  nonVerifiableNeverBroken: true,
  factualDelta: true,
  retentionBounded: true,
  remoteD1Provisioned: false,
  manualDeploy: false,
}, null, 2));
