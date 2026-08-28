#!/usr/bin/env node

import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readProducts(file) {
  const source = fs.readFileSync(file, 'utf8');
  const start = source.indexOf('[');
  const end = source.lastIndexOf(']');
  assert(start >= 0 && end > start, `${file}: PRODUTOS inválido.`);
  return JSON.parse(source.slice(start, end + 1));
}

const css = fs.readFileSync('assets/pnm-e1-mobile-critical.css', 'utf8');
const offersHtml = fs.readFileSync('ofertas.html', 'utf8');
const catalogHtml = fs.readFileSync('catalogo.html', 'utf8');
const ownerProducts = readProducts('data/produtos-index.js');
const mobileProducts = readProducts('data/produtos-mobile.js');
const offerProducts = readProducts('data/produtos-ofertas.js');

const offerCards = (offersHtml.match(/data-pnm-product-id=/g) || []).length;
const catalogCards = (catalogHtml.match(/data-pnm-product-id=/g) || []).length;

assert(css.includes('.site-header .nav-links {\n    display: none !important;'), 'E1: estado mobile fechado deixou de ser fail-closed.');
assert(css.includes('.site-header .nav-links.open {\n    display: flex !important;'), 'E1: estado mobile aberto deixou de depender de .open.');
assert(css.includes('body.v15-offers main > section.pnm-reveal'), 'E1.1: Ofertas voltou a depender do reveal no mobile.');
assert(css.includes('body.v15-catalog main > section.pnm-reveal'), 'E1.1: Catálogo voltou a depender do reveal no mobile.');
assert(/body\.v15-offers main > section\.pnm-reveal,[\s\S]*body\.v15-catalog main > section\.pnm-reveal[\s\S]*opacity:\s*1\s*!important;[\s\S]*transform:\s*none\s*!important;/.test(css), 'E1.1: contrato fail-open das listagens mobile incompleto.');

assert(mobileProducts.length === ownerProducts.length, `Catálogo móvel esperado=${ownerProducts.length}, encontrado=${mobileProducts.length}.`);
assert(offerProducts.length === 30, `Payload de Ofertas esperado=30, encontrado=${offerProducts.length}.`);
assert(offerCards === 30, `HTML de Ofertas esperado=30 cards, encontrado=${offerCards}.`);
assert(catalogCards === 24, `HTML inicial do Catálogo esperado=24 cards, encontrado=${catalogCards}.`);
assert(offersHtml.includes('id="offerGrid"'), 'Container #offerGrid ausente.');
assert(catalogHtml.includes('id="catalogGrid"'), 'Container #catalogGrid ausente.');

console.log(JSON.stringify({
  e1NavContract: 'PASS',
  e11MobileListingVisibility: 'PASS',
  offersPayload: offerProducts.length,
  offersHtmlCards: offerCards,
  catalogProducts: mobileProducts.length,
  catalogInitialCards: catalogCards,
}, null, 2));
