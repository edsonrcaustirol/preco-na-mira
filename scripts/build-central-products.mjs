#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CENTRAL_PRODUCTS_CONTRACT,
  CENTRAL_PRODUCTS_SOURCE,
  selectCentralProductFields,
} from '../central/src/products.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CENTRAL_PRODUCTS_OUTPUT = path.join(ROOT, 'central', 'src', 'generated', 'products.mjs');
export const CENTRAL_PRODUCTS_OWNER = path.join(ROOT, CENTRAL_PRODUCTS_SOURCE);

export function parseCanonicalProducts(source) {
  const match = String(source).match(/^const\s+PRODUTOS\s*=\s*(\[[\s\S]*\]);?\s*$/);
  if (!match) throw new Error(`Formato inesperado em ${CENTRAL_PRODUCTS_SOURCE}`);
  const products = JSON.parse(match[1]);
  if (!Array.isArray(products)) throw new Error('Catálogo canônico não é uma lista');
  return products;
}

export function fingerprintAffiliateLink(value) {
  const link = String(value || '').trim();
  return link ? `sha256:${crypto.createHash('sha256').update(link, 'utf8').digest('hex')}` : null;
}

export function buildCentralProductsProjection(source) {
  const canonicalProducts = parseCanonicalProducts(source);
  const products = canonicalProducts.map(product => {
    const selected = selectCentralProductFields(product);
    return { ...selected, linkFingerprint: fingerprintAffiliateLink(selected.linkAfiliado) };
  });
  const ids = products.map(product => String(product.id || ''));
  if (ids.some(id => !id)) throw new Error('Produto sem id no catálogo canônico');
  if (new Set(ids).size !== ids.length) throw new Error('IDs duplicados no catálogo canônico');
  if (products.some(product => !String(product.nome || '').trim())) throw new Error('Produto sem nome no catálogo canônico');
  if (products.some(product => !String(product.linkAfiliado || '').trim())) throw new Error('Produto sem link afiliado no catálogo canônico');
  if (products.some(product => !String(product.linkFingerprint || '').trim())) throw new Error('Produto sem fingerprint do link afiliado');

  return {
    contract: CENTRAL_PRODUCTS_CONTRACT,
    source: CENTRAL_PRODUCTS_SOURCE,
    sourceFingerprint: `sha256:${crypto.createHash('sha256').update(source, 'utf8').digest('hex')}`,
    total: products.length,
    products,
  };
}

export function renderCentralProductsModule(projection) {
  return `// ARQUIVO GERADO — NÃO EDITAR MANUALMENTE.\n// Fonte única: ${CENTRAL_PRODUCTS_SOURCE}\nconst projection = ${JSON.stringify(projection)};\n\nfunction deepFreeze(value) {\n  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;\n  for (const nested of Object.values(value)) deepFreeze(nested);\n  return Object.freeze(value);\n}\n\nexport const CENTRAL_PRODUCTS_PROJECTION = deepFreeze(projection);\n`;
}

export function generateCentralProducts({ sourcePath = CENTRAL_PRODUCTS_OWNER, outputPath = CENTRAL_PRODUCTS_OUTPUT } = {}) {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const projection = buildCentralProductsProjection(source);
  const output = renderCentralProductsModule(projection);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, output, 'utf8');
  return {
    contract: projection.contract,
    source: projection.source,
    sourceFingerprint: projection.sourceFingerprint,
    total: projection.total,
    output: path.relative(ROOT, outputPath).replaceAll('\\', '/'),
    bytes: Buffer.byteLength(output, 'utf8'),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(generateCentralProducts(), null, 2));
}
