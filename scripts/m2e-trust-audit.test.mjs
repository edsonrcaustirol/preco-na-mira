import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTransparency } from './apply-m2e-transparency.mjs';
import { auditHtml, findDangerousClaims, validateReport } from './m2e-trust-audit.mjs';

const affiliate = 'https://meli.la/abc123';

test('classifica claims materialmente perigosos sem bloquear palavras genéricas', () => {
  assert.deepEqual(findDangerousClaims('<p>menor preço garantido</p>'), ['lowest-price-guaranteed', 'price-guaranteed']);
  assert.deepEqual(findDangerousClaims('<p>Compare preços e escolha o que faz sentido para você.</p>'), []);
  assert.deepEqual(findDangerousClaims('<p>Guia independente de cabos elétricos</p>'), []);
});

test('remove claims frágeis de afiliado e deixa compra externa explícita', () => {
  const source = `<body><div class="topbar">Conteúdo independente • Alguns links podem gerar comissão de afiliado, sem custo extra para você.</div><main><a href="${affiliate}" target="_blank" rel="sponsored nofollow noopener noreferrer">VER OFERTA ATUAL ↗</a><div class="affiliate-note">Link de afiliado: podemos receber comissão sem custo adicional para você.</div></main></body>`;
  const output = applyTransparency(source);
  assert.equal(findDangerousClaims(output).length, 0);
  assert.match(output, /data-pnm-trust="m2e"/);
  assert.match(output, /VER NO MERCADO LIVRE/);
  assert.match(output, /data-pnm-affiliate-disclosure="m2e"/);
  assert.match(output, /preço, estoque, entrega e condições finais/i);
});

test('injeta disclosure contextual somente quando há link afiliado', () => {
  const commercial = applyTransparency(`<main><a href="${affiliate}" target="_blank" rel="sponsored noopener">VER NO MERCADO LIVRE</a></main>`);
  const editorial = applyTransparency('<main><p>Conteúdo informativo.</p></main>');
  assert.match(commercial, /data-pnm-affiliate-disclosure="m2e"/);
  assert.doesNotMatch(editorial, /data-pnm-affiliate-disclosure/);
});

test('auditoria exige sponsored, segurança externa, destino claro e disclosure', () => {
  const html = applyTransparency(`<main><a href="${affiliate}" target="_blank" rel="sponsored nofollow noopener noreferrer">VER NO MERCADO LIVRE ↗</a></main>`);
  const page = auditHtml('fixture.html', html);
  const report = {
    contract: 'pnm.m2e-trust-audit/v1',
    pages: { total: 1, commercial: 1, commercialWithDisclosure: Number(page.hasDisclosure) },
    affiliates: {
      total: page.affiliateLinks.length,
      sponsored: page.affiliateLinks.filter(link => link.sponsored).length,
      secureExternal: page.affiliateLinks.filter(link => link.secureExternal).length,
      clearDestination: page.affiliateLinks.filter(link => link.clearDestination).length,
    },
    claims: { unsupported: page.dangerousClaims.length },
    schema: { personPages: [], reviewOrRatingPages: [] },
  };
  assert.deepEqual(validateReport(report), []);
});

test('schema Person e review/rating continuam bloqueados sem evidência', () => {
  const person = auditHtml('person.html', '<script type="application/ld+json">{"@type":"Person"}</script>');
  const review = auditHtml('review.html', '<script type="application/ld+json">{"@type":"Product","aggregateRating":{"ratingValue":5}}</script>');
  assert.equal(person.personSchema, true);
  assert.equal(review.reviewSchema, true);
});
