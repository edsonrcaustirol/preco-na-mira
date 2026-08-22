import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyHtml, EXACT_CTA } from './audit-related-scope.mjs';

const FUTURE_CTA = 'VER NO MERCADO LIVRE ↗';

function transformRelatedInMemory(html) {
  const positions = classifyHtml(html).exactOccurrences
    .filter((item) => item.related === true)
    .map((item) => item.start)
    .sort((a, b) => b - a);

  let output = html;
  for (const start of positions) {
    output = output.slice(0, start) + FUTURE_CTA + output.slice(start + EXACT_CTA.length);
  }
  return output;
}

test('classifica por estrutura e futura transformação só toca related', () => {
  const fixture = `
    <div class="card"><a href="#card">VER OFERTA ↗</a></div>
    <div class="search"><a href="#search">VER OFERTA ↗</a></div>
    <div class="sticky"><a href="#sticky">VER OFERTA ↗</a></div>
    <div class="primary"><a href="#primary">VER OFERTA ↗</a></div>
    <aside class="sidebar"><a href="#sidebar">VER OFERTA ↗</a></aside>
    <section class="related-products">
      <div class="related-actions"><a href="#analyse">ANALISAR</a><a href="#related"><span>VER OFERTA ↗</span></a></div>
    </section>`;

  const before = classifyHtml(fixture);
  assert.equal(before.ambiguities.length, 0);
  assert.equal(before.exactOccurrences.length, 6);
  assert.equal(before.exactOccurrences.filter((item) => item.related === true).length, 1);
  assert.equal(before.exactOccurrences.filter((item) => item.related === false).length, 5);

  const after = transformRelatedInMemory(fixture);
  assert.equal((after.match(/VER NO MERCADO LIVRE ↗/g) ?? []).length, 1);
  for (const context of ['card', 'search', 'sticky', 'primary']) {
    assert.ok(after.includes(`<div class="${context}"><a href="#${context}">${EXACT_CTA}</a></div>`));
  }
  assert.ok(after.includes(`<aside class="sidebar"><a href="#sidebar">${EXACT_CTA}</a></aside>`));
  assert.match(after, /class="related-actions"[\s\S]*?VER NO MERCADO LIVRE ↗/);
});

test('estrutura related malformada é ambígua', () => {
  const result = classifyHtml('<div class="related-actions"><a>VER OFERTA ↗</a>');
  assert.ok(result.ambiguities.length > 0);
});
