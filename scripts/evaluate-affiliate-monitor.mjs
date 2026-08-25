#!/usr/bin/env node

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MONITOR_CONTRACT = 'pnm.affiliate-integrity-monitor/v1';
export const REPORT_CONTRACT = 'pnm.affiliate-integrity/v1';
export const RUN_STATUSES = Object.freeze(['SUCCESS', 'PARTIAL', 'FAILED']);
export const ATTENTION_CLASSIFICATIONS = Object.freeze([
  'DIVERGENTE',
  'ANÚNCIO_INDISPONÍVEL',
  'DESTINO_GENÉRICO',
  'PROBLEMA_DE_LINK',
]);
export const NON_VERIFIABLE = 'NÃO_COMPROVÁVEL';
export const ARTIFACT_RETENTION_DAYS = 30;
export const D1_RETENTION_POLICY = Object.freeze({ maxAgeDays: 120, keepRecentRuns: 40, preserveLatestHealthyFull: true });

const OFFICIAL_CLASSIFICATIONS = new Set([
  'CORRETO', 'PROVÁVEL', 'DIVERGENTE', 'ANÚNCIO_INDISPONÍVEL',
  'DESTINO_GENÉRICO', 'PROBLEMA_DE_LINK', NON_VERIFIABLE,
]);
const ATTENTION = new Set(ATTENTION_CLASSIFICATIONS);
const EXTERNAL_NON_VERIFIABLE_REASONS = [
  /^Falha externa\/ambiental:/i,
  /^Destino bloqueou ou desafiou a verificação/i,
  /^Falha transitória do destino/i,
  /^Limite de redirects do auditor atingido/i,
];

function text(value) {
  return String(value ?? '').trim();
}

function positiveInteger(value, fallback = 1) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function absolute(relativePath) {
  const resolved = path.resolve(ROOT, relativePath);
  if (!resolved.startsWith(`${ROOT}${path.sep}`)) throw new Error('caminho de artefato inválido');
  return resolved;
}

export function fingerprintLink(link) {
  const normalized = text(link);
  if (!normalized) return null;
  return `sha256:${createHash('sha256').update(normalized, 'utf8').digest('hex')}`;
}

export function isExternalNonVerifiable(result) {
  if (result?.classification !== NON_VERIFIABLE) return false;
  const reason = text(result?.reason);
  return EXTERNAL_NON_VERIFIABLE_REASONS.some(pattern => pattern.test(reason));
}

function validateReport(report) {
  if (!report || report.contract !== REPORT_CONTRACT || !Array.isArray(report.results)) return false;
  if (report.summary?.TOTAL !== undefined && Number(report.summary.TOTAL) !== report.results.length) return false;
  const ids = new Set();
  for (const result of report.results) {
    const id = text(result?.product_id);
    if (!id || ids.has(id) || !OFFICIAL_CLASSIFICATIONS.has(result?.classification)) return false;
    ids.add(id);
  }
  return true;
}

export function evaluateAuditRun(report, { auditOutcome = 'success', scope = 'full' } = {}) {
  const normalizedScope = text(scope || 'full').toLowerCase();
  if (auditOutcome !== 'success') {
    return Object.freeze({ status: 'FAILED', reason: 'AUDITOR_STEP_FAILED', quality: { total: 0, nonVerifiable: 0, externalNonVerifiable: 0, attention: 0 } });
  }
  if (!validateReport(report)) {
    return Object.freeze({ status: 'FAILED', reason: 'REPORT_UNAVAILABLE_OR_INVALID', quality: { total: 0, nonVerifiable: 0, externalNonVerifiable: 0, attention: 0 } });
  }
  if (normalizedScope === 'full' && report.run?.selection?.all !== true) {
    return Object.freeze({ status: 'FAILED', reason: 'FULL_SELECTION_NOT_CONFIRMED', quality: { total: report.results.length, nonVerifiable: 0, externalNonVerifiable: 0, attention: 0 } });
  }

  let nonVerifiable = 0;
  let externalNonVerifiable = 0;
  let attention = 0;
  for (const result of report.results) {
    if (result.classification === NON_VERIFIABLE) nonVerifiable += 1;
    if (isExternalNonVerifiable(result)) externalNonVerifiable += 1;
    if (ATTENTION.has(result.classification)) attention += 1;
  }
  const quality = { total: report.results.length, nonVerifiable, externalNonVerifiable, attention };
  if (externalNonVerifiable > 0) {
    return Object.freeze({ status: 'PARTIAL', reason: 'EXTERNAL_UNVERIFIABLE_PRESENT', quality });
  }
  return Object.freeze({ status: 'SUCCESS', reason: 'COMPLETE_CONTRACT_RESULT_SET', quality });
}

function resultMap(results = []) {
  return new Map(results.map(item => [text(item?.product_id), item]).filter(([id]) => id));
}

export function buildFactualDelta(previousResults = [], currentResults = [], { scope = 'full', selectedProductIds = [] } = {}) {
  const previous = resultMap(previousResults);
  const current = resultMap(currentResults);
  const selected = new Set(selectedProductIds.map(text).filter(Boolean));
  const events = [];

  for (const [productId, item] of current) {
    const before = previous.get(productId);
    if (!before) {
      events.push({ product_id: productId, type: ATTENTION.has(item.classification) ? 'NEW_ATTENTION' : item.classification === NON_VERIFIABLE ? 'RESULT_NOT_VERIFIABLE' : 'NEW_RESULT', from: null, to: item.classification });
      continue;
    }
    if (text(before.linkAfiliado) !== text(item.linkAfiliado)) {
      events.push({ product_id: productId, type: 'LINK_CHANGED_NOT_COMPARABLE', from: before.classification, to: item.classification });
      continue;
    }
    if (item.classification === NON_VERIFIABLE) {
      events.push({ product_id: productId, type: before.classification === NON_VERIFIABLE ? 'STILL_NOT_VERIFIABLE' : 'RESULT_NOT_VERIFIABLE', from: before.classification, to: item.classification });
      continue;
    }
    if (before.classification === NON_VERIFIABLE) {
      events.push({ product_id: productId, type: 'BACK_TO_VERIFIABLE', from: before.classification, to: item.classification });
      continue;
    }
    const wasAttention = ATTENTION.has(before.classification);
    const isAttention = ATTENTION.has(item.classification);
    let type = 'CLASSIFICATION_CHANGED';
    if (!wasAttention && isAttention) type = 'ENTERED_ATTENTION';
    else if (wasAttention && !isAttention) type = 'LEFT_ATTENTION';
    else if (before.classification === item.classification) type = 'SAME_CLASSIFICATION';
    events.push({ product_id: productId, type, from: before.classification, to: item.classification });
  }

  for (const [productId, before] of previous) {
    const comparable = scope === 'full' || selected.has(productId);
    if (comparable && !current.has(productId)) {
      events.push({ product_id: productId, type: 'MISSING_RESULT', from: before.classification, to: null });
    }
  }

  return Object.freeze({
    comparable: previous.size > 0,
    scope,
    events: Object.freeze(events),
  });
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
}

function historyPayload(report, evaluation, env, delta) {
  const runId = text(env.GITHUB_RUN_ID) || 'unknown';
  const runAttempt = positiveInteger(env.GITHUB_RUN_ATTEMPT, 1);
  const scope = text(env.PNM_MONITOR_SCOPE || 'full').toUpperCase();
  const finishedAt = new Date().toISOString();
  const startedAt = report?.run?.startedAt || finishedAt;
  const results = validateReport(report) ? report.results.map(item => ({
    product_id: item.product_id,
    audited_link: item.linkAfiliado || null,
    link_fingerprint: fingerprintLink(item.linkAfiliado),
    classification: item.classification,
    reason: item.reason || null,
    checked_at: item.checkedAt || finishedAt,
    evidence: item.evidence ?? null,
  })) : [];
  const events = (delta?.events || []).map((item, index) => ({
    event_id: `${runId}-${runAttempt}-${index + 1}`,
    product_id: item.product_id,
    event_type: item.type,
    occurred_at: finishedAt,
    previous_state_ref: item.from || null,
    metadata: { from: item.from, to: item.to },
  }));
  return {
    contract: 'pnm.central-history/v1',
    persistence: 'prepared-not-written-by-github-actions',
    run: {
      run_id: `${runId}-${runAttempt}`,
      trigger: text(env.GITHUB_EVENT_NAME) || 'unknown',
      scope,
      source_sha: text(env.GITHUB_SHA) || 'unknown',
      started_at: startedAt,
      finished_at: finishedAt,
      status: evaluation.status,
      totals: report?.summary || {},
      metadata: { monitorContract: MONITOR_CONTRACT, evaluationReason: evaluation.reason },
    },
    results,
    events,
  };
}

export function buildMonitorRecord({ report = null, previousReport = null, env = {} } = {}) {
  const scope = text(env.PNM_MONITOR_SCOPE || 'full').toLowerCase();
  const evaluation = evaluateAuditRun(report, { auditOutcome: text(env.PNM_AUDIT_STEP_OUTCOME || 'success'), scope });
  const delta = previousReport && validateReport(previousReport) && validateReport(report)
    ? buildFactualDelta(previousReport.results, report.results, { scope })
    : { comparable: false, scope, events: [] };
  return {
    contract: MONITOR_CONTRACT,
    reportContract: REPORT_CONTRACT,
    run: {
      id: text(env.GITHUB_RUN_ID) || null,
      attempt: positiveInteger(env.GITHUB_RUN_ATTEMPT, 1),
      event: text(env.GITHUB_EVENT_NAME) || null,
      scope,
      sourceSha: text(env.GITHUB_SHA) || null,
      status: evaluation.status,
      statusReason: evaluation.reason,
    },
    quality: evaluation.quality,
    delta,
    retention: {
      artifactsDays: ARTIFACT_RETENTION_DAYS,
      d1: D1_RETENTION_POLICY,
    },
    remoteHistoryPersisted: false,
  };
}

async function main() {
  const runId = text(process.env.GITHUB_RUN_ID);
  if (!/^\d+$/.test(runId)) throw new Error('GITHUB_RUN_ID inválido');
  const runAttempt = positiveInteger(process.env.GITHUB_RUN_ATTEMPT, 1);
  const dir = path.posix.join('artifacts', 'affiliate-integrity', `run-${runId}-attempt-${runAttempt}`);
  const absDir = absolute(dir);
  await fsp.mkdir(absDir, { recursive: true });
  const report = readJsonIfExists(path.join(absDir, 'report.json'));
  const previousReport = readJsonIfExists(path.join(absDir, 'compare.json'));
  const record = buildMonitorRecord({ report, previousReport, env: process.env });
  const payload = historyPayload(report, evaluateAuditRun(report, {
    auditOutcome: text(process.env.PNM_AUDIT_STEP_OUTCOME || 'success'),
    scope: text(process.env.PNM_MONITOR_SCOPE || 'full'),
  }), process.env, record.delta);
  await Promise.all([
    fsp.writeFile(path.join(absDir, 'monitor.json'), `${JSON.stringify(record, null, 2)}\n`, 'utf8'),
    fsp.writeFile(path.join(absDir, 'history-payload.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8'),
  ]);
  process.stdout.write(`${JSON.stringify(record, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(`affiliate-integrity-monitor: ${error.message}`);
    process.exitCode = 1;
  });
}
