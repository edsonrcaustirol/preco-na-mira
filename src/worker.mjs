import { handleCommercialPanel, PANEL_PATH } from './commercial-panel.mjs';

const ENDPOINT = '/__pnm/analytics';
const EVENTS = new Set(['page_view', 'affiliate_click', 'commercial_impression']);
const PLACEMENTS = new Set(['card','primary','sidebar','sticky','related','search_result','saved','cart','comparison','project','studio','small_spaces','obra_base','dewalt_pending']);
const IMPRESSION_PLACEMENTS = new Set(['card','related']);
const PAGE_FIELDS = new Set(['page','page_type','product_id','utm_source','utm_medium','utm_campaign','referrer_host']);
const CLICK_FIELDS = new Set(['product_id','store','page','placement','utm_source','utm_medium','utm_campaign','referrer_host']);
const IMPRESSION_FIELDS = new Set(['product_id','store','page','page_type','placement','utm_source','utm_medium','utm_campaign','referrer_host']);

const clean = (value, max = 120) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const slug = (value, max = 120) => clean(value, max).toLowerCase().replace(/[^a-z0-9._/-]+/g, '_').replace(/^_+|_+$/g, '');
const campaign = value => clean(value, 120).replace(/[^\p{L}\p{N} _./:-]/gu, '').slice(0, 120);

function sanitize(event, data) {
  const fields = event === 'page_view' ? PAGE_FIELDS : event === 'affiliate_click' ? CLICK_FIELDS : event === 'commercial_impression' ? IMPRESSION_FIELDS : null;
  if (!fields || !data || typeof data !== 'object' || Array.isArray(data)) return null;
  const out = {};
  for (const key of fields) {
    if (!(key in data)) continue;
    const value = key === 'utm_campaign' ? campaign(data[key]) : key === 'referrer_host' ? clean(data[key], 120).toLowerCase() : slug(data[key], key === 'product_id' ? 120 : 80);
    if (value) out[key] = value;
  }
  if (event === 'page_view' && (!out.page || !out.page_type)) return null;
  if (event === 'affiliate_click' && (!out.product_id || !out.store || !out.page || !PLACEMENTS.has(out.placement))) return null;
  if (event === 'commercial_impression' && (!out.product_id || out.product_id === 'unknown' || !out.store || !out.page || !out.page_type || !IMPRESSION_PLACEMENTS.has(out.placement))) return null;
  return out;
}

function pointFor(event, data, host) {
  return {
    indexes: [event],
    blobs: [
      'm1-v1', event, data.page || '', data.page_type || '', data.product_id || '', data.store || '', data.placement || '',
      data.utm_source || '', data.utm_medium || '', data.utm_campaign || '', data.referrer_host || '', host
    ],
    doubles: [1]
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === PANEL_PATH) return handleCommercialPanel(request, env);
    if (url.pathname !== ENDPOINT) return env.ASSETS.fetch(request);
    if (request.method !== 'POST') return new Response('', { status: 405, headers: { allow: 'POST' } });
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) return new Response('', { status: 403 });
    const length = Number(request.headers.get('content-length') || 0);
    if (length > 4096) return new Response('', { status: 413 });
    let raw;
    try { raw = await request.text(); } catch (_) { return new Response('', { status: 400 }); }
    if (raw.length > 4096) return new Response('', { status: 413 });
    let body;
    try { body = JSON.parse(raw); } catch (_) { return new Response('', { status: 400 }); }
    if (!EVENTS.has(body?.event)) return new Response('', { status: 400 });
    const data = sanitize(body.event, body.data);
    if (!data) return new Response('', { status: 400 });
    env.PNM_ANALYTICS.writeDataPoint(pointFor(body.event, data, url.hostname));
    return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  }
};
