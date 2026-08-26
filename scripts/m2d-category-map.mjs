#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { buildInventory, parseArrayFile } from './seo-inventory.mjs';

const ROOT = process.cwd();

function countBy(values) {
  const counts = {};
  for (const value of values.filter(Boolean)) counts[value] = (counts[value] || 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b, 'pt-BR')));
}

function categoryDataSources(html) {
  return [...html.matchAll(/<script\b[^>]*\bsrc=(?:"([^"]+)"|'([^']+)')[^>]*>/gi)]
    .map(match => match[1] || match[2])
    .map(src => src.split('?')[0].replace(/^\//, ''))
    .filter(src => /^data\/produtos-[^/]+\.js$/i.test(src));
}

function uniqueById(products) {
  return [...new Map(products.map(product => [String(product.id), product])).values()];
}

export function auditCategoryLandings(rootDir = ROOT) {
  const root = path.resolve(rootDir);
  const inventory = buildInventory(root);
  const owner = parseArrayFile(path.join(root, 'data', 'produtos-index.js'));
  const ownerById = new Map(owner.map(product => [String(product.id), product]));
  const rows = [];
  const errors = [];

  for (const page of inventory.pages.filter(page => page.type === 'CATEGORIA')) {
    const html = fs.readFileSync(path.join(root, page.file), 'utf8');
    const sources = [...new Set(categoryDataSources(html))];
    const loaded = [];
    const missingSources = [];

    for (const source of sources) {
      const file = path.join(root, source);
      if (!fs.existsSync(file)) {
        missingSources.push(source);
        continue;
      }
      loaded.push(...parseArrayFile(file));
    }

    const products = uniqueById(loaded);
    const unknownIds = products.map(product => String(product.id)).filter(id => !ownerById.has(id));
    const ownerProducts = products.map(product => ownerById.get(String(product.id))).filter(Boolean);
    const ownerCategories = countBy(ownerProducts.map(product => String(product.categoria || '').trim()));

    if (missingSources.length) errors.push(`${page.path}: fonte(s) ausente(s): ${missingSources.join(', ')}`);
    if (unknownIds.length) errors.push(`${page.path}: ${unknownIds.length} produto(s) não pertencem ao owner.`);
    if (!sources.length) errors.push(`${page.path}: landing de categoria sem fonte data/produtos-*.js observável.`);
    if (!products.length) errors.push(`${page.path}: landing de categoria sem produtos na fonte observável.`);

    rows.push({
      url: page.path,
      file: page.file,
      title: page.title,
      h1: page.h1,
      indexable: page.indexable,
      inSitemap: page.inSitemap,
      inboundInternalLinks: page.inboundInternalLinks,
      outboundInternalLinks: page.outboundInternalLinks.length,
      dataSources: sources,
      products: products.length,
      productsConfirmedInOwner: ownerProducts.length,
      unknownIds,
      ownerCategories,
      exactSingleOwnerCategory: Object.keys(ownerCategories).length === 1 ? Object.keys(ownerCategories)[0] : null,
      taxonomySplit: Object.keys(ownerCategories).length > 1,
    });
  }

  return {
    contract: 'pnm.m2d-category-map/v1',
    source: 'landings CATEGORIA do inventário + data/produtos-*.js referenciado + data/produtos-index.js',
    categories: rows.length,
    rows,
    errors,
  };
}

const report = auditCategoryLandings(process.cwd());
console.log(JSON.stringify(report, null, 2));
if (report.errors.length) process.exitCode = 1;
