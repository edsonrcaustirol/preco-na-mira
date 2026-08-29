#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeNewProductInput } from '../central/src/new-product.mjs';
import { synchronizeCatalog } from './sincronizar-catalogo.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OWNER_RELATIVE = 'data/produtos-index.js';

function text(value) { return String(value ?? '').trim(); }

export function readOwnerProducts(root = ROOT) {
  const file = path.join(root, OWNER_RELATIVE);
  const source = fs.readFileSync(file, 'utf8');
  const start = source.indexOf('[');
  const end = source.lastIndexOf(']');
  if (start < 0 || end <= start) throw new Error('owner-invalid');
  const products = JSON.parse(source.slice(start, end + 1));
  if (!Array.isArray(products)) throw new Error('owner-invalid');
  return { file, source, start, end, products };
}

function replaceOwnerArray(snapshot, products) {
  return `${snapshot.source.slice(0, snapshot.start)}${JSON.stringify(products)}${snapshot.source.slice(snapshot.end + 1)}`;
}

function atomicWrite(file, content) {
  const temp = `${file}.o3-${process.pid}-${Math.random().toString(16).slice(2)}`;
  fs.writeFileSync(temp, content);
  fs.renameSync(temp, file);
}

function normalizeInput(input = {}) {
  const keys = ['id', 'nome', 'marca', 'categoria', 'imagem', 'imagemAlt', 'linkAfiliado', 'loja', 'resumo', 'selo', 'oferta', 'destaque'];
  return Object.fromEntries(keys.filter(key => input[key] !== undefined).map(key => [key, input[key]]));
}

export function applyNewProductTransaction(root = ROOT, input = {}, options = {}) {
  const snapshot = readOwnerProducts(root);
  const normalized = normalizeInput(input);
  const analysis = analyzeNewProductInput(normalized, snapshot.products);
  if (!analysis.canAdvance) {
    const error = new Error(analysis.state === 'DUPLICADO' ? 'duplicate-product' : analysis.pending.length ? 'blocked-by-data' : 'new-product-blocked');
    error.code = analysis.state === 'DUPLICADO' ? 'DUPLICATE_PRODUCT' : analysis.pending.length ? 'BLOQUEADO_POR_DADO' : 'NEW_PRODUCT_BLOCKED';
    throw error;
  }
  const id = text(analysis.previewRecord.id);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    const error = new Error('unsafe-product-id');
    error.code = 'UNSAFE_ID';
    throw error;
  }
  const record = { ...analysis.previewRecord, loja: analysis.previewRecord.loja || 'Mercado Livre' };
  const nextProducts = [...snapshot.products, record];
  const nextSource = replaceOwnerArray(snapshot, nextProducts);
  const ownerFile = snapshot.file;
  let ownerWritten = false;

  try {
    atomicWrite(ownerFile, nextSource);
    ownerWritten = true;
    if (options.failBeforeSync) throw new Error('Falha transacional O3 simulada antes do sync.');
    const sync = synchronizeCatalog(root, options.syncOptions || {});
    const page = path.join(root, `produto-${id}.html`);
    const mobile = path.join(root, 'data', 'produtos-mobile.js');
    if (!fs.existsSync(page)) throw new Error('derived-product-page-missing');
    if (!fs.existsSync(mobile)) throw new Error('derived-mobile-missing');
    const finalOwner = readOwnerProducts(root).products;
    if (finalOwner.length !== snapshot.products.length + 1 || finalOwner.at(-1)?.id !== id) throw new Error('owner-postcondition-failed');
    return {
      contract: 'pnm.central-new-product-transaction/v1',
      state: 'PREPARADO',
      productId: id,
      ownerBefore: snapshot.products.length,
      ownerAfter: finalOwner.length,
      mobileAfter: sync.mobile,
      pagesAfter: sync.pages,
      changedScope: [OWNER_RELATIVE, 'data/produtos-mobile.js', `produto-${id}.html`],
      directMainPushAllowed: false,
      automaticMergeAllowed: false,
    };
  } catch (error) {
    if (ownerWritten) {
      try { atomicWrite(ownerFile, snapshot.source); } catch {}
      try { synchronizeCatalog(root); } catch {}
    }
    throw error;
  }
}

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const payloadB64 = arg('--payload-b64') || process.env.PNM_O3_PAYLOAD_B64;
  if (!payloadB64) throw new Error('payload-required');
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8'));
  const result = applyNewProductTransaction(process.cwd(), payload);
  console.log(JSON.stringify(result, null, 2));
}
