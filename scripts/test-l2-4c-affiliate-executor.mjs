#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CENTRAL_CONTRACTS } from '../central/src/contracts.mjs';
import {
  EXECUTION_CONTRACT,
  EXECUTOR_SCOPES,
  REPORT_CONTRACT,
  buildAuditExecutionPlan,
  parseProductIds,
} from './run-affiliate-integrity-workflow.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_SHA = '0123456789abcdef0123456789abcdef01234567';

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function env(extra = {}) {
  return {
    GITHUB_RUN_ID: '123456',
    GITHUB_RUN_ATTEMPT: '2',
    GITHUB_SHA: FIXTURE_SHA,
    GITHUB_REF: 'refs/heads/main',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    PNM_AUDIT_SCOPE: 'full',
    PNM_AUDIT_PRODUCT_ID: '',
    PNM_AUDIT_PRODUCT_IDS: '',
    PNM_AUDIT_INPUT_JSON: '',
    PNM_AUDIT_COMPARE_REPORT_JSON: '',
    ...extra,
  };
}

function assertPlans() {
  assert.equal(EXECUTION_CONTRACT, 'pnm.affiliate-integrity-execution/v1');
  assert.equal(REPORT_CONTRACT, 'pnm.affiliate-integrity/v1');
  assert.deepEqual([...EXECUTOR_SCOPES], ['full', 'product', 'batch', 'input']);

  const full = buildAuditExecutionPlan(env());
  assert.equal(full.scope, 'full');
  assert.deepEqual(full.auditArgs, ['--output', 'artifacts/affiliate-integrity/run-123456-attempt-2/report.json']);
  assert.equal(full.sourceSha, FIXTURE_SHA);

  const product = buildAuditExecutionPlan(env({ PNM_AUDIT_SCOPE: 'product', PNM_AUDIT_PRODUCT_ID: 'furadeira-dewalt-123' }));
  assert.equal(product.productId, 'furadeira-dewalt-123');
  assert.deepEqual(product.auditArgs.slice(0, 2), ['--id', 'furadeira-dewalt-123']);

  const batch = buildAuditExecutionPlan(env({ PNM_AUDIT_SCOPE: 'batch', PNM_AUDIT_PRODUCT_IDS: 'abc-1,abc-2,abc-1' }));
  assert.deepEqual(batch.productIds, ['abc-1', 'abc-2']);
  assert.deepEqual(batch.auditArgs.slice(0, 2), ['--ids', 'abc-1,abc-2']);

  const input = buildAuditExecutionPlan(env({
    PNM_AUDIT_SCOPE: 'input',
    PNM_AUDIT_INPUT_JSON: JSON.stringify([{ id: 'novo-1', nome: 'Teste', marca: 'Marca', categoria: 'Categoria', linkAfiliado: 'https://example.com' }]),
  }));
  assert.equal(input.inputJson.includes('novo-1'), true);
  assert.deepEqual(input.auditArgs.slice(0, 2), ['--input', 'artifacts/affiliate-integrity/run-123456-attempt-2/input.json']);

  const compare = buildAuditExecutionPlan(env({
    PNM_AUDIT_COMPARE_REPORT_JSON: JSON.stringify({ contract: REPORT_CONTRACT, results: [] }),
  }));
  assert.equal(compare.compareJson.includes(REPORT_CONTRACT), true);
  assert.equal(compare.auditArgs.includes('--compare-to'), true);

  assert.deepEqual(parseProductIds('a,b,a'), ['a', 'b']);
  assert.throws(() => parseProductIds('ok,bad;rm'), /product_id inválido/);
  assert.throws(() => buildAuditExecutionPlan(env({ PNM_AUDIT_SCOPE: 'shell' })), /scope inválido/);
  assert.throws(() => buildAuditExecutionPlan(env({ PNM_AUDIT_SCOPE: 'product', PNM_AUDIT_PRODUCT_ID: 'x && echo pwn' })), /product_id inválido/);
  assert.throws(() => buildAuditExecutionPlan(env({ PNM_AUDIT_SCOPE: 'full', PNM_AUDIT_PRODUCT_ID: 'abc' })), /não aceita seleção adicional/);
  assert.throws(() => buildAuditExecutionPlan(env({ PNM_AUDIT_SCOPE: 'batch', PNM_AUDIT_PRODUCT_IDS: '' })), /product_ids obrigatório/);
  assert.throws(() => buildAuditExecutionPlan(env({ PNM_AUDIT_COMPARE_REPORT_JSON: '{"contract":"outro","results":[]}' })), /incompatível/);
  assert.throws(() => buildAuditExecutionPlan(env({ GITHUB_SHA: 'main' })), /GITHUB_SHA inválido/);
}

function assertWorkflow() {
  const workflow = read('.github/workflows/auditar-links.yml');
  assert.match(workflow, /^name: Auditar integridade dos links$/m);
  assert.match(workflow, /^  workflow_dispatch:$/m);
  assert.match(workflow, /^  schedule:$/m, 'schedule da L2.4F deve reutilizar o executor L2.4C');
  assert.match(workflow, /type: choice/);
  for (const scope of EXECUTOR_SCOPES) assert.match(workflow, new RegExp(`^          - ${scope}$`, 'm'));
  assert.match(workflow, /^permissions:\n  contents: write\n  pull-requests: write$/m);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /run: node scripts\/run-affiliate-integrity-workflow\.mjs/);
  assert.match(workflow, /uses: actions\/upload-artifact@v4/);
  assert.doesNotMatch(workflow, /secrets\./i);
  assert.doesNotMatch(workflow, /run:[^\n]*\$\{\{\s*inputs\./, 'input não pode ser interpolado em comando shell');
  assert.doesNotMatch(workflow, /pull_request_target/);
}

function assertReuseAndSecurity() {
  const wrapper = read('scripts/run-affiliate-integrity-workflow.mjs');
  const auditor = read('scripts/audit-affiliate-integrity.mjs');
  const worker = read('central/src/worker.mjs');
  const config = JSON.parse(read('central/wrangler.jsonc'));

  assert.match(wrapper, /scripts', 'audit-affiliate-integrity\.mjs'/);
  assert.match(wrapper, /spawnSync\(process\.execPath/);
  assert.match(wrapper, /shell: false/);
  assert.doesNotMatch(wrapper, /execSync|execFileSync|\beval\s*\(/);
  assert.match(auditor, /pnm\.affiliate-integrity\/v1/);
  assert.doesNotMatch(worker, /affiliate-integrity-execution|spawnSync|auditProducts/);
  assert.equal(config.workers_dev, false);
  assert.equal(config.preview_urls, false);
  assert.equal('routes' in config, false);
  assert.equal('route' in config, false);
  assert.equal(Array.isArray(config.d1_databases), true, 'D1 operacional deve estar declarado');
  assert.equal(config.d1_databases.some(entry => entry?.binding === 'PNM_HISTORY_DB'), true, 'binding PNM_HISTORY_DB ausente');
  assert.equal('triggers' in config, false);
  assert.equal(CENTRAL_CONTRACTS.catalog.owner, 'data/produtos-index.js');
  assert.equal(CENTRAL_CONTRACTS.catalog.centralDatabaseOwner, false);
  assert.equal(CENTRAL_CONTRACTS.affiliateIntegrity.cli, 'scripts/audit-affiliate-integrity.mjs');
  assert.equal(CENTRAL_CONTRACTS.affiliateIntegrity.executionContract, EXECUTION_CONTRACT);
  assert.equal(CENTRAL_CONTRACTS.affiliateIntegrity.executor.kind, 'github-actions');
  assert.equal(CENTRAL_CONTRACTS.affiliateIntegrity.executor.arbitraryCommand, false);
  assert.equal(CENTRAL_CONTRACTS.affiliateIntegrity.executor.scheduled, true);
  assert.equal(CENTRAL_CONTRACTS.affiliateIntegrity.executor.scheduleCron, '17 5 * * 0,3');
  assert.equal(CENTRAL_CONTRACTS.affiliateIntegrity.auditDispatchEnabled, false);
  assert.equal(CENTRAL_CONTRACTS.mutations.products, false);
  assert.equal(CENTRAL_CONTRACTS.mutations.github, false);
}

function assertPackageGate() {
  const packageJson = JSON.parse(read('package.json'));
  assert.equal(packageJson.scripts['test:l2-4c-affiliate-executor'], 'node scripts/test-l2-4c-affiliate-executor.mjs');
  const check = packageJson.scripts.check;
  for (const gate of [
    'test:l2-2-central-foundation',
    'test:l2-4a-central-products',
    'test:l2-4b-central-link-health',
    'test:l2-4c-affiliate-executor',
    'test:affiliate-integrity',
    'test:e2-catalog-operations',
    'validate:e2-catalog',
    'wrangler deploy --dry-run',
    'wrangler deploy --dry-run --config central/wrangler.jsonc',
  ]) assert.ok(check.includes(gate), `gate ausente: ${gate}`);
}

assertPlans();
assertWorkflow();
assertReuseAndSecurity();
assertPackageGate();

console.log(JSON.stringify({
  l24cAffiliateExecutor: 'PASS',
  executor: 'github-actions',
  reportContract: REPORT_CONTRACT,
  executionContract: EXECUTION_CONTRACT,
  scopes: EXECUTOR_SCOPES,
  arbitraryCommand: false,
  shellInterpolation: false,
  reusesOfficialAuditor: true,
  schedule: true,
  scheduleOwnedBy: 'L2.4F',
  secretsInWorkflow: false,
  productMutationEnabled: false,
}, null, 2));
