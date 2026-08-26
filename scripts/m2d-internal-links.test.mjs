#!/usr/bin/env node

import test from 'node:test';
import assert from 'node:assert/strict';
import { INTERNAL_LINK_RULES, applyRule } from './m2d-internal-links.mjs';

test('regras M2D possuem source e target únicos', () => {
  assert.equal(INTERNAL_LINK_RULES.length, 4);
  assert.equal(new Set(INTERNAL_LINK_RULES.map(rule => rule.source)).size, 4);
  assert.equal(new Set(INTERNAL_LINK_RULES.map(rule => rule.target)).size, 4);
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
