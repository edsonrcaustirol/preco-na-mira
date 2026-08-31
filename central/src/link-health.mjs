import { CENTRAL_CONTRACTS } from './contracts.mjs';
import { CENTRAL_PRODUCTS_PROJECTION, CENTRAL_PRODUCT_LINK_FINGERPRINTS } from './generated/products.mjs';
import { CENTRAL_AFFILIATE_HISTORY_SNAPSHOT } from './affiliate-history-snapshot.mjs';

export const CENTRAL_LINK_HEALTH_CONTRACT = CENTRAL_CONTRACTS.affiliateIntegrity.centralReadModelContract;
export const AFFILIATE_INTEGRITY_CONTRACT = CENTRAL_CONTRACTS.affiliateIntegrity.contract;
export const LINK_HEALTH_CLASSIFICATIONS = CENTRAL_CONTRACTS.affiliateIntegrity.classifications;
export const LINK_HEALTH_ATTENTION_CLASSIFICATIONS = CENTRAL_CONTRACTS.affiliateIntegrity.attentionClassifications;
export const LINK_HEALTH_NON_VERIFIABLE = CENTRAL_CONTRACTS.affiliateIntegrity.nonVerifiableClassification;

const CLASSIFICATION_SET = new Set(LINK_HEALTH_CLASSIFICATIONS);
const ATTENTION_SET = new Set(LINK_HEALTH_ATTENTION_CLASSIFICATIONS);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function optionalText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function normalizeRun(run) {
  if (!run) return null;
  return {
    runId: optionalText(run.runId ?? run.run_id),
    scope: optionalText(run.scope),
    sourceSha: optionalText(run.sourceSha ?? run.source_sha),
    finishedAt: optionalText(run.finishedAt ?? run.finished_at),
    status: optionalText(run.status),
  };
}

function normalizeResult(result) {
  const classification = String(result?.classification || '').trim();
  if (!CLASSIFICATION_SET.has(classification)) {
    throw new Error(`invalid-link-health-classification:${classification || 'missing'}`);
  }
  const productId = optionalText(result?.productId ?? result?.product_id);
  if (!productId) throw new Error('missing-link-health-product-id');

  return {
    productId,
    classification,
    auditedLink: optionalText(result?.auditedLink ?? result?.audited_link),
    reason: optionalText(result?.reason ?? result?.summary),
    checkedAt: optionalText(result?.checkedAt ?? result?.checked_at),
    runId: optionalText(result?.runId ?? result?.run_id),
    delta: optionalText(result?.delta),
    requiresAttention: ATTENTION_SET.has(classification),
    nonVerifiable: classification === LINK_HEALTH_NON_VERIFIABLE,
  };
}

function summarize(results) {
  const byClassification = Object.fromEntries(LINK_HEALTH_CLASSIFICATIONS.map(state => [state, 0]));
  let attention = 0;
  let nonVerifiable = 0;
  for (const result of results) {
    byClassification[result.classification] += 1;
    if (result.requiresAttention) attention += 1;
    if (result.nonVerifiable) nonVerifiable += 1;
  }
  return {
    total: results.length,
    attention,
    nonVerifiable,
    byClassification,
  };
}

function normalizeCoverage(coverage) {
  if (!coverage) return null;
  return {
    productsTotal: Number(coverage.productsTotal) || 0,
    currentResults: Number(coverage.currentResults) || 0,
    staleResults: Number(coverage.staleResults) || 0,
    notAudited: Number(coverage.notAudited) || 0,
  };
}

function snapshotReadModel(historyStatus) {
  const products = CENTRAL_PRODUCTS_PROJECTION.products || [];
  const rows = new Map((CENTRAL_AFFILIATE_HISTORY_SNAPSHOT.results || []).map(row => [String(row.product_id || ''), row]));
  const currentResults = [];
  const staleResults = [];
  for (const product of products) {
    const row = rows.get(String(product.id || ''));
    if (!row) continue;
    const currentFingerprint = optionalText(CENTRAL_PRODUCT_LINK_FINGERPRINTS?.[product.id]);
    const auditedFingerprint = optionalText(row.link_fingerprint);
    if (currentFingerprint && auditedFingerprint && currentFingerprint === auditedFingerprint) {
      currentResults.push(normalizeResult({ ...row, audited_link: product.linkAfiliado }));
    } else {
      staleResults.push(Object.freeze({
        productId: String(product.id || ''),
        reason: 'O link atual difere do link da última auditoria; o resultado anterior foi invalidado.',
        checkedAt: optionalText(row.checked_at),
        runId: optionalText(row.run_id),
      }));
    }
  }
  const latest = CENTRAL_AFFILIATE_HISTORY_SNAPSHOT.recentRuns?.[0] || CENTRAL_AFFILIATE_HISTORY_SNAPSHOT.latestHealthyFull || null;
  const auditedIds = new Set([...currentResults.map(item => item.productId), ...staleResults.map(item => item.productId)]);
  return deepFreeze({
    contract: CENTRAL_LINK_HEALTH_CONTRACT,
    sourceContract: AFFILIATE_INTEGRITY_CONTRACT,
    availability: latest ? 'available' : 'none',
    defaultView: 'attention',
    historyStatus: latest ? 'snapshot' : historyStatus,
    referenceFull: normalizeRun(CENTRAL_AFFILIATE_HISTORY_SNAPSHOT.latestHealthyFull),
    coverage: normalizeCoverage({
      productsTotal: products.length,
      currentResults: currentResults.length,
      staleResults: staleResults.length,
      notAudited: Math.max(0, products.length - auditedIds.size),
    }),
    run: normalizeRun(latest),
    summary: latest ? summarize(currentResults) : null,
    staleResults,
    results: currentResults,
  });
}

export function createEmptyCentralLinkHealthReadModel({
  historyStatus = 'unbound',
  referenceFull = null,
  coverage = null,
  staleResults = [],
} = {}) {
  if (historyStatus !== 'available' && CENTRAL_AFFILIATE_HISTORY_SNAPSHOT?.latestHealthyFull) {
    return snapshotReadModel(historyStatus);
  }
  return deepFreeze({
    contract: CENTRAL_LINK_HEALTH_CONTRACT,
    sourceContract: AFFILIATE_INTEGRITY_CONTRACT,
    availability: 'none',
    defaultView: 'attention',
    historyStatus,
    referenceFull: normalizeRun(referenceFull),
    coverage: normalizeCoverage(coverage),
    run: null,
    summary: null,
    staleResults: [...staleResults],
    results: [],
  });
}

export function buildCentralLinkHealthReadModel({
  run,
  results = [],
  historyStatus = 'available',
  referenceFull = null,
  coverage = null,
  staleResults = [],
} = {}) {
  if (!Array.isArray(results)) throw new Error('invalid-link-health-results');
  if (!run && results.length === 0) {
    return createEmptyCentralLinkHealthReadModel({ historyStatus, referenceFull, coverage, staleResults });
  }
  if (!run) throw new Error('link-health-run-required');

  const normalizedRun = normalizeRun(run);
  if (!normalizedRun?.runId) throw new Error('link-health-run-id-required');

  const normalizedResults = results.map(normalizeResult);
  return deepFreeze({
    contract: CENTRAL_LINK_HEALTH_CONTRACT,
    sourceContract: AFFILIATE_INTEGRITY_CONTRACT,
    availability: 'available',
    defaultView: 'attention',
    historyStatus,
    referenceFull: normalizeRun(referenceFull),
    coverage: normalizeCoverage(coverage),
    run: normalizedRun,
    summary: summarize(normalizedResults),
    staleResults: [...staleResults],
    results: normalizedResults,
  });
}

export function filterCentralLinkHealthResults(readModel, filter = 'attention') {
  const results = Array.isArray(readModel?.results) ? readModel.results : [];
  if (filter === 'all') return [...results];
  if (filter === 'attention') return results.filter(result => ATTENTION_SET.has(result.classification));
  if (filter === 'non-verifiable') return results.filter(result => result.classification === LINK_HEALTH_NON_VERIFIABLE);
  if (CLASSIFICATION_SET.has(filter)) return results.filter(result => result.classification === filter);
  return [];
}
