import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import worker from '../src/worker.mjs';
import { ACCEPTED_EVENTS, IMPRESSION_PLACEMENTS, QUERY_DEFINITIONS, getQuery, listQueries } from './m3-1-analytics-lib.mjs';

const source = fs.readFileSync(new URL('./m1-client-fragment.js', import.meta.url), 'utf8');

function storageMock() {
  const map = new Map();
  return { getItem: key => map.has(key) ? map.get(key) : null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) };
}

function harness({ path = '/catalogo', placement = 'card', productId = 'produto-teste' } = {}) {
  const beacons = [], listeners = new Map(), timers = new Map(), observed = [];
  let nextTimer = 1, ioCallback, mutationCallback;
  const cardRoot = { isConnected: true, querySelector() { return null; } };
  const anchor = {
    href: 'https://meli.la/teste', parentElement: cardRoot,
    getAttribute(name) { return name === 'href' ? this.href : null; },
    closest(selector) {
      if (selector === 'a[href]') return anchor;
      if (selector === '[data-pnm-product-id]') return { dataset: { pnmProductId: productId } };
      if (selector === '[data-product-id]' || selector === 'article[data-id]') return null;
      if (placement === 'related' && selector.includes('.related-block')) return cardRoot;
      if (placement === 'related' && selector.includes('.related-mini')) return cardRoot;
      if (placement === 'card' && selector.startsWith('article,td,')) return cardRoot;
      if (placement === 'card' && selector.includes('.pnm-product-card')) return cardRoot;
      return null;
    }
  };
  const document = {
    referrer: '', body: {},
    querySelectorAll(selector) { return selector === 'a[href]' ? [anchor] : []; },
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); },
    dispatchEvent() { return true; }
  };
  class CustomEventMock { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } }
  class IntersectionObserverMock {
    constructor(callback, options) { ioCallback = callback; this.options = options; }
    observe(target) { observed.push(target); }
    unobserve() {}
  }
  class MutationObserverMock {
    constructor(callback) { mutationCallback = callback; }
    observe() {}
  }
  const location = new URL(`https://preconamira.com.br${path}`);
  const context = {
    window: {}, document, location, navigator: { sendBeacon(url, body) { beacons.push({ url, body }); return true; } },
    sessionStorage: storageMock(), CustomEvent: CustomEventMock, URL, WeakSet, WeakMap, Set, Map, JSON, String, Number, Object, Boolean, decodeURIComponent,
    IntersectionObserver: IntersectionObserverMock, MutationObserver: MutationObserverMock,
    setTimeout(fn) { const id = nextTimer++; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); },
    fetch() { throw new Error('fetch fallback should not be needed'); }
  };
  vm.runInNewContext(source, context, { filename: 'm1-client-fragment.js' });
  return {
    beacons, listeners, anchor, observed,
    intersect(ratio) { ioCallback([{ target: cardRoot, isIntersecting: ratio > 0, intersectionRatio: ratio }]); },
    mutate() { mutationCallback?.([{ addedNodes: [{ matches() { return false; }, querySelectorAll() { return [anchor]; } }] }]); },
    remove() { cardRoot.isConnected = false; },
    flush() { const fns = [...timers.values()]; timers.clear(); for (const fn of fns) fn(); }
  };
}
const parsed = beacon => JSON.parse(beacon.body);

assert.deepEqual(ACCEPTED_EVENTS, ['page_view', 'affiliate_click', 'commercial_impression']);
assert.deepEqual(IMPRESSION_PLACEMENTS, ['card', 'related']);

for (const placement of ['card', 'related']) {
  const h = harness({ path: placement === 'related' ? '/produto-base' : '/catalogo', placement, productId: `${placement}-produto` });
  assert.equal(h.observed.length, 1, `${placement}: oportunidade deve ser observada`);
  h.mutate();
  assert.equal(h.observed.length, 1, `${placement}: MutationObserver não deve instrumentar o mesmo alvo duas vezes`);
  assert.equal(h.beacons.length, 1, `${placement}: somente page_view antes da visibilidade`);
  h.intersect(0.49); h.flush();
  assert.equal(h.beacons.length, 1, `${placement}: não deve impressionar abaixo de 50%`);
  h.intersect(0.5);
  assert.equal(h.beacons.length, 1, `${placement}: deve respeitar dwell de 500ms`);
  h.intersect(0.49); h.flush();
  assert.equal(h.beacons.length, 1, `${placement}: sair do threshold antes de 500ms deve cancelar`);
  h.intersect(0.5); h.flush();
  assert.equal(h.beacons.length, 2, `${placement}: impressão após limiar + dwell contínuo`);
  const impression = parsed(h.beacons[1]);
  assert.equal(impression.event, 'commercial_impression');
  assert.equal(impression.data.product_id, `${placement}-produto`);
  assert.equal(impression.data.store, 'mercado_livre');
  assert.equal(impression.data.placement, placement);
  assert.ok(impression.data.page);
  assert.ok(impression.data.page_type);
  h.intersect(0.1); h.intersect(0.8); h.flush();
  assert.equal(h.beacons.length, 2, `${placement}: scroll repetido deve ser deduplicado no runtime`);

  const click = h.listeners.get('click')[0];
  click({ target: h.anchor });
  assert.equal(parsed(h.beacons.at(-1)).event, 'affiliate_click', `${placement}: affiliate_click preservado`);
}

{
  const h = harness({ path: '/catalogo', placement: 'card', productId: 'removido-produto' });
  h.intersect(0.5);
  h.remove();
  h.flush();
  assert.equal(h.beacons.length, 1, 'alvo removido antes de 500ms não deve gerar impressão atrasada');
}

{
  const writes = [];
  const env = { PNM_ANALYTICS: { writeDataPoint(point) { writes.push(point); } }, ASSETS: { fetch() { return new Response('asset'); } } };
  const impression = new Request('https://preconamira.com.br/__pnm/analytics', { method: 'POST', headers: { origin: 'https://preconamira.com.br' }, body: JSON.stringify({ event: 'commercial_impression', data: { product_id: 'x', store: 'mercado_livre', page: 'catalogo', page_type: 'listing', placement: 'card' } }) });
  assert.equal((await worker.fetch(impression, env)).status, 204);
  assert.equal(writes[0].indexes[0], 'commercial_impression');
  assert.equal(writes[0].blobs[3], 'listing');
  assert.equal(writes[0].blobs[4], 'x');
  assert.equal(writes[0].blobs[6], 'card');

  const pageView = new Request('https://preconamira.com.br/__pnm/analytics', { method: 'POST', body: JSON.stringify({ event: 'page_view', data: { page: 'catalogo', page_type: 'listing' } }) });
  const click = new Request('https://preconamira.com.br/__pnm/analytics', { method: 'POST', body: JSON.stringify({ event: 'affiliate_click', data: { product_id: 'x', store: 'mercado_livre', page: 'catalogo', placement: 'card' } }) });
  assert.equal((await worker.fetch(pageView, env)).status, 204);
  assert.equal((await worker.fetch(click, env)).status, 204);

  const unknownEvent = new Request('https://preconamira.com.br/__pnm/analytics', { method: 'POST', body: JSON.stringify({ event: 'purchase', data: {} }) });
  assert.equal((await worker.fetch(unknownEvent, env)).status, 400);
  const invalidPlacement = new Request('https://preconamira.com.br/__pnm/analytics', { method: 'POST', body: JSON.stringify({ event: 'commercial_impression', data: { product_id: 'x', store: 'mercado_livre', page: 'produto', page_type: 'product', placement: 'primary' } }) });
  assert.equal((await worker.fetch(invalidPlacement, env)).status, 400);
  const unknownProduct = new Request('https://preconamira.com.br/__pnm/analytics', { method: 'POST', body: JSON.stringify({ event: 'commercial_impression', data: { product_id: 'unknown', store: 'mercado_livre', page: 'catalogo', page_type: 'listing', placement: 'card' } }) });
  assert.equal((await worker.fetch(unknownProduct, env)).status, 400);
  assert.equal(writes.length, 3);
}

const requiredMetrics = ['total_commercial_impressions','impressions_by_product','impressions_by_page','impressions_by_placement','affiliate_click_rate_by_product','affiliate_click_rate_by_placement'];
const requiredQuality = ['missing_commercial_impression_fields','unexpected_commercial_impression_values','unknown_event_types_m3_1','schema_incompatibilities_m3_1','possible_impression_inflation'];
for (const name of requiredMetrics) assert.equal(QUERY_DEFINITIONS[name].group, 'metrics');
for (const name of requiredQuality) assert.equal(getQuery(name).group, 'quality');
assert.equal(listQueries('metrics').length, requiredMetrics.length);
assert.equal(listQueries('quality').length, requiredQuality.length);
for (const [name, query] of Object.entries(QUERY_DEFINITIONS)) {
  assert.match(query.sql, /FROM pnm_commercial_m1/, `${name}: dataset`);
  assert.doesNotMatch(`${query.description}\n${query.sql}`, /convers[aã]o|conversion|amazon|shopee/i, `${name}: semântica/loja proibida`);
}
for (const name of ['affiliate_click_rate_by_product','affiliate_click_rate_by_placement']) {
  assert.equal(QUERY_DEFINITIONS[name].requires_m31_start, true);
  assert.throws(() => getQuery(name), /PNM_M31_START_UTC obrigatório/);
  const query = getQuery(name, { m31StartUtc: '2026-08-22T04:30:00Z' });
  assert.match(query.sql, /commercial_impression/);
  assert.match(query.sql, /affiliate_click/);
  assert.match(query.sql, /blob7 IN \('card', 'related'\)/);
  assert.match(query.sql, /timestamp >= toDateTime\('2026-08-22 04:30:00', 'Etc\/UTC'\)/);
  assert.match(query.sql, /SUM\(_sample_interval/);
  assert.doesNotMatch(query.sql, /__M3_1_START_UTC__/);
}
assert.match(getQuery('possible_impression_inflation').description, /Heurística/);

console.log('M3.1 commercial impression tests: OK');
