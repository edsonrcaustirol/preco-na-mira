;(() => {
  'use strict';
  if (window.PNMAnalytics?.__m1 === true) return;

  const ENDPOINT = '/__pnm/analytics';
  const TRAFFIC_KEY = 'pnm:m1:traffic';
  const PLACEMENTS = new Set(['card','primary','sidebar','sticky','related','search_result','saved','cart','comparison','project','studio','small_spaces','obra_base','dewalt_pending']);
  const IMPRESSION_PLACEMENTS = new Set(['card','related']);
  const IMPRESSION_RATIO = 0.5;
  const IMPRESSION_DWELL_MS = 500;
  const EVENT_FIELDS = {
    page_view: new Set(['page','page_type','product_id','utm_source','utm_medium','utm_campaign','referrer_host']),
    affiliate_click: new Set(['product_id','store','page','placement','utm_source','utm_medium','utm_campaign','referrer_host']),
    commercial_impression: new Set(['product_id','store','page','page_type','placement','utm_source','utm_medium','utm_campaign','referrer_host'])
  };

  const clean = (value, max = 120) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
  const slug = (value, fallback = 'unknown', max = 120) => {
    const out = clean(value, max).toLowerCase().replace(/[^a-z0-9._/-]+/g, '_').replace(/^_+|_+$/g, '');
    return out || fallback;
  };
  const safeCampaign = value => clean(value, 120).replace(/[^\p{L}\p{N} _./:-]/gu, '').slice(0, 120);

  function routeInfo() {
    const path = location.pathname.replace(/\/?index\.html$/i, '/').replace(/\.html$/i, '').replace(/\/$/, '') || '/';
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

  function readTraffic() {
    const url = new URL(location.href);
    const current = {
      utm_source: slug(url.searchParams.get('utm_source') || '', '', 80),
      utm_medium: slug(url.searchParams.get('utm_medium') || '', '', 80),
      utm_campaign: safeCampaign(url.searchParams.get('utm_campaign') || ''),
      referrer_host: ''
    };
    try {
      if (document.referrer) {
        const ref = new URL(document.referrer);
        if (ref.hostname && ref.hostname !== location.hostname) current.referrer_host = clean(ref.hostname.toLowerCase(), 120);
      }
    } catch (_) {}
    const hasCurrent = Object.values(current).some(Boolean);
    try {
      if (hasCurrent) sessionStorage.setItem(TRAFFIC_KEY, JSON.stringify(current));
      else {
        const prior = JSON.parse(sessionStorage.getItem(TRAFFIC_KEY) || '{}');
        return {
          utm_source: slug(prior.utm_source || '', '', 80), utm_medium: slug(prior.utm_medium || '', '', 80),
          utm_campaign: safeCampaign(prior.utm_campaign || ''), referrer_host: clean(prior.referrer_host || '', 120)
        };
      }
    } catch (_) {}
    return current;
  }

  function sanitize(eventName, data) {
    const allowed = EVENT_FIELDS[eventName];
    if (!allowed) return null;
    const out = {};
    for (const key of allowed) {
      if (!(key in (data || {}))) continue;
      const value = key === 'utm_campaign' ? safeCampaign(data[key]) : (['page','page_type','product_id','store','placement','utm_source','utm_medium'].includes(key) ? slug(data[key], '', key === 'product_id' ? 120 : 80) : clean(data[key], 120));
      if (value) out[key] = value;
    }
    if (eventName === 'page_view' && (!out.page || !out.page_type)) return null;
    if (eventName === 'affiliate_click' && (!out.product_id || !out.store || !out.page || !out.placement)) return null;
    if (eventName === 'commercial_impression' && (!out.product_id || !out.store || !out.page || !out.page_type || !IMPRESSION_PLACEMENTS.has(out.placement))) return null;
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
  const traffic = readTraffic();
  if (!window.__PNM_M1_PAGE_VIEW__) {
    window.__PNM_M1_PAGE_VIEW__ = true;
    api.track('page_view', { page: info.page, page_type: info.page_type, ...(info.product_id ? { product_id: info.product_id } : {}), ...traffic });
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
          if (!visibility.get(target) || impressed.has(meta.key)) return;
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
      const target = targetFor(anchor, placement);
      if (!target || observedTargets.has(target)) return;
      const key = `${info.page}|${productId}|${placement}`;
      observedTargets.add(target);
      targetMeta.set(target, {
        key,
        data: { product_id: productId, store, page: info.page, page_type: info.page_type, placement, ...traffic }
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
      api.track('affiliate_click', { product_id: productIdFor(anchor), store, page: info.page, placement: PLACEMENTS.has(placement) ? placement : 'card', ...traffic });
    }, true);
  }
})();
