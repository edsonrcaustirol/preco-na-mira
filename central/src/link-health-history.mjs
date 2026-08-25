import {
  LINK_HEALTH_ATTENTION_CLASSIFICATIONS,
  LINK_HEALTH_NON_VERIFIABLE,
  buildCentralLinkHealthReadModel,
  createEmptyCentralLinkHealthReadModel,
} from './link-health.mjs';
import { CENTRAL_HISTORY_CONTRACT } from './history-store.mjs';

const ATTENTION = new Set(LINK_HEALTH_ATTENTION_CLASSIFICATIONS);

function text(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function hex(bytes) {
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function fingerprintAffiliateLink(link) {
  const normalized = text(link);
  if (!normalized) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  return `sha256:${hex(digest)}`;
}

export function describeLinkHealthDelta(previousClassification, currentClassification) {
  const previous = text(previousClassification);
  const current = text(currentClassification);
  if (!current) return 'NOT_AUDITED';
  if (current === LINK_HEALTH_NON_VERIFIABLE) return 'RESULT_NOT_VERIFIABLE';
  if (!previous) return 'NO_COMPARISON_REFERENCE';
  const previousAttention = ATTENTION.has(previous);
  const currentAttention = ATTENTION.has(current);
  if (!previousAttention && currentAttention) return 'ENTERED_ATTENTION';
  if (previousAttention && !currentAttention) return 'LEFT_ATTENTION';
  if (previous === current) return 'SAME_CLASSIFICATION';
  return 'CLASSIFICATION_CHANGED';
}

function runFromRow(row) {
  if (!row) return null;
  return {
    runId: text(row.run_id ?? row.runId),
    scope: text(row.scope),
    sourceSha: text(row.source_sha ?? row.sourceSha),
    finishedAt: text(row.finished_at ?? row.finishedAt),
    status: text(row.status),
  };
}

function resultFromRow(row, delta) {
  return {
    productId: text(row.product_id ?? row.productId),
    classification: text(row.classification),
    auditedLink: text(row.audited_link ?? row.auditedLink),
    reason: text(row.reason),
    checkedAt: text(row.checked_at ?? row.checkedAt),
    runId: text(row.run_id ?? row.runId),
    delta,
  };
}

export async function buildCentralLinkHealthReadModelFromHistory({ products = [], history } = {}) {
  const catalog = Array.isArray(products) ? products : [];
  const coverageBase = { productsTotal: catalog.length, currentResults: 0, staleResults: 0, notAudited: catalog.length };
  if (!history || history.contract !== CENTRAL_HISTORY_CONTRACT || !Array.isArray(history.results)) {
    return createEmptyCentralLinkHealthReadModel({ historyStatus: 'unavailable', coverage: coverageBase });
  }

  const rows = [...history.results];
  const byProduct = new Map();
  for (const row of rows) {
    const productId = text(row.product_id ?? row.productId);
    if (!productId) continue;
    if (!byProduct.has(productId)) byProduct.set(productId, []);
    byProduct.get(productId).push(row);
  }

  const currentResults = [];
  const staleResults = [];
  let notAudited = 0;
  for (const product of catalog) {
    const productId = text(product?.id);
    if (!productId) continue;
    const currentFingerprint = await fingerprintAffiliateLink(product?.linkAfiliado);
    const productRows = byProduct.get(productId) || [];
    if (productRows.length === 0) {
      notAudited += 1;
      continue;
    }
    const matching = currentFingerprint ? productRows.filter(row => text(row.link_fingerprint ?? row.linkFingerprint) === currentFingerprint) : [];
    if (matching.length === 0) {
      const latest = productRows[0];
      staleResults.push({
        productId,
        auditedLink: text(latest.audited_link ?? latest.auditedLink),
        checkedAt: text(latest.checked_at ?? latest.checkedAt),
        runId: text(latest.run_id ?? latest.runId),
        reason: 'Resultado obsoleto: o link atual difere do link auditado.',
      });
      continue;
    }
    const current = matching[0];
    const previous = matching[1] || null;
    currentResults.push(resultFromRow(current, describeLinkHealthDelta(previous?.classification, current.classification)));
  }

  const coverage = {
    productsTotal: catalog.length,
    currentResults: currentResults.length,
    staleResults: staleResults.length,
    notAudited,
  };
  const referenceFull = history.latestHealthyFull || null;
  const fallbackRun = history.recentRuns?.[0] || rows[0] || null;
  const run = referenceFull || fallbackRun;

  if (!run) {
    return createEmptyCentralLinkHealthReadModel({ historyStatus: 'available', referenceFull, coverage, staleResults });
  }
  return buildCentralLinkHealthReadModel({
    run: runFromRow(run),
    results: currentResults,
    historyStatus: 'available',
    referenceFull: runFromRow(referenceFull),
    coverage,
    staleResults,
  });
}
