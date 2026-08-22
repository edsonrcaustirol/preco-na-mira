import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import worker from '../src/worker.mjs';

const clientSource = fs.readFileSync(new URL('./m1-client-fragment.js', import.meta.url), 'utf8');

function storageMock() {
  const map = new Map();
  return { getItem: key => map.has(key) ? map.get(key) : null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) };
}

function clientHarness({ path = '/catalogo', query = '', referrer = '' } = {}) {
  const beacons = [];
  const events = [];
  const listeners = new Map();
  const href = `https://preconamira.com.br${path}${query}`;
  const location = new URL(href);
  const document = {
    referrer,
    body: { dataset: {} },
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); },
    dispatchEvent(event) { events.push(event); return true; }
  };
  class CustomEventMock { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } }
  const context = {
    window: {}, document, location, navigator: { sendBeacon(url, body) { beacons.push({ url, body }); return true; } },
    sessionStorage: storageMock(), CustomEvent: CustomEventMock, URL, WeakSet, Set, JSON, String, decodeURIComponent,
    fetch() { throw new Error('fetch fallback should not be needed in tests'); }
  };
  vm.runInNewContext(clientSource, context, { filename: 'm1-client-fragment.js' });
  return { context, beacons, events, listeners, runAgain: () => vm.runInNewContext(clientSource, context) };
}

function parsed(beacon) { return JSON.parse(beacon.body); }

function makeAnchor({ href, productId = '', internalProductHref = '', matches = [] } = {}) {
  const state = { href, target: '_blank', rel: 'sponsored nofollow noopener noreferrer' };
  const root = { querySelector() { return internalProductHref ? { href: internalProductHref, getAttribute: () => internalProductHref } : null; } };
  const anchor = {
    get href() { return state.href; }, set href(v) { state.href = v; },
    get target() { return state.target; }, set target(v) { state.target = v; },
    get rel() { return state.rel; }, set rel(v) { state.rel = v; },
    parentElement: root,
    getAttribute(name) { return name === 'href' ? state.href : name === 'target' ? state.target : name === 'rel' ? state.rel : null; },
    closest(selector) {
      if (selector === 'a[href]') return anchor;
      if (selector === '[data-pnm-product-id]' && productId) return { dataset: { pnmProductId: productId } };
      if (selector === '[data-product-id]' && productId) return { dataset: { productId } };
      if (selector === 'article[data-id]') return null;
      if (selector.startsWith('article,td,')) return root;
      if (matches.some(token => selector.includes(token))) return {};
      return null;
    }
  };
  return { anchor, state };
}

{
  const h = clientHarness({ path: '/catalogo', query: '?utm_source=Instagram&utm_medium=social&utm_campaign=PNM%20M1', referrer: 'https://www.instagram.com/reel/abc?secret=x' });
  assert.equal(h.beacons.length, 1);
  const first = parsed(h.beacons[0]);
  assert.equal(first.event, 'page_view');
  assert.deepEqual(first.data, { page: 'catalogo', page_type: 'listing', utm_source: 'instagram', utm_medium: 'social', utm_campaign: 'PNM M1', referrer_host: 'www.instagram.com' });
  h.runAgain();
  assert.equal(h.beacons.length, 1, 'page_view must not duplicate if runtime initializes twice');
}

{
  const h = clientHarness({ path: '/produto-jbl-go-4' });
  const click = h.listeners.get('click')[0];
  const { anchor, state } = makeAnchor({ href: 'https://meli.la/1fGctx2', matches: ['.sticky-offer'] });
  const before = { ...state };
  const event = { target: anchor };
  click(event);
  click(event);
  assert.equal(h.beacons.length, 2, 'one page_view + one affiliate_click');
  const payload = parsed(h.beacons[1]);
  assert.deepEqual(payload, { event: 'affiliate_click', data: { product_id: 'jbl-go-4', store: 'mercado_livre', page: 'produto', placement: 'sticky' } });
  assert.deepEqual(state, before, 'tracking must not alter href/target/rel');
}

{
  const h = clientHarness({ path: '/dewalt' });
  const click = h.listeners.get('click')[0];
  const { anchor } = makeAnchor({ href: 'https://meli.la/24zmozq', matches: ['.dw-pending-card'] });
  click({ target: anchor });
  const payload = parsed(h.beacons.at(-1));
  assert.equal(payload.data.product_id, 'unknown');
  assert.equal(payload.data.placement, 'dewalt_pending');
}

{
  const h = clientHarness({ path: '/carrinho' });
  const click = h.listeners.get('click')[0];
  const { anchor } = makeAnchor({ href: 'https://meli.la/abc123', internalProductHref: 'produto-philips-tas1505b-00' });
  click({ target: anchor });
  const payload = parsed(h.beacons.at(-1));
  assert.equal(payload.data.product_id, 'philips-tas1505b-00');
  assert.equal(payload.data.placement, 'cart');
}

{
  const h = clientHarness({ path: '/produto-jbl-go-4' });
  const click = h.listeners.get('click')[0];
  click({ target: makeAnchor({ href: 'https://www.jbl.com.br/GO-4.html' }).anchor });
  click({ target: makeAnchor({ href: 'https://preconamira.com.br/catalogo' }).anchor });
  assert.equal(h.beacons.length, 1, 'only page_view expected');
}

{
  const writes = [];
  const env = { PNM_ANALYTICS: { writeDataPoint(point) { writes.push(point); } }, ASSETS: { fetch() { return new Response('asset', { status: 200 }); } } };
  const body = JSON.stringify({ event: 'affiliate_click', data: { product_id: 'jbl-go-4', store: 'mercado_livre', page: 'produto', placement: 'primary', utm_source: 'instagram' } });
  const request = new Request('https://preconamira.com.br/__pnm/analytics', { method: 'POST', headers: { origin: 'https://preconamira.com.br', 'content-type': 'application/json' }, body });
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 204);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].indexes[0], 'affiliate_click');
  assert.equal(writes[0].blobs[4], 'jbl-go-4');
  assert.equal(writes[0].blobs[5], 'mercado_livre');
  assert.equal(writes[0].blobs[6], 'primary');

  const badEvent = new Request('https://preconamira.com.br/__pnm/analytics', { method: 'POST', body: JSON.stringify({ event: 'search', data: {} }) });
  assert.equal((await worker.fetch(badEvent, env)).status, 400);
  assert.equal(writes.length, 1);

  const crossOrigin = new Request('https://preconamira.com.br/__pnm/analytics', { method: 'POST', headers: { origin: 'https://evil.example' }, body });
  assert.equal((await worker.fetch(crossOrigin, env)).status, 403);
  assert.equal(writes.length, 1);

  const nonAnalytics = new Request('https://preconamira.com.br/catalogo');
  assert.equal((await worker.fetch(nonAnalytics, env)).status, 200);
}

console.log('M1 analytics tests: OK');
