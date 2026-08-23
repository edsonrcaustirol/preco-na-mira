import assert from 'node:assert/strict';
import test from 'node:test';
import { auditFailures, classifyHtml, CURRENT_CTA, EXACT_CTA, postAuditFailures } from './audit-related-scope.mjs';

const FUTURE_CTA = CURRENT_CTA;

function transformRelatedInMemory(html) {
  const result = classifyHtml(html);
  assert.equal(result.ambiguities.length, 0, 'fixture de transformação deve ser estruturalmente inequívoca');
  const positions = result.exactOccurrences
    .filter((item) => item.related === true)
    .map((item) => item.start)
    .sort((a, b) => b - a);

  let output = html;
  for (const start of positions) {
    output = output.slice(0, start) + FUTURE_CTA + output.slice(start + EXACT_CTA.length);
  }
  return output;
}

function counts(result) {
  return {
    exactTotal: result.exactOccurrences.length,
    relatedTotal: result.exactOccurrences.filter((item) => item.related === true).length,
    outsideTotal: result.exactOccurrences.filter((item) => item.related === false).length,
  };
}

test('comentário HTML não conta como CTA comercial', () => {
  const result = classifyHtml('<div class="related-actions"><a><!-- VER OFERTA ↗ --></a></div>');
  assert.equal(result.ambiguities.length, 0);
  assert.equal(result.exactOccurrences.length, 0);
});

test('script não conta como CTA comercial', () => {
  const result = classifyHtml(`<div class="related-actions"><a><script>const texto = 'VER OFERTA ↗';</script></a></div>`);
  assert.equal(result.ambiguities.length, 0);
  assert.equal(result.exactOccurrences.length, 0);
});

test('style não conta como CTA comercial', () => {
  const result = classifyHtml('<div class="related-actions"><a><style>/* VER OFERTA ↗ */</style></a></div>');
  assert.equal(result.ambiguities.length, 0);
  assert.equal(result.exactOccurrences.length, 0);
});

test('CTA real em related conta exatamente uma ocorrência related', () => {
  const result = classifyHtml('<div class="related-actions"><a>VER OFERTA ↗</a></div>');
  assert.equal(result.ambiguities.length, 0);
  assert.deepEqual(counts(result), { exactTotal: 1, relatedTotal: 1, outsideTotal: 0 });
});

test('CTA real fora de related é classificado fora e reprova invariantes', () => {
  const result = classifyHtml('<div class="card"><a>VER OFERTA ↗</a></div>');
  assert.equal(result.ambiguities.length, 0);
  const summary = counts(result);
  assert.deepEqual(summary, { exactTotal: 1, relatedTotal: 0, outsideTotal: 1 });
  const failures = auditFailures({ fileCount: 1, ...summary, ambiguousFileCount: 0 });
  assert.ok(failures.some((failure) => failure.includes('fora de related-actions')));
});

test('estrutura related com fechamento ausente é ambígua', () => {
  const result = classifyHtml('<div class="related-actions"><a>VER OFERTA ↗</a>');
  assert.ok(result.ambiguities.length > 0);
});

test('nesting relevante cruzado é ambíguo', () => {
  const result = classifyHtml('<div class="related-actions"><a>VER OFERTA ↗</div></a>');
  assert.ok(result.ambiguities.some((item) => item.includes('nesting relevante cruzado')));
});

test('transformação futura só toca related real e ignora comment/script/style', () => {
  const fixture = `
    <div class="card"><a href="#card">VER OFERTA ↗</a></div>
    <div class="search"><a href="#search">VER OFERTA ↗</a></div>
    <div class="sticky"><a href="#sticky">VER OFERTA ↗</a></div>
    <div class="primary"><a href="#primary">VER OFERTA ↗</a></div>
    <aside class="sidebar"><a href="#sidebar">VER OFERTA ↗</a></aside>
    <div class="comment"><a href="#comment"><!-- VER OFERTA ↗ --></a></div>
    <div class="script"><a href="#script"><script>const texto = 'VER OFERTA ↗';</script></a></div>
    <div class="style"><a href="#style"><style>/* VER OFERTA ↗ */</style></a></div>
    <section class="related-products">
      <div class="related-actions"><a href="#analyse">ANALISAR</a><a href="#related"><span>VER OFERTA ↗</span></a></div>
    </section>`;

  const before = classifyHtml(fixture);
  assert.equal(before.ambiguities.length, 0);
  assert.deepEqual(counts(before), { exactTotal: 6, relatedTotal: 1, outsideTotal: 5 });

  const after = transformRelatedInMemory(fixture);
  assert.equal((after.match(/VER NO MERCADO LIVRE ↗/g) ?? []).length, 1);
  for (const context of ['card', 'search', 'sticky', 'primary']) {
    assert.ok(after.includes(`<div class="${context}"><a href="#${context}">${EXACT_CTA}</a></div>`));
  }
  assert.ok(after.includes(`<aside class="sidebar"><a href="#sidebar">${EXACT_CTA}</a></aside>`));
  assert.ok(after.includes(`<!-- ${EXACT_CTA} -->`));
  assert.ok(after.includes(`const texto = '${EXACT_CTA}';`));
  assert.ok(after.includes(`/* ${EXACT_CTA} */`));
  assert.match(after, /class="related-actions"[\s\S]*?VER NO MERCADO LIVRE ↗/);
});


test('CTA pós-M3.2 é classificado estruturalmente em related', () => {
  const result = classifyHtml(`<div class="related-actions"><a>${CURRENT_CTA}</a></div>`, CURRENT_CTA);
  assert.equal(result.ambiguities.length, 0);
  assert.deepEqual(counts(result), { exactTotal: 1, relatedTotal: 1, outsideTotal: 0 });
});

test('invariantes pós-M3.2 exigem zero legado e exatamente 2457 novos related', () => {
  const valid = postAuditFailures({
    fileCount: 556,
    legacyTotal: 0,
    legacyRelated: 0,
    legacyOutside: 0,
    legacyUnresolved: 0,
    currentRelated: 2457,
    currentUnresolved: 0,
    ambiguousFileCount: 0,
  });
  assert.deepEqual(valid, []);

  const invalid = postAuditFailures({
    fileCount: 556,
    legacyTotal: 1,
    legacyRelated: 1,
    legacyOutside: 0,
    legacyUnresolved: 0,
    currentRelated: 2456,
    currentUnresolved: 0,
    ambiguousFileCount: 0,
  });
  assert.ok(invalid.some((failure) => failure.includes('legado')));
  assert.ok(invalid.some((failure) => failure.includes('2456 != 2457')));
});
