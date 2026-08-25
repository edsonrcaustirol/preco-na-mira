import { CENTRAL_CONTRACTS } from './contracts.mjs';

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

export function createEmptyCentralLinkHealthReadModel() {
  return deepFreeze({
    contract: CENTRAL_LINK_HEALTH_CONTRACT,
    sourceContract: AFFILIATE_INTEGRITY_CONTRACT,
    availability: 'none',
    defaultView: 'attention',
    run: null,
    summary: null,
    results: [],
  });
}

export function buildCentralLinkHealthReadModel({ run, results = [] } = {}) {
  if (!Array.isArray(results)) throw new Error('invalid-link-health-results');
  if (!run && results.length === 0) return createEmptyCentralLinkHealthReadModel();
  if (!run) throw new Error('link-health-run-required');

  const normalizedRun = {
    runId: optionalText(run.runId ?? run.run_id),
    scope: optionalText(run.scope),
    sourceSha: optionalText(run.sourceSha ?? run.source_sha),
    finishedAt: optionalText(run.finishedAt ?? run.finished_at),
    status: optionalText(run.status),
  };
  if (!normalizedRun.runId) throw new Error('link-health-run-id-required');

  const normalizedResults = results.map(normalizeResult);
  return deepFreeze({
    contract: CENTRAL_LINK_HEALTH_CONTRACT,
    sourceContract: AFFILIATE_INTEGRITY_CONTRACT,
    availability: 'available',
    defaultView: 'attention',
    run: normalizedRun,
    summary: summarize(normalizedResults),
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
