export const CENTRAL_HISTORY_CONTRACT = 'pnm.central-history/v1';
export const HISTORY_RUN_STATUSES = Object.freeze(['SUCCESS', 'PARTIAL', 'FAILED']);
export const HISTORY_CLASSIFICATIONS = Object.freeze([
  'CORRETO', 'PROVÁVEL', 'DIVERGENTE', 'ANÚNCIO_INDISPONÍVEL',
  'DESTINO_GENÉRICO', 'PROBLEMA_DE_LINK', 'NÃO_COMPROVÁVEL',
]);

const STATUS_SET = new Set(HISTORY_RUN_STATUSES);
const CLASSIFICATION_SET = new Set(HISTORY_CLASSIFICATIONS);

function required(value, name) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${name} obrigatório`);
  return text;
}

function optional(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function json(value, fallback = {}) {
  return JSON.stringify(value ?? fallback);
}

function requireDb(db) {
  if (!db || typeof db.prepare !== 'function' || typeof db.batch !== 'function') throw new Error('D1 binding inválido');
  return db;
}

export function normalizeHistoryPayload(payload = {}) {
  const run = payload.run || {};
  const status = required(run.status, 'run.status');
  if (!STATUS_SET.has(status)) throw new Error(`status inválido: ${status}`);
  const scope = required(run.scope, 'run.scope').toUpperCase();
  const normalizedRun = {
    runId: required(run.runId ?? run.run_id, 'run.run_id'),
    trigger: required(run.trigger, 'run.trigger'),
    scope,
    sourceSha: required(run.sourceSha ?? run.source_sha, 'run.source_sha'),
    startedAt: required(run.startedAt ?? run.started_at, 'run.started_at'),
    finishedAt: optional(run.finishedAt ?? run.finished_at),
    status,
    totals: run.totals ?? {},
    metadata: run.metadata ?? {},
  };
  const results = (payload.results || []).map(item => {
    const classification = required(item.classification, 'result.classification');
    if (!CLASSIFICATION_SET.has(classification)) throw new Error(`classificação inválida: ${classification}`);
    return {
      productId: required(item.productId ?? item.product_id, 'result.product_id'),
      auditedLink: optional(item.auditedLink ?? item.audited_link),
      linkFingerprint: required(item.linkFingerprint ?? item.link_fingerprint, 'result.link_fingerprint'),
      classification,
      reason: optional(item.reason ?? item.summary),
      checkedAt: required(item.checkedAt ?? item.checked_at, 'result.checked_at'),
      evidence: item.evidence ?? null,
    };
  });
  const events = (payload.events || []).map(item => ({
    eventId: required(item.eventId ?? item.event_id, 'event.event_id'),
    productId: optional(item.productId ?? item.product_id),
    eventType: required(item.eventType ?? item.event_type, 'event.event_type'),
    occurredAt: required(item.occurredAt ?? item.occurred_at, 'event.occurred_at'),
    previousStateRef: optional(item.previousStateRef ?? item.previous_state_ref),
    metadata: item.metadata ?? {},
  }));
  return Object.freeze({ run: Object.freeze(normalizedRun), results: Object.freeze(results), events: Object.freeze(events) });
}

export async function recordAuditHistory(db, payload) {
  requireDb(db);
  const normalized = normalizeHistoryPayload(payload);
  const { run, results, events } = normalized;
  const statements = [
    db.prepare(`INSERT INTO audit_runs (run_id, trigger, scope, source_sha, started_at, finished_at, status, totals_json, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(run.runId, run.trigger, run.scope, run.sourceSha, run.startedAt, run.finishedAt, run.status, json(run.totals), json(run.metadata)),
    ...results.map(item => db.prepare(`INSERT INTO audit_results
      (run_id, product_id, audited_link, link_fingerprint, classification, reason, checked_at, evidence_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(run.runId, item.productId, item.auditedLink, item.linkFingerprint, item.classification, item.reason, item.checkedAt, item.evidence === null ? null : json(item.evidence))),
    ...events.map(item => db.prepare(`INSERT INTO audit_events
      (event_id, run_id, product_id, event_type, occurred_at, previous_state_ref, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(item.eventId, run.runId, item.productId, item.eventType, item.occurredAt, item.previousStateRef, json(item.metadata))),
  ];
  await db.batch(statements);
  return normalized;
}

async function first(db, sql, binds = []) {
  const statement = db.prepare(sql).bind(...binds);
  if (typeof statement.first === 'function') return statement.first();
  const response = await statement.all();
  return response?.results?.[0] ?? null;
}

function boundedLimit(value, fallback, maximum) {
  return Math.min(maximum, Math.max(1, Number(value) || fallback));
}

export async function readOperationalHistory(db, { productId = null, currentLinkFingerprint = null, runLimit = 20 } = {}) {
  requireDb(db);
  const limit = boundedLimit(runLimit, 20, 100);
  const recentRunsResponse = await db.prepare(`SELECT run_id, trigger, scope, source_sha, started_at, finished_at, status, totals_json, metadata_json
      FROM audit_runs ORDER BY COALESCE(finished_at, started_at) DESC LIMIT ?`).bind(limit).all();
  const latestHealthyFull = await first(db, `SELECT run_id, trigger, scope, source_sha, started_at, finished_at, status, totals_json, metadata_json
      FROM audit_runs WHERE scope = 'FULL' AND status = 'SUCCESS' AND finished_at IS NOT NULL
      ORDER BY finished_at DESC LIMIT 1`);

  let latestProductAny = null;
  let currentProductResult = null;
  if (productId) {
    latestProductAny = await first(db, `SELECT r.run_id, r.product_id, r.audited_link, r.link_fingerprint, r.classification, r.reason, r.checked_at, r.evidence_json,
        u.scope, u.status, u.source_sha
      FROM audit_results r JOIN audit_runs u ON u.run_id = r.run_id
      WHERE r.product_id = ? ORDER BY r.checked_at DESC LIMIT 1`, [productId]);
    if (currentLinkFingerprint) {
      currentProductResult = await first(db, `SELECT r.run_id, r.product_id, r.audited_link, r.link_fingerprint, r.classification, r.reason, r.checked_at, r.evidence_json,
          u.scope, u.status, u.source_sha
        FROM audit_results r JOIN audit_runs u ON u.run_id = r.run_id
        WHERE r.product_id = ? AND r.link_fingerprint = ? ORDER BY r.checked_at DESC LIMIT 1`, [productId, currentLinkFingerprint]);
    }
  }

  return Object.freeze({
    contract: CENTRAL_HISTORY_CONTRACT,
    recentRuns: Object.freeze([...(recentRunsResponse?.results || [])]),
    latestHealthyFull: latestHealthyFull || null,
    latestProductAny: latestProductAny || null,
    currentProductResult: currentProductResult || null,
    currentResultObsolete: Boolean(productId && currentLinkFingerprint && latestProductAny && !currentProductResult),
  });
}

export async function readCentralHealthHistory(db, { runLimit = 20, resultLimit = 5000 } = {}) {
  requireDb(db);
  const runsLimit = boundedLimit(runLimit, 20, 100);
  const resultsLimit = boundedLimit(resultLimit, 5000, 20000);
  const [recentRunsResponse, resultsResponse, latestHealthyFull] = await Promise.all([
    db.prepare(`SELECT run_id, trigger, scope, source_sha, started_at, finished_at, status, totals_json, metadata_json
      FROM audit_runs ORDER BY COALESCE(finished_at, started_at) DESC LIMIT ?`).bind(runsLimit).all(),
    db.prepare(`SELECT r.run_id, r.product_id, r.audited_link, r.link_fingerprint, r.classification, r.reason, r.checked_at, r.evidence_json,
        u.trigger, u.scope, u.status, u.source_sha, u.started_at, u.finished_at
      FROM audit_results r JOIN audit_runs u ON u.run_id = r.run_id
      WHERE u.status IN ('SUCCESS', 'PARTIAL')
      ORDER BY r.checked_at DESC LIMIT ?`).bind(resultsLimit).all(),
    first(db, `SELECT run_id, trigger, scope, source_sha, started_at, finished_at, status, totals_json, metadata_json
      FROM audit_runs WHERE scope = 'FULL' AND status = 'SUCCESS' AND finished_at IS NOT NULL
      ORDER BY finished_at DESC LIMIT 1`),
  ]);

  return Object.freeze({
    contract: CENTRAL_HISTORY_CONTRACT,
    recentRuns: Object.freeze([...(recentRunsResponse?.results || [])]),
    latestHealthyFull: latestHealthyFull || null,
    results: Object.freeze([...(resultsResponse?.results || [])]),
  });
}
