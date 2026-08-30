#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function escAttr(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
}

function readOwner(root) {
  const file = path.join(root, 'data', 'produtos-index.js');
  const source = fs.readFileSync(file, 'utf8');
  const start = source.indexOf('[');
  const end = source.lastIndexOf(']');
  if (start < 0 || end <= start) throw new Error('owner-invalid');
  const products = JSON.parse(source.slice(start, end + 1));
  if (!Array.isArray(products)) throw new Error('owner-invalid');
  return products;
}

function externalImage(value) {
  const image = String(value ?? '').trim();
  return /^https?:\/\//i.test(image) ? image : '';
}

export function fixExternalProductImageMetadata(root = process.cwd()) {
  const products = readOwner(root);
  let changedPages = 0;
  const fixedProducts = [];

  for (const product of products) {
    const image = externalImage(product?.imagem);
    if (!image) continue;
    const file = path.join(root, `produto-${product.id}.html`);
    if (!fs.existsSync(file)) throw new Error(`product-page-missing:${product.id}`);
    const before = fs.readFileSync(file, 'utf8');
    let after = before;

    after = after.replace(/<script\b[^>]*\bdata-pnm-jsonld=(?:"product"|'product')[^>]*>([\s\S]*?)<\/script>/i, (full, jsonText) => {
      let schema;
      try { schema = JSON.parse(jsonText); }
      catch { throw new Error(`product-schema-invalid:${product.id}`); }
      const graph = Array.isArray(schema?.['@graph']) ? schema['@graph'] : [];
      const productNode = graph.find(node => node?.['@type'] === 'Product');
      if (!productNode) throw new Error(`product-schema-missing:${product.id}`);
      productNode.image = [image];
      const safe = JSON.stringify(schema).replace(/</g, '\\u003c');
      return `<script data-pnm-jsonld="product" type="application/ld+json">${safe}</script>`;
    });

    const escaped = escAttr(image);
    const og = `<meta content="${escaped}" property="og:image"/>`;
    const twitter = `<meta content="${escaped}" name="twitter:image"/>`;
    const ogRe = /<meta\b(?=[^>]*\bproperty=(?:"og:image"|'og:image'))[^>]*>/i;
    const twitterRe = /<meta\b(?=[^>]*\bname=(?:"twitter:image"|'twitter:image'))[^>]*>/i;
    after = ogRe.test(after) ? after.replace(ogRe, og) : after.replace(/<\/head>/i, `${og}</head>`);
    after = twitterRe.test(after) ? after.replace(twitterRe, twitter) : after.replace(/<\/head>/i, `${twitter}</head>`);

    if (after !== before) {
      fs.writeFileSync(file, after);
      changedPages += 1;
    }
    fixedProducts.push(product.id);
  }

  return { contract: 'pnm.external-product-image-metadata/v1', changedPages, fixedProducts };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) console.log(JSON.stringify(fixExternalProductImageMetadata(process.cwd()), null, 2));
