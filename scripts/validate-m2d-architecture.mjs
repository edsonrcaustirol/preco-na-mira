#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { analyzeArchitecture } from './m2d-architecture.mjs';
import { INTERNAL_LINK_RULES } from './m2d-internal-links.mjs';

const ROOT = process.cwd();
const report = analyzeArchitecture(ROOT);
const errors = [];

function failWhen(condition, message) {
  if (condition) errors.push(message);
}

function deepestRows(field, limit = 30) {
  return report.graph.rows
    .filter(row => Number.isInteger(row[field]))
    .sort((a, b) => (b[field] - a[field]) || (a.url.localeCompare(b.url, 'pt-BR')))
    .slice(0, limit)
    .map(row => ({
      url: row.url,
      type: row.type,
      depth: row[field],
      inbound: row.inbound,
    }));
}

failWhen(report.summary.p0 !== 0, `P0=${report.summary.p0}; esperado 0.`);
failWhen(report.summary.p1 !== 0, `P1=${report.summary.p1}; esperado 0.`);
failWhen(report.orphanCandidates.length !== 0, `Candidatos a órfãos=${report.orphanCandidates.length}; esperado 0: ${report.orphanCandidates.map(row => row.url).join(', ')}`);
failWhen(report.summary.ownerProducts <= 0, `Owner=${report.summary.ownerProducts}; esperado catálogo não vazio.`);
failWhen(report.summary.products !== report.summary.ownerProducts, `Páginas de produto=${report.summary.products}; esperado owner=${report.summary.ownerProducts}.`);
failWhen(report.summary.categories !== 12, `Categorias observadas=${report.summary.categories}; esperado baseline 12.`);
failWhen(report.summary.journeys !== 13, `Jornadas observadas=${report.summary.journeys}; esperado baseline 13.`);
failWhen(report.internalLinking.brokenLinks.length !== 0, `Links internos quebrados=${report.internalLinking.brokenLinks.length}.`);
failWhen(report.internalLinking.wrongHostLinks.length !== 0, `Links internos em host errado=${report.internalLinking.wrongHostLinks.length}.`);
failWhen(report.internalLinking.emptyAnchors.length !== 0, `Âncoras internas vazias=${report.internalLinking.emptyAnchors.length}.`);
failWhen(report.internalLinking.categoryToProduct.membershipViolations.length !== 0, `Violações categoria→produto=${report.internalLinking.categoryToProduct.membershipViolations.length}.`);
failWhen(report.internalLinking.productToCategory.missing.length !== 0, `Produtos elegíveis sem link para categoria factual=${report.internalLinking.productToCategory.missing.length}: ${report.internalLinking.productToCategory.missing.map(row => `${row.url} → ${row.categoryRoute}`).join(', ')}`);
failWhen(report.facetedNavigation.sitemapHasParameters, 'Sitemap contém URL com parâmetros.');
failWhen(report.related.productPages !== report.summary.ownerProducts, `Escopo related M2D=${report.related.productPages}; esperado owner=${report.summary.ownerProducts} páginas de produto.`);

for (const rule of INTERNAL_LINK_RULES) {
  const file = path.join(ROOT, rule.source);
  if (!fs.existsSync(file)) {
    errors.push(`${rule.id}: source ausente após build (${rule.source}).`);
    continue;
  }
  const html = fs.readFileSync(file, 'utf8');
  const escaped = rule.target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\bhref=(?:"/?${escaped}"|'/?${escaped}')`, 'i');
  if (!pattern.test(html)) errors.push(`${rule.id}: link factual para /${rule.target} ausente após build.`);
}

const result = {
  m2dArchitecture: errors.length ? 'FAIL' : 'PASS',
  contract: report.contract,
  totalUrls: report.summary.totalUrls,
  indexable: report.summary.indexable,
  p0: report.summary.p0,
  p1: report.summary.p1,
  p2: report.summary.p2,
  p3: report.summary.p3,
  orphanCandidates: report.orphanCandidates.map(row => row.url),
  categories: report.summary.categories,
  journeys: report.summary.journeys,
  products: report.summary.products,
  ownerProducts: report.summary.ownerProducts,
  graph: {
    maxDepthFromHome: report.graph.maxDepthFromHome,
    maxDepthFromHubs: report.graph.maxDepthFromHubs,
    deepestFromHome: deepestRows('fromHome'),
    deepestFromHubs: deepestRows('fromHub'),
  },
  productToCategory: {
    eligible: report.internalLinking.productToCategory.eligible,
    linked: report.internalLinking.productToCategory.linked,
    missing: report.internalLinking.productToCategory.missing.length,
    missingDetails: report.internalLinking.productToCategory.missing,
  },
  brokenLinks: report.internalLinking.brokenLinks.length,
  wrongHostLinks: report.internalLinking.wrongHostLinks.length,
  emptyAnchors: report.internalLinking.emptyAnchors.length,
  categoryMembershipViolations: report.internalLinking.categoryToProduct.membershipViolations.length,
  sitemapHasParameters: report.facetedNavigation.sitemapHasParameters,
  internalLinkRules: INTERNAL_LINK_RULES.map(rule => ({ id: rule.id, source: rule.source, target: `/${rule.target}` })),
  errors,
};

console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;
