import test from 'node:test';
import assert from 'node:assert/strict';
import { auditProduct, CLASSIFICATIONS, classifyProduct, compareResults, summarize } from './lib/affiliate-integrity.mjs';

function product(overrides = {}) {
  return {
    id: 'furadeira-xpto-500',
    nome: 'Acme Furadeira XPTO-500 127V 600W',
    marca: 'Acme',
    categoria: 'Ferramentas',
    linkAfiliado: 'https://meli.la/teste',
    resumo: 'Furadeira modelo XPTO-500, 127 V e potência de 600 W.',
    chips: ['⚡ 127 V', '🔋 600 W'],
    ...overrides,
  };
}

function resolution(overrides = {}) {
  return {
    finalUrl: 'https://www.mercadolivre.com.br/acme-furadeira-xpto-500/p/MLB123',
    redirectChain: [{ url: 'https://meli.la/teste', status: 301, location: 'https://www.mercadolivre.com.br/acme-furadeira-xpto-500/p/MLB123' }],
    status: 200,
    title: 'Acme Furadeira XPTO-500 127V 600W',
    description: 'Furadeira Acme XPTO-500 com 600 W em 127 V.',
    bodySnippet: '',
    error: null,
    ...overrides,
  };
}

test('link correto exige identidade forte', () => {
  assert.equal(classifyProduct(product(), resolution()).classification, CLASSIFICATIONS.CORRETO);
});

test('modelo divergente => DIVERGENTE', () => {
  const result = classifyProduct(product(), resolution({ title: 'Acme Furadeira XPTO-700 127V 600W', description: 'Modelo XPTO-700' }));
  assert.equal(result.classification, CLASSIFICATIONS.DIVERGENTE);
  assert.ok(result.evidence.conflicts.some(c => c.type === 'model'));
});

test('voltagem divergente => DIVERGENTE', () => {
  const result = classifyProduct(product(), resolution({ title: 'Acme Furadeira XPTO-500 220V 600W', description: '220 V' }));
  assert.equal(result.classification, CLASSIFICATIONS.DIVERGENTE);
  assert.ok(result.evidence.conflicts.some(c => c.type === 'voltage'));
});

test('potência divergente => DIVERGENTE', () => {
  const result = classifyProduct(product(), resolution({ title: 'Acme Furadeira XPTO-500 127V 800W', description: '800 W' }));
  assert.equal(result.classification, CLASSIFICATIONS.DIVERGENTE);
  assert.ok(result.evidence.conflicts.some(c => c.type === 'power'));
});

test('anúncio indisponível é classificado separadamente', () => {
  const result = classifyProduct(product(), resolution({ status: 404, title: 'Anúncio finalizado' }));
  assert.equal(result.classification, CLASSIFICATIONS.ANUNCIO_INDISPONIVEL);
});

test('destino genérico é detectado', () => {
  const result = classifyProduct(product(), resolution({ finalUrl: 'https://www.mercadolivre.com.br/', title: 'Mercado Livre Brasil', description: '' }));
  assert.equal(result.classification, CLASSIFICATIONS.DESTINO_GENERICO);
});

test('redirect problemático => PROBLEMA_DE_LINK', () => {
  const result = classifyProduct(product(), { finalUrl: 'https://meli.la/teste', redirectChain: [], status: null, error: { kind: 'REDIRECT_LOOP', message: 'Loop' } });
  assert.equal(result.classification, CLASSIFICATIONS.PROBLEMA_DE_LINK);
});

test('bloqueio externo => NÃO_COMPROVÁVEL', () => {
  const result = classifyProduct(product(), resolution({ status: 403, title: 'Access denied' }));
  assert.equal(result.classification, CLASSIFICATIONS.NAO_COMPROVAVEL);
});

test('HTTP 200 sem identidade suficiente => NÃO_COMPROVÁVEL', () => {
  const result = classifyProduct(product(), resolution({ title: 'Oferta especial', description: 'Confira este item' }));
  assert.equal(result.classification, CLASSIFICATIONS.NAO_COMPROVAVEL);
});

test('falha de rede não vira link quebrado', async () => {
  const result = await auditProduct(product(), { resolver: async () => ({ finalUrl: 'https://meli.la/teste', redirectChain: [], status: null, error: { kind: 'NETWORK_ERROR', message: 'DNS' } }) });
  assert.equal(result.classification, CLASSIFICATIONS.NAO_COMPROVAVEL);
});

test('mesma marca e HTTP 200 isoladamente não viram CORRETO', () => {
  const result = classifyProduct(product(), resolution({ title: 'Acme Produto em promoção', description: 'Acme ferramentas' }));
  assert.notEqual(result.classification, CLASSIFICATIONS.CORRETO);
  assert.equal(result.classification, CLASSIFICATIONS.NAO_COMPROVAVEL);
});


test('404 no encurtador é problema de link, não anúncio indisponível', () => {
  const result = classifyProduct(product(), resolution({ finalUrl: 'https://meli.la/inexistente', status: 404, title: '' }));
  assert.equal(result.classification, CLASSIFICATIONS.PROBLEMA_DE_LINK);
});

test('PROVÁVEL exige múltiplos termos distintivos além da marca', () => {
  const p = product({ nome: 'Acme Furadeira Impacto Master', resumo: '', chips: [] });
  const result = classifyProduct(p, resolution({ title: 'Acme Furadeira Master para impacto profissional', description: '', finalUrl: 'https://www.mercadolivre.com.br/p/MLB123' }));
  assert.equal(result.classification, CLASSIFICATIONS.PROVAVEL);
});

test('resumo operacional e delta são consumíveis por monitor/Central', () => {
  const previous = [{ product_id: 'a', classification: CLASSIFICATIONS.CORRETO }, { product_id: 'b', classification: CLASSIFICATIONS.DIVERGENTE }];
  const current = [{ product_id: 'a', classification: CLASSIFICATIONS.DIVERGENTE }, { product_id: 'b', classification: CLASSIFICATIONS.CORRETO }, { product_id: 'c', classification: CLASSIFICATIONS.NAO_COMPROVAVEL }];
  const summary = summarize(current);
  const delta = compareResults(previous, current);
  assert.equal(summary.PRECISAM_ATENCAO, 1);
  assert.equal(summary.NAO_COMPROVAVEIS, 1);
  assert.equal(delta.newExceptions.length, 2);
  assert.equal(delta.resolvedExceptions.length, 1);
});


test('potência decimal com vírgula é preservada corretamente', () => {
  const p = product({ nome: 'Acme Caixa Mini AB12', resumo: 'Potência de 2,5 W RMS.', chips: ['2,5 W RMS'] });
  const result = classifyProduct(p, resolution({ title: 'Acme Caixa Mini AB12 2,5 W RMS', description: 'Potência 2,5 W RMS' }));
  assert.equal(result.classification, CLASSIFICATIONS.CORRETO);
  assert.deepEqual(result.evidence.expected.attributes.power, ['2.5w']);
});


test('código técnico não relacionado não cria falsa divergência de modelo', () => {
  const result = classifyProduct(product(), resolution({ title: 'Acme Furadeira 127V 600W IPX7', description: 'Ferramenta Acme com proteção IPX7' }));
  assert.equal(result.classification, CLASSIFICATIONS.NAO_COMPROVAVEL);
  assert.ok(!result.evidence.conflicts.some(c => c.type === 'model'));
});
