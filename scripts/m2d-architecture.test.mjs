#!/usr/bin/env node

import test from 'node:test';
import assert from 'node:assert/strict';
import { computeDepth, inspectAnchors, normalizeInternalRoute, slugify } from './m2d-architecture.mjs';

test('slugify preserva regra determinística para categoria canônica', () => {
  assert.equal(slugify('Áudio e Vídeo'), 'audio-e-video');
  assert.equal(slugify('Casa & Cozinha'), 'casa-cozinha');
});

test('normalizeInternalRoute remove extensão, query e fragmento sem aceitar host externo', () => {
  assert.equal(normalizeInternalRoute('/catalogo.html?marca=x#topo'), '/catalogo');
  assert.equal(normalizeInternalRoute('https://preconamira.com.br/produto-x.html?utm=1'), '/produto-x');
  assert.equal(normalizeInternalRoute('https://example.com/produto-x.html'), null);
});

test('computeDepth calcula menor profundidade e preserva inalcançáveis', () => {
  const graph = new Map([
    ['/', ['/catalogo', '/categoria']],
    ['/catalogo', ['/produto-a']],
    ['/categoria', ['/produto-a']],
    ['/produto-a', []],
    ['/isolada', []],
  ]);
  const depth = computeDepth(graph, ['/']);
  assert.equal(depth.get('/'), 0);
  assert.equal(depth.get('/catalogo'), 1);
  assert.equal(depth.get('/produto-a'), 2);
  assert.equal(depth.has('/isolada'), false);
});

test('inspectAnchors detecta quebrado, self-link, âncora vazia, host errado e query', () => {
  const known = new Set(['/', '/catalogo', '/produto-a']);
  const html = `
    <a href="/catalogo">Catálogo</a>
    <a href="/produto-a?ref=teste">Produto</a>
    <a href="/ausente">Ausente</a>
    <a href="/produto-a">Mesmo</a>
    <a href="/catalogo"><span></span></a>
    <a href="https://www.preconamira.com.br/catalogo">Host errado</a>
  `;
  const result = inspectAnchors(html, '/produto-a', known);
  assert.deepEqual(result.broken, [{ href: '/ausente', route: '/ausente' }]);
  assert.ok(result.selfLinks.includes('/produto-a?ref=teste'));
  assert.ok(result.selfLinks.includes('/produto-a'));
  assert.ok(result.emptyAnchors.includes('/catalogo'));
  assert.ok(result.wrongHostLinks.includes('https://www.preconamira.com.br/catalogo'));
  assert.ok(result.queryInternalLinks.includes('/produto-a?ref=teste'));
});
