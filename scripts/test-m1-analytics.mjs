import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import worker from '../src/worker.mjs';

const clientSource = fs.readFileSync(new URL('./m1-client-fragment.js', import.meta.url), 'utf8');
let uuidCounter = 0;
const deterministicCrypto = {
  randomUUID() {
    uuidCounter += 1;
    return `00000000-0000-4000-8000-${String(uuidCounter).padStart(12, '0')}`;
  }
};

function storageMock() {
  const map = new Map();
  return {
    getItem: key => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
  };
}

function clientHarness({ path = '/catalogo', query = '', referrer = '', storage = storageMock(), sendBeaconResult = true, fetchThrows = false } = {}) {
  const beacons = [];
  const fetches = [];
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
    window: {}, document, location,
    navigator: {
      sendBeacon(url, body) {
        if (sendBeaconResult) beacons.push({ url, body });
        return sendBeaconResult;
      }
    },
    sessionStorage: storage,
    crypto: deterministicCrypto,
    CustomEvent: CustomEventMock,
    URL, WeakSet, Set, JSON, String, decodeURIComponent,
    fetch(url, options) {
      fetches.push({ url, options });
      if (fetchThrows) throw new Error('analytics transport unavailable');
      return Promise.resolve({ ok: true });
    }
  };
  vm.runInNewContext(clientSource, context, { filename: 'm1-client-fragment.js' });
  return { context, beacons, fetches, events, listeners, storage, runAgain: () => vm.runInNewContext(clientSource, context) };
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

// Existing attribution remains sanitized; social, landing and anonymous session are added.
{
  const h = clientHarness({ path: '/catalogo', query: '?utm_source=Instagram&utm_medium=social&utm_campaign=PNM%20M1', referrer: 'https://www.instagram.com/reel/abc?secret=x' });
  assert.equal(h.beacons.length, 1);
  const first = parsed(h.beacons[0]);
  assert.equal(first.event, 'page_view');
  assert.equal(first.data.page, 'catalogo');
  assert.equal(first.data.page_type, 'listing');
  assert.equal(first.data.utm_source, 'instagram');
  assert.equal(first.data.utm_medium, 'social');
  assert.equal(first.data.utm_campaign, 'PNM M1');
  assert.equal(first.data.referrer_host, 'www.instagram.com');
  assert.equal(first.data.landing, '/catalogo');
  assert.equal(first.data.channel, 'social');
  assert.match(first.data.session_id, /^[0-9a-f-]{36}$/);
  h.runAgain();
  assert.equal(h.beacons.length, 1, 'page_view must not duplicate if runtime initializes twice');
}

// A + D + E + I: Google organic landing is preserved through internal navigation to a product.
{
  const storage = storageMock();
  const entry = clientHarness({ path: '/montar-pc', referrer: 'https://www.google.com/search?q=montar+pc', storage });
  const first = parsed(entry.beacons[0]).data;
  assert.equal(first.channel, 'organic');
  assert.equal(first.landing, '/montar-pc');
  assert.equal(first.referrer_host, 'www.google.com');
  const sessionId = first.session_id;

  const product = clientHarness({ path: '/produto-rtx-5060', referrer: 'https://preconamira.com.br/montar-pc', storage });
  const second = parsed(product.beacons[0]).data;
  assert.equal(second.page_type, 'product');
  assert.equal(second.product_id, 'rtx-5060');
  assert.equal(second.landing, '/montar-pc', 'internal navigation must not overwrite landing');
  assert.equal(second.channel, 'organic', 'initial acquisition channel must remain stable');
  assert.equal(second.session_id, sessionId, 'session id must remain stable inside the session');
}

// B: direct.
{
  const h = clientHarness({ path: '/' });
  const data = parsed(h.beacons[0]).data;
  assert.equal(data.channel, 'direct');
  assert.equal(data.landing, '/');
  assert.equal(data.referrer_host, undefined);
}

// C: external referral.
{
  const h = clientHarness({ path: '/ofertas', referrer: 'https://example.org/article?id=123' });
  const data = parsed(h.beacons[0]).data;
  assert.equal(data.channel, 'referral');
  assert.equal(data.referrer_host, 'example.org');
  assert.equal(data.landing, '/ofertas');
}

// L + privacy: only allowed UTM fields are read; arbitrary query data is never persisted and PII-shaped UTM is dropped.
{
  const h = clientHarness({ path: '/catalogo', query: '?utm_source=Google&utm_medium=cpc&utm_campaign=person%40example.com&email=secret%40example.com&cpf=12345678901' });
  const data = parsed(h.beacons[0]).data;
  assert.equal(data.channel, 'paid');
  assert.equal(data.utm_source, 'google');
  assert.equal(data.utm_medium, 'cpc');
  assert.equal(data.utm_campaign, undefined);
  assert.equal('email' in data, false);
  assert.equal('cpf' in data, false);
}

// F + H: affiliate destination is untouched and placement stays factual.
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
  assert.equal(payload.event, 'affiliate_click');
  assert.equal(payload.data.product_id, 'jbl-go-4');
  assert.equal(payload.data.store, 'mercado_livre');
  assert.equal(payload.data.page, 'produto');
  assert.equal(payload.data.placement, 'sticky');
  assert.equal(payload.data.landing, '/produto-jbl-go-4');
  assert.equal(payload.data.channel, 'direct');
  assert.match(payload.data.session_id, /^[0-9a-f-]{36}$/);
  assert.deepEqual(state, before, 'tracking must not alter href/target/rel');
}

// G: analytics failure never blocks or mutates the commercial link.
{
  const h = clientHarness({ path: '/produto-jbl-go-4', sendBeaconResult: false, fetchThrows: true });
  const click = h.listeners.get('click')[0];
  const { anchor, state } = makeAnchor({ href: 'https://meli.la/1fGctx2' });
  const before = { ...state };
  assert.doesNotThrow(() => click({ target: anchor }));
  assert.deepEqual(state, before);
  assert.ok(h.fetches.length >= 2, 'page view and click should attempt fallback transport');
}

// J: a new browser session receives a new anonymous identifier.
{
  const first = parsed(clientHarness({ path: '/' }).beacons[0]).data.session_id;
  const second = parsed(clientHarness({ path: '/' }).beacons[0]).data.session_id;
  assert.notEqual(first, second);
}

// K: arbitrary personal/form/query fields are not part of the event allowlist.
{
  const h = clientHarness({ path: '/produto-jbl-go-4' });
  const tracked = h.context.window.PNMAnalytics.track('affiliate_click', {
    product_id: 'jbl-go-4', store: 'mercado_livre', page: 'produto', placement: 'primary',
    email: 'person@example.com', phone: '49999999999', cpf: '12345678901', form_content: 'secret', query: '?email=person@example.com'
  });
  assert.equal(tracked, true);
  const data = parsed(h.beacons.at(-1)).data;
  for (const forbidden of ['email','phone','cpf','form_content','query']) assert.equal(forbidden in data, false);
}

// Existing factual product/placement behavior remains intact.
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

// Worker enforces the same allowlist and stores the additive journey dimensions in blobs 13-15.
{
  const writes = [];
  const env = { PNM_ANALYTICS: { writeDataPoint(point) { writes.push(point); } }, ASSETS: { fetch() { return new Response('asset', { status: 200 }); } } };
  const body = JSON.stringify({ event: 'affiliate_click', data: {
    product_id: 'jbl-go-4', store: 'mercado_livre', page: 'produto', placement: 'primary', utm_source: 'google',
    utm_campaign: 'person@example.com', referrer_host: 'www.google.com', landing: '/montar-pc?email=secret@example.com', channel: 'organic',
    session_id: '12345678-1234-4234-8234-123456789abc', email: 'person@example.com', cpf: '12345678901'
  } });
  const request = new Request('https://preconamira.com.br/__pnm/analytics', { method: 'POST', headers: { origin: 'https://preconamira.com.br', 'content-type': 'application/json' }, body });
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 204);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].indexes[0], 'affiliate_click');
  assert.equal(writes[0].blobs.length, 15);
  assert.equal(writes[0].blobs[4], 'jbl-go-4');
  assert.equal(writes[0].blobs[5], 'mercado_livre');
  assert.equal(writes[0].blobs[6], 'primary');
  assert.equal(writes[0].blobs[9], '', 'PII-shaped UTM campaign must not persist');
  assert.equal(writes[0].blobs[12], '/montar-pc');
  assert.equal(writes[0].blobs[13], 'organic');
  assert.equal(writes[0].blobs[14], '12345678-1234-4234-8234-123456789abc');
  assert.equal(JSON.stringify(writes[0]).includes('person@example.com'), false);
  assert.equal(JSON.stringify(writes[0]).includes('12345678901'), false);

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