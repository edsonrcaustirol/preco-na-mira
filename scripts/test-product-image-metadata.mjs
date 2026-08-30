#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fixExternalProductImageMetadata } from './fix-product-image-metadata.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pnm-image-meta-'));
try {
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  const external = 'https://cdn.example.test/produto.webp?x=1&y=2';
  const products = [
    { id: 'externo', imagem: external },
    { id: 'local', imagem: 'assets/local.webp' },
  ];
  fs.writeFileSync(path.join(root, 'data', 'produtos-index.js'), `const PRODUTOS = ${JSON.stringify(products)};\n`);
  fs.writeFileSync(path.join(root, 'produto-externo.html'), `<html><head><meta content="https://preconamira.com.br/https://cdn.example.test/produto.webp?x=1&y=2" property="og:image"/><meta content="https://preconamira.com.br/https://cdn.example.test/produto.webp?x=1&y=2" name="twitter:image"/><script data-pnm-jsonld="product" type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': [{ '@type': 'Product', image: ['https://preconamira.com.br/https://cdn.example.test/produto.webp?x=1&y=2'] }] })}</script></head></html>`);
  fs.writeFileSync(path.join(root, 'produto-local.html'), '<html><head></head></html>');

  const result = fixExternalProductImageMetadata(root);
  assert.equal(result.changedPages, 1);
  assert.deepEqual(result.fixedProducts, ['externo']);
  const html = fs.readFileSync(path.join(root, 'produto-externo.html'), 'utf8');
  assert.match(html, /content="https:\/\/cdn\.example\.test\/produto\.webp\?x=1&amp;y=2" property="og:image"/);
  assert.match(html, /content="https:\/\/cdn\.example\.test\/produto\.webp\?x=1&amp;y=2" name="twitter:image"/);
  const schemaMatch = html.match(/data-pnm-jsonld="product"[^>]*>([\s\S]*?)<\/script>/i);
  assert.ok(schemaMatch);
  const schema = JSON.parse(schemaMatch[1]);
  assert.deepEqual(schema['@graph'][0].image, [external]);
  assert.equal(fs.readFileSync(path.join(root, 'produto-local.html'), 'utf8'), '<html><head></head></html>');
  console.log('External product image metadata: OK');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
