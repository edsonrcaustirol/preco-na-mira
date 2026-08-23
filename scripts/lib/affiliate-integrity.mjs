import { setTimeout as sleep } from 'node:timers/promises';
import * as base from './affiliate-integrity-base.mjs';

export const CLASSIFICATIONS = base.CLASSIFICATIONS;
export const normalizeText = base.normalizeText;
export const extractStrongAttributes = base.extractStrongAttributes;
export const extractModelCandidates = base.extractModelCandidates;
export const buildExpectedIdentity = base.buildExpectedIdentity;
export const buildObservedIdentity = base.buildObservedIdentity;
export const detectDestinationType = base.detectDestinationType;
export const resolveAffiliateUrl = base.resolveAffiliateUrl;
export const compareResults = base.compareResults;
export const summarize = base.summarize;

function modelFamily(token = '') {
  return base.normalizeText(token).replace(/\d+/g, '').replace(/[^a-z]/g, '');
}

function credibleModelConflict(conflict, resolution) {
  if (!conflict || conflict.type !== 'model') return false;
  const expected = conflict.expected || [];
  const observed = conflict.observed || [];
  const text = base.normalizeText(`${resolution.title || ''} ${resolution.description || ''}`);
  const labeled = [...text.matchAll(/\b(?:modelo|model)\s*[:#-]?\s*([a-z0-9][a-z0-9._/-]{2,})/g)].map(match => match[1]);
  if (observed.some(model => labeled.includes(model))) return true;
  const families = new Set(expected.map(modelFamily).filter(family => family.length >= 3));
  return observed.some(model => families.has(modelFamily(model)));
}

export function classifyProduct(product, resolution) {
  const structural = base.classifyProduct(product, resolution);
  const identityClassifications = new Set([
    CLASSIFICATIONS.CORRETO,
    CLASSIFICATIONS.PROVAVEL,
    CLASSIFICATIONS.DIVERGENTE,
    CLASSIFICATIONS.NAO_COMPROVAVEL,
  ]);
  if (!identityClassifications.has(structural.classification) || resolution.error || resolution.status >= 400) return structural;

  // URL final é evidência de navegação, nunca evidência de identidade.
  const identityOnly = base.classifyProduct(product, { ...resolution, finalUrl: '' });
  identityOnly.destinationType = structural.destinationType;

  if (identityOnly.classification === CLASSIFICATIONS.DIVERGENTE) {
    const conflicts = identityOnly.evidence?.conflicts || [];
    const nonModel = conflicts.filter(conflict => conflict.type !== 'model');
    const model = conflicts.find(conflict => conflict.type === 'model');
    if (!nonModel.length && model && !credibleModelConflict(model, resolution)) {
      identityOnly.evidence.conflicts = [];
      identityOnly.classification = CLASSIFICATIONS.NAO_COMPROVAVEL;
      identityOnly.reason = 'Código alfanumérico observado sem evidência suficiente de que representa um modelo divergente.';
    }
  }
  return identityOnly;
}

export async function auditProduct(product, options = {}) {
  const resolver = options.resolver || resolveAffiliateUrl;
  const checkedAt = new Date().toISOString();
  const resolution = await resolver(product.linkAfiliado, options.network || {});
  const classified = classifyProduct(product, resolution);
  return {
    product_id: product.id,
    nome: product.nome,
    marca: product.marca,
    categoria: product.categoria,
    linkAfiliado: product.linkAfiliado,
    finalUrl: resolution.finalUrl || null,
    redirectChain: resolution.redirectChain || [],
    httpStatus: resolution.status ?? null,
    destinationType: classified.destinationType,
    evidence: classified.evidence,
    classification: classified.classification,
    reason: classified.reason,
    checkedAt,
  };
}

export async function auditProducts(products, options = {}) {
  const concurrency = Math.max(1, Number(options.concurrency || 2));
  const throttleMs = Math.max(0, Number(options.throttleMs ?? 400));
  const results = new Array(products.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= products.length) return;
      results[index] = await auditProduct(products[index], options);
      if (throttleMs) await sleep(throttleMs);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, products.length || 1) }, () => worker()));
  return results;
}
