#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CENTRAL_CONTRACTS } from '../central/src/contracts.mjs';
import { CENTRAL_HISTORY_CONTRACT, HISTORY_CLASSIFICATIONS, HISTORY_RUN_STATUSES, normalizeHistoryPayload, readOperationalHistory } from '../central/src/history-store.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

class Statement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.binds = []; }
  bind(...values) { this.binds = values; return this; }
  async all() { this.db.calls.push({ sql: this.sql, binds: this.binds }); return { results: this.db.results.shift() || [] }; }
  async first() { this.db.calls.push({ sql: this.sql, binds: this.binds }); return (this.db.results.shift() || [])[0] || null; }
}
class FakeD1 {
  constructor(results) { this.results = [...results]; this.calls = []; }
  prepare(sql) { return new Statement(this, sql); }
  async batch(statements) { this.calls.push({ batch: statements.length }); return statements.map(() => ({ success: true })); }
}

function assertSchema() {
  const sql = read('central/migrations/0001_operational_history.sql');
  for (const table of ['audit_runs', 'audit_results', 'audit_events']) assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  for (const status of HISTORY_RUN_STATUSES) assert.match(sql, new RegExp(`'${status}'`));
  for (const classification of HISTORY_CLASSIFICATIONS) assert.match(sql, new RegExp(`'${classification}'`));
  for (const forbidden of [' nome ', ' descricao ', ' preço ', ' preco ', ' categoria ', ' imagem ', ' marca ']) assert.equal(sql.toLowerCase().includes(forbidden), false, `catálogo paralelo proibido: ${forbidden}`);
  assert.match(sql, /link_fingerprint TEXT NOT NULL/);
  assert.match(sql, /FOREIGN KEY \(run_id\) REFERENCES audit_runs/);
}

function assertPayload() {
  const payload = normalizeHistoryPayload({
    run: { runId: 'run-1', trigger: 'MANUAL', scope: 'full', sourceSha: 'abc', startedAt: '2026-08-25T00:00:00Z', finishedAt: '2026-08-25T00:10:00Z', status: 'SUCCESS' },
    results: [{ productId: 'p1', auditedLink: 'https://example.com', linkFingerprint: 'sha256:x', classification: 'CORRETO', checkedAt: '2026-08-25T00:09:00Z' }],
    events: [{ eventId: 'e1', eventType: 'CLASSIFICATION_RECORDED', occurredAt: '2026-08-25T00:09:00Z' }],
  });
  assert.equal(payload.run.scope, 'FULL');
  assert.equal(payload.results.length, 1);
  assert.throws(() => normalizeHistoryPayload({ run: { runId: 'x', trigger: 'x', scope: 'FULL', sourceSha: 'x', startedAt: 'x', status: 'UNKNOWN' } }), /status inválido/);
  assert.throws(() => normalizeHistoryPayload({ run: { runId: 'x', trigger: 'x', scope: 'FULL', sourceSha: 'x', startedAt: 'x', status: 'SUCCESS' }, results: [{ productId: 'p', linkFingerprint: 'x', classification: 'QUEBRADO', checkedAt: 'x' }] }), /classificação inválida/);
}

async function assertReads() {
  const fake = new FakeD1([
    [{ run_id: 'recent' }],
    [{ run_id: 'healthy-full', scope: 'FULL', status: 'SUCCESS' }],
    [{ run_id: 'old-link', product_id: 'p1', link_fingerprint: 'old' }],
    [],
  ]);
  const snapshot = await readOperationalHistory(fake, { productId: 'p1', currentLinkFingerprint: 'new' });
  assert.equal(snapshot.contract, CENTRAL_HISTORY_CONTRACT);
  assert.equal(snapshot.latestHealthyFull.run_id, 'healthy-full');
  assert.equal(snapshot.latestProductAny.run_id, 'old-link');
  assert.equal(snapshot.currentProductResult, null);
  assert.equal(snapshot.currentResultObsolete, true);
  assert.equal(fake.calls.some(call => /scope = 'FULL' AND status = 'SUCCESS'/.test(call.sql || '')), true);
  assert.equal(fake.calls.some(call => /link_fingerprint = \?/.test(call.sql || '')), true);
}

function assertContracts() {
  assert.equal(CENTRAL_HISTORY_CONTRACT, 'pnm.central-history/v1');
  assert.deepEqual([...HISTORY_RUN_STATUSES], ['SUCCESS', 'PARTIAL', 'FAILED']);
  assert.equal(CENTRAL_CONTRACTS.catalog.owner, 'data/produtos-index.js');
  assert.equal(CENTRAL_CONTRACTS.catalog.centralDatabaseOwner, false);
  assert.equal(CENTRAL_CONTRACTS.d1.authoritativeCatalog, false);
  assert.equal(CENTRAL_CONTRACTS.d1.schemaVersioned, true);
  assert.equal(CENTRAL_CONTRACTS.d1.remoteProvisioned, false);
  const wrangler = JSON.parse(read('central/wrangler.jsonc'));
  assert.equal(Array.isArray(wrangler.d1_databases), true, 'D1 operacional deve estar declarado');
  assert.equal(wrangler.d1_databases.some(entry => entry?.binding === 'PNM_HISTORY_DB'), true, 'binding PNM_HISTORY_DB ausente');
  assert.equal('routes' in wrangler, false);
  assert.equal('triggers' in wrangler, false);
}

function assertGate() {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['test:l2-4d-operational-history'], 'node scripts/test-l2-4d-operational-history.mjs');
  assert.ok(pkg.scripts.check.includes('test:l2-4d-operational-history'));
  assert.ok(pkg.scripts.check.includes('test:l2-4c-affiliate-executor'));
  assert.ok(pkg.scripts.check.includes('test:affiliate-integrity'));
  assert.ok(pkg.scripts.check.includes('test:e2-catalog-operations'));
}

assertSchema();
assertPayload();
await assertReads();
assertContracts();
assertGate();
console.log(JSON.stringify({ l24dOperationalHistory: 'PASS', contract: CENTRAL_HISTORY_CONTRACT, schemaVersioned: true, remoteD1Provisioned: false, secondOwner: false, statuses: HISTORY_RUN_STATUSES }, null, 2));
