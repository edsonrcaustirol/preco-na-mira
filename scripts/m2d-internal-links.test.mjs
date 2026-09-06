#!/usr/bin/env node

import test from 'node:test';
import assert from 'node:assert/strict';
import { INTERNAL_LINK_RULES, applyPaginationBoundaries, applyRule } from './m2d-internal-links.mjs';

test('regras M2D possuem source e target únicos', () => {
  assert.equal(INTERNAL_LINK_RULES.length, 5);
  assert.equal(new Set(INTERNAL_LINK_RULES.map(rule => rule.source)).size, 5);
  assert.equal(new Set(INTERNAL_LINK_RULES.map(rule => rule.target)).size, 5);
  assert.ok(INTERNAL_LINK_RULES.every(rule => rule.criterion.trim().length > 20));
});

test('applyRule insere exatamente um link quando a evidência estrutural existe', () => {
  const rule = {
    id: 'fixture',
    source: 'fixture.html',
    target: 'destino',
    criterion: 'fixture',
    needle: '<p>origem</p>',
    replacement: '<p>origem</p><a href="destino">Destino</a>',
  };
  const result = applyRule('<main><p>origem</p></main>', rule);
  assert.equal(result.changed, true);
  assert.equal(result.state, 'inserted');
  assert.match(result.html, /href="destino"/);
});

test('applyRule é idempotente quando o link já existe', () => {
  const rule = {
    id: 'fixture',
    source: 'fixture.html',
    target: 'destino',
    criterion: 'fixture',
    needle: '<p>origem</p>',
    replacement: '<p>origem</p><a href="destino">Destino</a>',
  };
  const html = '<main><p>origem</p><a href="destino">Destino</a></main>';
  const result = applyRule(html, rule);
  assert.equal(result.changed, false);
  assert.equal(result.state, 'already-present');
  assert.equal(result.html, html);
});

test('applyRule falha quando a âncora estrutural é ausente ou ambígua', () => {
  const rule = {
    id: 'fixture',
    source: 'fixture.html',
    target: 'destino',
    criterion: 'fixture',
    needle: '<p>origem</p>',
    replacement: '<p>origem</p><a href="destino">Destino</a>',
  };
  assert.throws(() => applyRule('<main></main>', rule), /encontrada 0/);
  assert.throws(() => applyRule('<p>origem</p><p>origem</p>', rule), /encontrada 2/);
});

test('paginação M2D mantém vizinhança e expõe primeira e última páginas', () => {
  const html = '<nav><span class="pnm-seo-pages"><a href="catalogo-pagina-11">11</a><a href="catalogo-pagina-12">12</a><strong aria-current="page">13</strong><a href="catalogo-pagina-14">14</a><a href="catalogo-pagina-15">15</a></span><span class="pnm-seo-page-status">Página 13 de 26</span></nav>';
  const result = applyPaginationBoundaries(html, 'catalogo', 'Catálogo');
  assert.equal(result.changed, true);
  assert.match(result.html, /href="catalogo"[^>]*>1<\/a>/);
  assert.match(result.html, /<strong aria-current="page">13<\/strong>/);
  assert.match(result.html, /href="catalogo-pagina-26"[^>]*>26<\/a>/);
  assert.match(result.html, /href="catalogo-pagina-11"[^>]*>11<\/a>/);
  assert.match(result.html, /href="catalogo-pagina-15"[^>]*>15<\/a>/);
});

test('paginação M2D é idempotente depois de expandida', () => {
  const html = '<nav><span class="pnm-seo-pages"><a href="catalogo" aria-label="Catálogo — página 1">1</a><a href="catalogo-pagina-11" aria-label="Catálogo — página 11">11</a><a href="catalogo-pagina-12" aria-label="Catálogo — página 12">12</a><strong aria-current="page">13</strong><a href="catalogo-pagina-14" aria-label="Catálogo — página 14">14</a><a href="catalogo-pagina-15" aria-label="Catálogo — página 15">15</a><a href="catalogo-pagina-26" aria-label="Catálogo — página 26">26</a></span><span class="pnm-seo-page-status">Página 13 de 26</span></nav>';
  const result = applyPaginationBoundaries(html, 'catalogo', 'Catálogo');
  assert.equal(result.changed, false);
  assert.equal(result.state, 'already-present');
});
