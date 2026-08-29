;(() => {
  'use strict';
  if (window.PNMAnalytics?.__m1 === true) return;

  const ENDPOINT = '/__pnm/analytics';
  const JOURNEY_KEY = 'pnm:m1:journey:v1';
  const PLACEMENTS = new Set(['card','primary','sidebar','sticky','related','search_result','saved','cart','comparison','project','studio','small_spaces','obra_base','dewalt_pending']);
  const IMPRESSION_PLACEMENTS = new Set(['card','related']);
  const CHANNELS = new Set(['organic','direct','referral','social','paid','internal','unknown']);
  const IMPRESSION_RATIO = 0.5;
  const IMPRESSION_DWELL_MS = 500;
  const JOURNEY_FIELDS = ['landing','channel','session_id'];
  const EVENT_FIELDS = {
    page_view: new Set(['page','page_type','product_id','utm_source','utm_medium','utm_campaign','referrer_host', ...JOURNEY_FIELDS]),
    affiliate_click: new Set(['product_id','store','page','placement','utm_source','utm_medium','utm_campaign','referrer_host', ...JOURNEY_FIELDS]),
    commercial_impression: new Set(['product_id','store','page','page_type','placement','utm_source','utm_medium','utm_campaign','referrer_host', ...JOURNEY_FIELDS])
  };

  const clean = (value, max = 120) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
  const slug = (value, fallback = 'unknown', max = 120) => {
    const out = clean(value, max).toLowerCase().replace(/[^a-z0-9._/-]+/g, '_').replace(/^_+|_+$/g, '');
    return out || fallback;
  };
  const hasPiiShape = value => {
    const raw = clean(value, 160);
    if (!raw) return false;
    if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(raw)) return true;
    return (raw.match(/\d/g) || []).length >= 9;
  };
  const safeSourceMedium = value => hasPiiShape(value) ? '' : slug(value, '', 80);
  const safeCampaign = value => hasPiiShape(value) ? '' : clean(value, 120).replace(/[^\p{L}\p{N} _./:-]/gu, '').slice(0, 120);
  const safeLanding = value => {
    const raw = clean(value, 160).split(/[?#]/, 1)[0];
    if (!raw.startsWith('/')) return '';
    const normalized = raw.replace(/\/?index\.html$/i, '/').replace(/\.html$/i, '').replace(/\/$/, '') || '/';
    return normalized.toLowerCase().replace(/[^a-z0-9._~/%/-]/g, '').slice(0, 160) || '/';
  };
  const safeSessionId = value => {
    const normalized = clean(value, 36).toLowerCase();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(normalized) ? normalized : '';
  };

  function currentPath() {
    return safeLanding(location.pathname) || '/';
  }

  function routeInfo() {
    const path = currentPath();
    const productMatch = path.match(/^\/produto-([^/]+)$/i);
    const queryProduct = new URL(location.href).searchParams.get('id');
    const productId = productMatch ? decodeURIComponent(productMatch[1]) : (/^\/produto$/i.test(path) ? queryProduct : '');
    if (productId) return { page: 'produto', page_type: 'product', product_id: slug(productId) };
    const routes = {
      '/': ['home','home'], '/catalogo': ['catalogo','listing'], '/ofertas': ['ofertas','listing'], '/busca': ['busca','search'],
      '/pequenos-espacos': ['pequenos_espacos','experience'], '/casa-studio': ['casa_studio','experience'], '/montar': ['montar','project'],
      '/projeto': ['projeto','project'], '/obra-base': ['obra_base','experience'], '/minha-lista': ['salvos','saved'], '/carrinho': ['carrinho','cart'],
      '/dewalt': ['dewalt','brand']
    };
    if (/^\/comparativo(?:-|\/|$)/.test(path)) return { page: 'comparacao', page_type: 'comparison', product_id: '' };
    const hit = routes[path];
    if (hit) return { page: hit[0], page_type: hit[1], product_id: '' };
    return { page: slug(path.split('/').filter(Boolean).pop() || 'home'), page_type: 'other', product_id: '' };
  }

  function referrerInfo() {
    const out = { referrer_host: '', internal_referrer: false };
    try {
      if (!document.referrer) return out;
      const ref = new URL(document.referrer);
      if (!ref.hostname) return out;
      if (ref.hostname.toLowerCase() === location.hostname.toLowerCase()) out.internal_referrer = true;
      else out.referrer_host = clean(ref.hostname.toLowerCase(), 120);
    } catch (_) {}
    return out;
  }

  function isSearchHost(host) {
    const value = String(host || '').toLowerCase().replace(/^www\./, '');
    return /(^|\.)google\.[a-z.]+$/.test(value) || value === 'bing.com' || value.endsWith('.bing.com') || value === 'search.yahoo.com' || value === 'duckduckgo.com' || value.endsWith('.duckduckgo.com');
  }

  function isSocialHost(value) {
    const host = String(value || '').toLowerCase().replace(/^www\./, '');
    return ['instagram.com','facebook.com','fb.com','tiktok.com','x.com','twitter.com','linkedin.com','youtube.com','youtu.be','pinterest.com','t.co'].some(domain => host === domain || host.endsWith(`.${domain}`));
  }

  function classifyChannel({ utm_source = '', utm_medium = '', referrer_host = '', internal_referrer = false } = {}) {
    const source = String(utm_source || '').toLowerCase();
    const medium = String(utm_medium || '').toLowerCase();
    if (/^(cpc|ppc|paid|paid_social|display|cpm|sem|ads?)$/.test(medium)) return 'paid';
    if (/^(organic|seo)$/.test(medium)) return 'organic';
    if (/^(social|social_media|social-media)$/.test(medium) || isSocialHost(source)) return 'social';
    if (/^(referral|referrer)$/.test(medium)) return 'referral';
    if (referrer_host) {
      if (isSearchHost(referrer_host)) return 'organic';
      if (isSocialHost(referrer_host)) return 'social';
      return 'referral';
    }
    if (internal_referrer) return 'internal';
    if (!source && !medium) return 'direct';
    return 'unknown';
  }

  function createSessionId() {
    try {
      if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID().toLowerCase();
      if (typeof crypto?.getRandomValues === 'function') {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      }
    } catch (_) {}
    const randomPart = () => Math.random().toString(16).slice(2).padEnd(16, '0');
    const hex = `${randomPart()}${randomPart()}`.slice(0, 32);
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  }

  function normalizeJourney(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const normalized = {
      landing: safeLanding(value.landing),
      channel: CHANNELS.has(String(value.channel || '').toLowerCase()) ? String(value.channel).toLowerCase() : '',
      session_id: safeSessionId(value.session_id),
      utm_source: safeSourceMedium(value.utm_source || ''),
      utm_medium: safeSourceMedium(value.utm_medium || ''),
      utm_campaign: safeCampaign(value.utm_campaign || ''),
      referrer_host: clean(value.referrer_host || '', 120).toLowerCase()
    };
    return normalized.landing && normalized.channel && normalized.session_id ? normalized : null;
  }

  function readJourney() {
    try {
      const prior = normalizeJourney(JSON.parse(sessionStorage.getItem(JOURNEY_KEY) || 'null'));
      if (prior) return prior;
    } catch (_) {}

    const url = new URL(location.href);
    const referrer = referrerInfo();
    const attribution = {
      utm_source: safeSourceMedium(url.searchParams.get('utm_source') || ''),
      utm_medium: safeSourceMedium(url.searchParams.get('utm_medium') || ''),
      utm_campaign: safeCampaign(url.searchParams.get('utm_campaign') || ''),
      referrer_host: referrer.referrer_host
    };
    const journey = {
      landing: currentPath(),
      channel: classifyChannel({ ...attribution, internal_referrer: referrer.internal_referrer }),
      session_id: createSessionId(),
      ...attribution
    };
    try { sessionStorage.setItem(JOURNEY_KEY, JSON.stringify(journey)); } catch (_) {}
    return journey;
  }

  function sanitize(eventName, data) {
    const allowed = EVENT_FIELDS[eventName];
    if (!allowed) return null;
    const out = {};
    for (const key of allowed) {
      if (!(key in (data || {}))) continue;
      let value;
      if (key === 'utm_campaign') value = safeCampaign(data[key]);
      else if (key === 'utm_source' || key === 'utm_medium') value = safeSourceMedium(data[key]);
      else if (key === 'landing') value = safeLanding(data[key]);
      else if (key === 'channel') value = CHANNELS.has(String(data[key] || '').toLowerCase()) ? String(data[key]).toLowerCase() : '';
      else if (key === 'session_id') value = safeSessionId(data[key]);
      else value = ['page','page_type','product_id','store','placement'].includes(key) ? slug(data[key], '', key === 'product_id' ? 120 : 80) : clean(data[key], 120);
      if (value) out[key] = value;
    }
    if (eventName === 'page_view' && (!out.page || !out.page_type)) return null;
    if (eventName === 'affiliate_click' && (!out.product_id || !out.store || !out.page || !out.placement)) return null;
    if (eventName === 'commercial_impression' && (!out.product_id || out.product_id === 'unknown' || !out.store || !out.page || !out.page_type || !IMPRESSION_PLACEMENTS.has(out.placement))) return null;
    return out;
  }

  function transmit(eventName, data) {
    const body = JSON.stringify({ event: eventName, data });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, body)) return true;
    } catch (_) {}
    try {
      fetch(ENDPOINT, { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true, credentials: 'same-origin' }).catch(() => {});
      return true;
    } catch (_) { return false; }
  }

  const api = {
    __m1: true,
    track(eventName, data = {}) {
      const payload = sanitize(eventName, data);
      if (!payload) return false;
      try { document.dispatchEvent(new CustomEvent('pnm:analytics', { detail: { event: eventName, data: payload } })); } catch (_) {}
      return transmit(eventName, payload);
    }
  };
  window.PNMAnalytics = api;

  const info = routeInfo();
  const journey = readJourney();
  if (!window.__PNM_M1_PAGE_VIEW__) {
    window.__PNM_M1_PAGE_VIEW__ = true;
    api.track('page_view', { page: info.page, page_type: info.page_type, ...(info.product_id ? { product_id: info.product_id } : {}), ...journey });
  }

  function storeFromHref(href) {
    try {
      const host = new URL(href, location.href).hostname.toLowerCase();
      if (host === 'meli.la' || host === 'mercadolivre.com.br' || host.endsWith('.mercadolivre.com.br') || host === 'mercadolibre.com' || host.endsWith('.mercadolibre.com')) return 'mercado_livre';
    } catch (_) {}
    return '';
  }
  function productFromHref(href) {
    try {
      const url = new URL(href, location.href);
      const query = url.searchParams.get('id');
      if (query) return slug(query);
      const name = (url.pathname.split('/').filter(Boolean).pop() || '').replace(/\.html$/i, '');
      const match = name.match(/^produto-(.+)$/i);
      return match ? slug(decodeURIComponent(match[1])) : '';
    } catch (_) { return ''; }
  }
  function productIdFor(anchor) {
    const direct = anchor.closest?.('[data-pnm-product-id]')?.dataset?.pnmProductId || anchor.closest?.('[data-product-id]')?.dataset?.productId || anchor.closest?.('article[data-id]')?.dataset?.id;
    if (direct) return slug(direct);
    if (info.page === 'produto' && info.product_id) return info.product_id;
    const root = anchor.closest?.('article,td,.product-card,.pnm-product-card,.pnm-offer-card,.smart-ad-card,.cs-product-card,.ps-product-card,.p4-product,.construction-product-card,.dw-card,.pnm-cart-item') || anchor.parentElement;
    const internal = root?.querySelector?.('a[href*="produto-"] , a[href*="produto?id="]');
    return productFromHref(internal?.getAttribute?.('href') || internal?.href || '') || 'unknown';
  }
  function placementFor(anchor) {
    if (anchor.closest?.('.dw-pending-card')) return 'dewalt_pending';
    if (info.page === 'produto') {
      if (anchor.closest?.('.sticky-offer,.sticky-buy')) return 'sticky';
      if (anchor.closest?.('.side-card')) return 'sidebar';
      if (anchor.closest?.('.related-block,.related-grid,.related-mini')) return 'related';
      return 'primary';
    }
    const byPage = { busca: 'search_result', salvos: 'saved', carrinho: 'cart', comparacao: 'comparison', projeto: 'project', casa_studio: 'studio', pequenos_espacos: 'small_spaces', obra_base: 'obra_base' };
    return byPage[info.page] || 'card';
  }

  function setupCommercialImpressions() {
    if (typeof IntersectionObserver !== 'function' || window.__PNM_M31_IMPRESSIONS_BOUND__) return;
    window.__PNM_M31_IMPRESSIONS_BOUND__ = true;

    const observedTargets = new WeakSet();
    const targetMeta = new WeakMap();
    const visibility = new WeakMap();
    const pending = new WeakMap();
    const impressed = new Set();

    function targetFor(anchor, placement) {
      if (placement === 'related') return anchor.closest?.('.related-mini,.related-card,.product-card') || anchor;
      return anchor.closest?.('article,td,.product-card,.pnm-product-card,.pnm-offer-card,.smart-ad-card') || anchor;
    }

    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const target = entry.target;
        const meta = targetMeta.get(target);
        if (!meta) continue;
        const eligible = Boolean(entry.isIntersecting) && Number(entry.intersectionRatio || 0) >= IMPRESSION_RATIO;
        visibility.set(target, eligible);
        const timer = pending.get(target);
        if (!eligible) {
          if (timer) clearTimeout(timer);
          pending.delete(target);
          continue;
        }
        if (impressed.has(meta.key) || timer) continue;
        pending.set(target, setTimeout(() => {
          pending.delete(target);
          if (target.isConnected === false || !visibility.get(target) || impressed.has(meta.key)) return;
          impressed.add(meta.key);
          api.track('commercial_impression', meta.data);
          observer.unobserve?.(target);
        }, IMPRESSION_DWELL_MS));
      }
    }, { threshold: [IMPRESSION_RATIO] });

    function consider(anchor) {
      if (!anchor) return;
      const href = anchor.href || anchor.getAttribute?.('href') || '';
      const store = storeFromHref(href);
      if (!store) return;
      const placement = placementFor(anchor);
      if (!IMPRESSION_PLACEMENTS.has(placement)) return;
      const productId = productIdFor(anchor);
      if (!productId || productId === 'unknown') return;
      const target = targetFor(anchor, placement);
      if (!target || observedTargets.has(target)) return;
      const key = `${info.page}|${productId}|${placement}`;
      observedTargets.add(target);
      targetMeta.set(target, {
        key,
        data: { product_id: productId, store, page: info.page, page_type: info.page_type, placement, ...journey }
      });
      observer.observe(target);
    }

    function scan(root) {
      if (!root) return;
      if (root.matches?.('a[href]')) consider(root);
      root.querySelectorAll?.('a[href]').forEach(consider);
    }

    scan(document);
    if (typeof MutationObserver === 'function' && document.body) {
      const mutations = new MutationObserver(records => {
        for (const record of records) for (const node of record.addedNodes || []) scan(node);
      });
      mutations.observe(document.body, { childList: true, subtree: true });
    }
  }

  setupCommercialImpressions();

  const handled = new WeakSet();
  if (!window.__PNM_M1_AFFILIATE_BOUND__) {
    window.__PNM_M1_AFFILIATE_BOUND__ = true;
    document.addEventListener('click', event => {
      if (handled.has(event)) return;
      handled.add(event);
      const anchor = event.target?.closest?.('a[href]');
      if (!anchor) return;
      const store = storeFromHref(anchor.href || anchor.getAttribute?.('href') || '');
      if (!store) return;
      const placement = placementFor(anchor);
      api.track('affiliate_click', { product_id: productIdFor(anchor), store, page: info.page, placement: PLACEMENTS.has(placement) ? placement : 'card', ...journey });
    }, true);
  }
})();