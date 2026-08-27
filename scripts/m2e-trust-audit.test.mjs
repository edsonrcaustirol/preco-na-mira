import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTransparency } from './apply-m2e-transparency.mjs';
import { auditHtml, findDangerousClaims, validateReport } from './m2e-trust-audit.mjs';

const affiliate = 'https://meli.la/abc123';

function reportFromPage(page) {
  return {
    contract: 'pnm.m2e-trust-audit/v1',
    pages: {
      total: 1,
      commercial: Number(page.commercial),
      commercialWithDisclosure: Number(page.hasDisclosure),
      commercialWithExplicitDestination: Number(page.explicitExternalDestination),
    },
    affiliates: {
      total: page.affiliateLinks.length,
      sponsored: page.affiliateLinks.filter(link => link.sponsored).length,
      secureExternal: page.affiliateLinks.filter(link => link.secureExternal).length,
      elementDestinationExplicit: page.affiliateLinks.filter(link => link.elementDestinationExplicit).length,
      coveredByExplicitPageContext: page.explicitExternalDestination ? page.affiliateLinks.length : 0,
    },
    claims: { unsupported: page.dangerousClaims.length },
    schema: { personPages: [], reviewOrRatingPages: [] },
  };
}

const goodAttrs = 'target="_blank" rel="sponsored nofollow noopener noreferrer"';

test('classifica claims materialmente perigosos sem bloquear palavras genéricas', () => {
  assert.deepEqual(findDangerousClaims('<p>menor preço garantido</p>'), ['lowest-price-guaranteed', 'price-guaranteed']);
  assert.deepEqual(findDangerousClaims('<p>Compare preços e escolha o que faz sentido para você.</p>'), []);
  assert.deepEqual(findDangerousClaims('<p>Guia independente de cabos elétricos</p>'), []);
  assert.deepEqual(findDangerousClaims('<p>Como escolher a melhor opção para sua necessidade.</p>'), []);
  assert.deepEqual(findDangerousClaims('<h1>Ofertas</h1><p>Veja a seleção atual.</p>'), []);
  assert.deepEqual(findDangerousClaims('<p>Curadoria independente • veja produtos.</p>'), ['editorial-independence']);
});

test('remove claims frágeis de afiliado e deixa compra externa explícita', () => {
  const source = `<body><div class="topbar">Conteúdo independente • Alguns links podem gerar comissão de afiliado, sem custo extra para você.</div><main><a href="${affiliate}" ${goodAttrs}>VER OFERTA ATUAL ↗</a><div class="affiliate-note">Link de afiliado: podemos receber comissão sem custo adicional para você.</div></main></body>`;
  const output = applyTransparency(source);
  assert.equal(findDangerousClaims(output).length, 0);
  assert.match(output, /data-pnm-trust="m2e"/);
  assert.match(output, /VER NO MERCADO LIVRE/);
  assert.match(output, /data-pnm-affiliate-disclosure="m2e"/);
  assert.match(output, /compra acontece fora do Preço na Mira, no Mercado Livre/i);
  assert.match(output, /preço, estoque, entrega e condições finais/i);
});

test('normaliza variantes legadas de independência e ausência de custo na origem', () => {
  const source = `<body><p>Curadoria independente • Links de oferta podem gerar comissão de afiliado, sem custo extra para você.</p><main><a href="${affiliate}" ${goodAttrs}>VER PRODUTO</a></main></body>`;
  const output = applyTransparency(source);
  assert.equal(findDangerousClaims(output).length, 0);
  assert.doesNotMatch(output, /curadoria independente/i);
  assert.doesNotMatch(output, /sem custo extra/i);
  assert.match(output, /Mercado Livre/i);
});

test('injeta disclosure contextual somente quando há link afiliado', () => {
  const commercial = applyTransparency(`<main><a href="${affiliate}" ${goodAttrs}>VER NO MERCADO LIVRE</a></main>`);
  const editorial = applyTransparency('<main><p>Conteúdo informativo.</p></main>');
  assert.match(commercial, /data-pnm-affiliate-disclosure="m2e"/);
  assert.doesNotMatch(editorial, /data-pnm-affiliate-disclosure/);
});

test('PASS: imagem afiliada é coberta por CTA textual claro no mesmo contexto de página', () => {
  const html = applyTransparency(`<main><article><a href="${affiliate}" ${goodAttrs}><img src="x.webp" alt="Produto"></a><a href="${affiliate}" ${goodAttrs}>VER NO MERCADO LIVRE ↗</a></article></main>`);
  const page = auditHtml('imagem-com-cta.html', html);
  assert.equal(page.affiliateLinks.length, 2);
  assert.equal(page.affiliateLinks.filter(link => link.elementDestinationExplicit).length, 1);
  assert.equal(page.explicitExternalDestination, true);
  assert.deepEqual(validateReport(reportFromPage(page)), []);
});

test('PASS: card com múltiplos links afiliados e identificação clara do destino', () => {
  const html = applyTransparency(`<main><article><p>Confira este produto e conclua a compra no Mercado Livre.</p><a href="${affiliate}" ${goodAttrs}><img src="x.webp"></a><a href="${affiliate}" ${goodAttrs}>COMPRAR NO MERCADO LIVRE</a><a href="${affiliate}" ${goodAttrs}>DETALHES DA OFERTA</a></article></main>`);
  const page = auditHtml('card-multiplo.html', html);
  assert.equal(page.explicitExternalDestination, true);
  assert.deepEqual(validateReport(reportFromPage(page)), []);
});

test('PASS: link auxiliar afiliado dentro de página comercial inequivocamente identificada', () => {
  const html = applyTransparency(`<main><section><h2>Oferta no Mercado Livre</h2><p>A compra é concluída no Mercado Livre.</p><a href="${affiliate}" ${goodAttrs}>VER DETALHES</a></section></main>`);
  const page = auditHtml('auxiliar.html', html);
  assert.equal(page.explicitExternalDestination, true);
  assert.deepEqual(validateReport(reportFromPage(page)), []);
});

test('FAIL: imagem afiliada sem qualquer indicação textual do destino', () => {
  const html = `<main><a href="${affiliate}" ${goodAttrs}><img src="x.webp" alt="Produto"></a><div data-pnm-affiliate-disclosure="m2e">Alguns links são de afiliado e podem gerar comissão.</div></main>`;
  const page = auditHtml('imagem-sem-destino.html', html);
  assert.equal(page.hasDisclosure, true);
  assert.equal(page.explicitExternalDestination, false);
  assert.match(validateReport(reportFromPage(page)).join(' | '), /destino externo suficientemente explícito/i);
});

test('FAIL: CTA Comprar sem contexto suficiente para perceber saída para marketplace', () => {
  const html = `<main><a href="${affiliate}" ${goodAttrs}>COMPRAR</a><div data-pnm-affiliate-disclosure="m2e">Alguns links são de afiliado e podem gerar comissão.</div></main>`;
  const page = auditHtml('comprar-generico.html', html);
  assert.equal(page.hasDisclosure, true);
  assert.equal(page.explicitExternalDestination, false);
  assert.match(validateReport(reportFromPage(page)).join(' | '), /destino externo suficientemente explícito/i);
});

test('FAIL: página afiliada sem disclosure e sem destino identificável', () => {
  const html = `<main><a href="${affiliate}" ${goodAttrs}>VER PRODUTO</a></main>`;
  const page = auditHtml('sem-disclosure.html', html);
  const errors = validateReport(reportFromPage(page)).join(' | ');
  assert.equal(page.hasDisclosure, false);
  assert.equal(page.explicitExternalDestination, false);
  assert.match(errors, /sem disclosure contextual/i);
  assert.match(errors, /destino externo suficientemente explícito/i);
});

test('schema Person e review/rating continuam bloqueados sem evidência', () => {
  const person = auditHtml('person.html', '<script type="application/ld+json">{"@type":"Person"}</script>');
  const review = auditHtml('review.html', '<script type="application/ld+json">{"@type":"Product","aggregateRating":{"ratingValue":5}}</script>');
  assert.equal(person.personSchema, true);
  assert.equal(review.reviewSchema, true);
});
