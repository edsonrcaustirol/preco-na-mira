import { CENTRAL_CONTRACTS } from './contracts.mjs';

export const CENTRAL_OPERATIONAL_CONTRACT = 'pnm.central-operational/v1';

function text(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function run(row) {
  if (!row) return null;
  return Object.freeze({
    runId: text(row.run_id ?? row.runId),
    trigger: text(row.trigger),
    scope: text(row.scope),
    sourceSha: text(row.source_sha ?? row.sourceSha),
    startedAt: text(row.started_at ?? row.startedAt),
    finishedAt: text(row.finished_at ?? row.finishedAt),
    status: text(row.status),
  });
}

export function buildCentralOperationalReadModel({ projection, history = null, historyStatus = 'unbound', linkHealth = null } = {}) {
  if (!projection || projection.contract !== CENTRAL_CONTRACTS.catalog.projection.contract || !Array.isArray(projection.products)) {
    throw new Error('invalid-central-operational-projection');
  }
  const persistedRuns = Array.isArray(history?.recentRuns) ? history.recentRuns.map(run) : [];
  const snapshotRun = run(linkHealth?.run);
  const recentRuns = persistedRuns.length ? persistedRuns : (snapshotRun ? [snapshotRun] : []);
  const latestHealthyFull = run(history?.latestHealthyFull) || run(linkHealth?.referenceFull);
  const latestRun = recentRuns[0] || null;
  const summary = linkHealth?.summary || null;
  const coverage = linkHealth?.coverage || null;
  const operationalHistoryAvailable = historyStatus === 'available' || linkHealth?.availability === 'available';
  const effectiveHistoryStatus = historyStatus === 'available' ? 'available' : linkHealth?.historyStatus === 'snapshot' ? 'snapshot' : historyStatus;
  return Object.freeze({
    contract: CENTRAL_OPERATIONAL_CONTRACT,
    catalog: Object.freeze({
      contract: projection.contract,
      source: projection.source,
      total: projection.products.length,
      owner: CENTRAL_CONTRACTS.catalog.owner,
      readOnly: true,
    }),
    history: Object.freeze({
      status: effectiveHistoryStatus,
      remoteProvisioned: CENTRAL_CONTRACTS.d1.remoteProvisioned === true,
      latestRun,
      latestHealthyFull,
      recentRuns: Object.freeze(recentRuns),
      resultCount: historyStatus === 'available' && Array.isArray(history?.results)
        ? history.results.length
        : Number.isFinite(coverage?.currentResults) ? coverage.currentResults : null,
      eventCount: historyStatus === 'available' && Array.isArray(history?.events) ? history.events.length : 0,
    }),
    monitor: Object.freeze({
      configured: CENTRAL_CONTRACTS.affiliateIntegrity.executor.scheduled === true,
      schedule: CENTRAL_CONTRACTS.affiliateIntegrity.executor.scheduleCron || null,
      scheduleSemantics: CENTRAL_CONTRACTS.affiliateIntegrity.executor.scheduleSemantics || null,
      concurrency: CENTRAL_CONTRACTS.affiliateIntegrity.executor.concurrency || null,
      observedScheduledRun: operationalHistoryAvailable && recentRuns.some(item => item?.trigger === 'schedule'),
    }),
    health: Object.freeze({
      available: operationalHistoryAvailable && linkHealth?.availability === 'available',
      attention: operationalHistoryAvailable && Number.isFinite(summary?.attention) ? summary.attention : null,
      nonVerifiable: operationalHistoryAvailable && Number.isFinite(summary?.nonVerifiable) ? summary.nonVerifiable : null,
      currentResults: operationalHistoryAvailable && Number.isFinite(coverage?.currentResults) ? coverage.currentResults : null,
      staleResults: operationalHistoryAvailable && Number.isFinite(coverage?.staleResults) ? coverage.staleResults : null,
      notAudited: operationalHistoryAvailable && Number.isFinite(coverage?.notAudited) ? coverage.notAudited : null,
    }),
  });
}

export function productHealthState(productId, linkHealth) {
  const id = text(productId);
  if (!id) return Object.freeze({ state: 'not-audited', classification: null, reason: null, checkedAt: null, runId: null });
  const current = (linkHealth?.results || []).find(item => item.productId === id);
  if (current) return Object.freeze({ state: 'current', classification: current.classification, reason: current.reason || null, checkedAt: current.checkedAt || null, runId: current.runId || null, delta: current.delta || null });
  const stale = (linkHealth?.staleResults || []).find(item => item.productId === id);
  if (stale) return Object.freeze({ state: 'stale', classification: null, reason: stale.reason || 'Resultado obsoleto.', checkedAt: stale.checkedAt || null, runId: stale.runId || null });
  return Object.freeze({ state: 'not-audited', classification: null, reason: null, checkedAt: null, runId: null });
}
