#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED_FIELDS = ['id','nome','marca','categoria','imagem','imagemAlt','linkAfiliado','loja','resumo'];
export const MOBILE_FIELDS = ['id','nome','marca','categoria','categoriaId','tipoProduto','imagem','imagemFallback','imagemAlt','imagemTipo','linkAfiliado','oferta','destaque','faixa','selo','chamada','resumo','subtipo','subtipoCasa','subtipoCozinha','subtipoLavanderia','subtipoGamer','subtipoAcessorio','subtipoObra','subtipoInstalacao','subtipoAcabamento','porteEspaco'];
const ORIGIN = 'https://preconamira.com.br';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

function parseOwner(root) {
  const file = path.join(root, 'data', 'produtos-index.js');
  if (!fs.existsSync(file)) throw new Error(`Owner ausente: ${file}`);
  const source = fs.readFileSync(file, 'utf8');
  const start = source.indexOf('[');
  const end = source.lastIndexOf(']');
  if (start < 0 || end <= start) throw new Error('Owner inválido.');
  const products = JSON.parse(source.slice(start, end + 1));
  if (!Array.isArray(products)) throw new Error('Owner não contém array.');
  return products;
}

function validateProducts(products) {
  const ids = new Set();
  const links = new Set();
  for (const [index, product] of products.entries()) {
    const missing = REQUIRED_FIELDS.filter(field => !String(product?.[field] ?? '').trim());
    if (missing.length) throw new Error(`Produto incompleto em ${index}: ${missing.join(', ')}`);
    const id = String(product.id).trim();
    const link = String(product.linkAfiliado).trim();
    if (ids.has(id)) throw new Error(`ID duplicado: ${id}`);
    if (links.has(link)) throw new Error(`Link afiliado duplicado: ${link}`);
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error(`ID inválido: ${id}`);
    ids.add(id);
    links.add(link);
  }
}

function projectMobile(products) {
  return products.map(product => Object.fromEntries(
    MOBILE_FIELDS.filter(field => product[field] !== undefined).map(field => [field, product[field]])
  ));
}

function description(product) {
  const raw = `${product.nome}. ${product.resumo || product.chamada || product.categoria}`.replace(/\s+/g, ' ').trim();
  return raw.length > 155 ? `${raw.slice(0, 152).trimEnd()}…` : raw;
}

function productSchema(product) {
  const canonical = `${ORIGIN}/produto-${product.id}`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        '@id': `${canonical}#product`,
        name: product.nome,
        description: description(product),
        image: [`${ORIGIN}/${String(product.imagem).replace(/^\/+/, '')}`],
        brand: { '@type': 'Brand', name: product.marca },
        category: product.categoria,
        additionalProperty: [],
        url: canonical,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Preço na Mira', item: `${ORIGIN}/` },
          { '@type': 'ListItem', position: 2, name: 'Catálogo', item: `${ORIGIN}/catalogo` },
          { '@type': 'ListItem', position: 3, name: product.nome, item: canonical },
        ],
      },
    ],
  };
}

function renderProductPage(product) {
  const canonical = `${ORIGIN}/produto-${product.id}`;
  const desc = description(product);
  const schema = JSON.stringify(productSchema(product)).replace(/</g, '\\u003c');
  const type = esc(product.tipoProduto || '');
  const callout = esc(product.chamada || product.resumo);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<script src="assets/pnm-foundation-runtime.js"></script>
<meta charset="utf-8"/>
<meta content="width=device-width,initial-scale=1" name="viewport"/>
<meta content="index,follow,max-image-preview:large" name="robots"/>
<title>${esc(product.nome)} — Preço na Mira</title>
<meta content="${esc(desc)}" name="description"/>
<link rel="canonical" href="${canonical}"/>
<meta content="product" property="og:type"/>
<meta property="og:site_name" content="Preço na Mira"/>
<meta content="${esc(product.nome)} — Preço na Mira" property="og:title"/>
<meta content="${esc(desc)}" property="og:description"/>
<meta property="og:url" content="${canonical}"/>
<meta content="${ORIGIN}/${esc(String(product.imagem).replace(/^\/+/, ''))}" property="og:image"/>
<meta content="${esc(product.imagemAlt)}" property="og:image:alt"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta content="${esc(product.nome)} — Preço na Mira" name="twitter:title"/>
<meta content="${esc(desc)}" name="twitter:description"/>
<meta content="${ORIGIN}/${esc(String(product.imagem).replace(/^\/+/, ''))}" name="twitter:image"/>
<meta content="#070914" name="theme-color"/>
<link href="assets/favicon-pnm.png" rel="icon" type="image/png"/>
<link href="assets/pnm-core.css" rel="stylesheet"/>
<link href="assets/pnm-layer-product.css" rel="stylesheet"/>
<script data-pnm-jsonld="product" type="application/ld+json">${schema}</script>
<link rel="stylesheet" href="assets/pnm-platform-v18.css"/>
<script defer src="assets/pnm-platform-v18.js"></script>
</head>
<body data-compare-url="comparativo-geral" data-product-id="${esc(product.id)}" data-product-type="${type}">
<div class="topbar">Conteúdo independente • Alguns links podem gerar comissão de afiliado, sem custo extra para você.</div>
<header class="site-header"><div class="container nav"><a aria-label="Preço na Mira — página inicial" class="brand" href="/"><img alt="Preço na Mira" decoding="async" height="256" loading="eager" src="assets/logo-pnm-header.png" width="256"/></a><nav class="nav-links" id="nav"><a href="universos">Universos</a><a href="ofertas">Ofertas</a><a href="catalogo">Catálogo</a><a href="montar">Projetos</a><a href="minha-lista">Salvos</a></nav><button aria-expanded="false" aria-label="Abrir menu" class="menu-btn" id="menu" type="button">☰</button></div></header>
<main>
<section class="product-hero"><div class="container"><a class="back" href="catalogo">← Voltar ao catálogo</a><div class="product-detail">
<div class="product-detail-media official-product-media"><img alt="${esc(product.imagemAlt)}" data-fallback-src="${esc(product.imagemFallback || 'assets/product-photo-unavailable.svg')}" decoding="async" loading="eager" src="${esc(product.imagem)}" data-pnm-product-id="${esc(product.id)}"/><div class="official-media-meta"><span>Foto do produto</span></div></div>
<div class="product-detail-copy"><div class="eyeline">${esc(product.marca)} • ${esc(product.categoria)}</div><h1>${esc(product.nome)}</h1><p class="lead">${callout}</p>
<a class="affiliate-btn pnm-ml-cta" href="${esc(product.linkAfiliado)}" rel="sponsored nofollow noopener noreferrer" target="_blank"><span class="pnm-ml-copy"><small>MERCADO LIVRE</small><strong>VER OFERTA ATUAL ↗</strong></span></a>
<div class="affiliate-note">Link de afiliado: podemos receber comissão sem custo adicional para você.</div></div></div></div></section>
<section class="section"><div class="container"><div class="detail-grid"><article class="content-card"><h2>Resumo</h2><p>${esc(product.resumo)}</p><div class="notice"><strong>Antes de comprar:</strong> confira preço, estoque, variante, garantia e condições do anúncio no Mercado Livre.</div></article>
<aside class="side-card"><h3>Resumo rápido</h3><div class="side-list"><div class="side-item"><strong>Marca</strong>${esc(product.marca)}</div><div class="side-item"><strong>Categoria</strong>${esc(product.categoria)}</div><div class="side-item"><strong>Loja</strong>${esc(product.loja)}</div></div><a class="affiliate-btn" href="${esc(product.linkAfiliado)}" rel="sponsored nofollow noopener noreferrer" target="_blank">VER NO MERCADO LIVRE →</a></aside></div></div></section>
</main>
<div class="sticky-offer" id="sticky"><a href="${esc(product.linkAfiliado)}" rel="sponsored nofollow noopener noreferrer" target="_blank">VER PREÇO ATUAL →</a></div>
<footer class="footer"><div class="container footer-grid"><div><img alt="Preço na Mira" decoding="async" height="360" loading="lazy" src="assets/logo-pnm-footer.webp" width="360"/><p>Compare, entenda e monte antes da oferta.</p></div><div><strong>Transparência</strong><p>Preço, estoque, instalação e compatibilidade devem ser confirmados na loja/fabricante.</p></div></div></footer>
<script src="assets/comparador.js"></script><script src="assets/core.js"></script><script src="assets/product-static.js"></script><script src="assets/pnm-runtime.js"></script><script src="assets/pnm-accessibility.js"></script><script src="assets/pnm-real-product-images.js"></script>
</body></html>
`;
}

function replaceMeta(html, re, replacement) {
  return re.test(html) ? html.replace(re, replacement) : html.replace(/<\/head>/i, `${replacement}</head>`);
}

function syncExistingPage(html, product) {
  const canonical = `${ORIGIN}/produto-${product.id}`;
  const desc = description(product);
  const schemaTag = `<script data-pnm-jsonld="product" type="application/ld+json">${JSON.stringify(productSchema(product)).replace(/</g, '\\u003c')}</script>`;
  let next = html;

  next = next.replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/i, `<h1>${esc(product.nome)}</h1>`);
  next = next.replace(/<body\b([^>]*)>/i, (full, attrs) => {
    let updated = attrs;
    if (/\bdata-product-id=(?:"[^"]*"|'[^']*')/i.test(updated)) {
      updated = updated.replace(/\bdata-product-id=(?:"[^"]*"|'[^']*')/i, `data-product-id="${esc(product.id)}"`);
    } else updated += ` data-product-id="${esc(product.id)}"`;
    if (/\bdata-product-type=(?:"[^"]*"|'[^']*')/i.test(updated)) {
      updated = updated.replace(/\bdata-product-type=(?:"[^"]*"|'[^']*')/i, `data-product-type="${esc(product.tipoProduto || '')}"`);
    }
    return `<body${updated}>`;
  });

  next = next.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, `<title>${esc(product.nome)} — Preço na Mira</title>`);
  next = replaceMeta(next, /<meta\b(?=[^>]*\bname=(?:"description"|'description'))[^>]*>/i, `<meta content="${esc(desc)}" name="description"/>`);
  next = replaceMeta(next, /<link\b(?=[^>]*\brel=(?:"canonical"|'canonical'))[^>]*>/i, `<link rel="canonical" href="${canonical}"/>`);

  const schemaRe = /<script\b[^>]*\bdata-pnm-jsonld=(?:"product"|'product')[^>]*>[\s\S]*?<\/script>/i;
  next = schemaRe.test(next) ? next.replace(schemaRe, schemaTag) : next.replace(/<\/head>/i, `${schemaTag}</head>`);

  const escapedId = product.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const imageRe = new RegExp(`<img\\b([^>]*\\bdata-pnm-product-id=(?:"${escapedId}"|'${escapedId}')[^>]*)>`, 'i');
  next = next.replace(imageRe, (full, attrs) => {
    let updated = attrs;
    const setAttr = (name, value) => {
      const attrRe = new RegExp(`\\b${name}=(?:"[^"]*"|'[^']*')`, 'i');
      if (attrRe.test(updated)) updated = updated.replace(attrRe, `${name}="${esc(value)}"`);
      else updated += ` ${name}="${esc(value)}"`;
    };
    setAttr('src', product.imagem);
    setAttr('alt', product.imagemAlt);
    setAttr('data-fallback-src', product.imagemFallback || 'assets/product-photo-unavailable.svg');
    return `<img${updated}>`;
  });

  const primaryLinkRe = /<a\b([^>]*\bclass=(?:"[^"]*\bpnm-ml-cta\b[^"]*"|'[^']*\bpnm-ml-cta\b[^']*')[^>]*)>/i;
  const fallbackLinkRe = /<a\b([^>]*\bclass=(?:"[^"]*\baffiliate-btn\b[^"]*"|'[^']*\baffiliate-btn\b[^']*')[^>]*)>/i;
  const linkMatch = next.match(primaryLinkRe) || next.match(fallbackLinkRe);
  if (linkMatch) {
    const oldHref = (linkMatch[1].match(/\bhref=(?:"([^"]*)"|'([^']*)')/i) || []).slice(1).find(Boolean);
    if (oldHref && oldHref !== product.linkAfiliado) next = next.split(oldHref).join(product.linkAfiliado);
  } else {
    next = next.replace(/(<h1\b[^>]*>[\s\S]*?<\/h1>)/i, `$1<a class="affiliate-btn pnm-ml-cta" href="${esc(product.linkAfiliado)}" rel="sponsored nofollow noopener noreferrer" target="_blank">VER NO MERCADO LIVRE →</a>`);
  }

  return next;
}

function buildOperations(root, products) {
  const operations = [];
  const mobilePath = path.join(root, 'data', 'produtos-mobile.js');
  const mobileContent = `const PRODUTOS = ${JSON.stringify(projectMobile(products))};\n`;
  if (!fs.existsSync(mobilePath) || fs.readFileSync(mobilePath, 'utf8') !== mobileContent) operations.push({ type: 'write', file: mobilePath, content: mobileContent });

  const desired = new Set(products.map(product => `produto-${product.id}.html`));
  const existing = fs.readdirSync(root).filter(name => /^produto-.+\.html$/i.test(name) && name !== 'produto.html');

  for (const product of products) {
    const name = `produto-${product.id}.html`;
    const file = path.join(root, name);
    const previous = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    const content = previous === null ? renderProductPage(product) : syncExistingPage(previous, product);
    if (previous !== content) operations.push({ type: 'write', file, content });
  }

  for (const name of existing) {
    if (!desired.has(name)) operations.push({ type: 'delete', file: path.join(root, name) });
  }
  return operations;
}

function applyTransactional(operations, { failAfter = null } = {}) {
  const backups = new Map();
  const temps = [];
  let applied = 0;
  try {
    for (const operation of operations) {
      backups.set(operation.file, fs.existsSync(operation.file) ? fs.readFileSync(operation.file) : null);
      if (operation.type === 'write') {
        fs.mkdirSync(path.dirname(operation.file), { recursive: true });
        const temp = `${operation.file}.pnm-sync-${process.pid}-${Math.random().toString(16).slice(2)}`;
        fs.writeFileSync(temp, operation.content);
        temps.push([temp, operation.file]);
      }
    }

    for (const [temp, file] of temps) {
      fs.renameSync(temp, file);
      applied += 1;
      if (failAfter !== null && applied >= failAfter) throw new Error('Falha transacional simulada.');
    }
    for (const operation of operations.filter(item => item.type === 'delete')) {
      if (fs.existsSync(operation.file)) fs.unlinkSync(operation.file);
      applied += 1;
      if (failAfter !== null && applied >= failAfter) throw new Error('Falha transacional simulada.');
    }
  } catch (error) {
    for (const [file, previous] of backups.entries()) {
      try {
        if (previous === null) fs.rmSync(file, { force: true });
        else fs.writeFileSync(file, previous);
      } catch {}
    }
    for (const [temp] of temps) fs.rmSync(temp, { force: true });
    throw error;
  }
}

export function synchronizeCatalog(root = process.cwd(), options = {}) {
  const products = parseOwner(root);
  validateProducts(products);
  const operations = buildOperations(root, products);
  applyTransactional(operations, options);
  const pages = fs.readdirSync(root).filter(name => /^produto-.+\.html$/i.test(name) && name !== 'produto.html').length;
  return { owner: products.length, mobile: products.length, pages, operations: operations.length };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = synchronizeCatalog(process.cwd());
  console.log(JSON.stringify({ catalogSync: 'PASS', ownerUnique: true, derivativesAutomatic: true, ...result }, null, 2));
}
