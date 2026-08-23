(() => {
  'use strict';

  const VERSION = '18.2.0';
  const root = document.documentElement;
  const path = location.pathname.toLowerCase();
  const productFallback = 'assets/product-photo-unavailable.svg';
  const navDescriptions = {
    'universos': 'Explore produtos por contexto, ambiente e tipo de uso.',
    'ofertas': 'Descubra produtos em destaque e oportunidades selecionadas.',
    'catalogo': 'Busque todos os produtos por marca, categoria ou nome.',
  };

  const e1Stylesheet = document.createElement('link');
  e1Stylesheet.rel = 'stylesheet';
  e1Stylesheet.href = 'assets/pnm-e1-mobile-critical.css';
  e1Stylesheet.dataset.pnmE1MobileCritical = '1';
  if (!document.querySelector('link[data-pnm-e1-mobile-critical]')) document.head.append(e1Stylesheet);

  const area = /(?:gamer|montar-pc|pecas-pc|produto-(?:amd|intel|asus|asrock|gigabyte|msi|corsair|cooler|montech|be-quiet|redragon|hyperx|logitech|kingston))/.test(path)
    ? 'gamer'
    : /(?:casa|cozinha|lavanderia|obra|acabamento|instalacao|compact|dewalt|banheiro|ambiente-casa)/.test(path)
      ? 'casa'
      : /(?:tecnologia|smartphone|tablet|notebook|monitor|fone|soundbar|tv|internet|projetor|ecossistema|acessorios-tech)/.test(path)
        ? 'tecnologia'
        : 'marca';

  root.dataset.pnmArea = area;
  root.dataset.pnmVersion = VERSION;
  window.PNM_VERSION = VERSION;

  function markMissingImage(image) {
    if (!(image instanceof HTMLImageElement) || image.dataset.pnmMissingHandled === '1') return;
    image.dataset.pnmMissingHandled = '1';
    image.classList.add('pnm-image-missing');
    const wrapper = image.closest('.product-media,.product-image,.product-detail-media,.kitchen-product-media,.laundry-product-media,.gamer-product-media,.pc-choice-photo,.pc-feature-image,.pnm-catalog-media,.pnm-offer-media,.smart-ad-media');
    wrapper?.classList.add('pnm-image-unavailable');
    if (!image.alt || /foto do produto/i.test(image.alt)) image.alt = `Imagem indisponível — ${image.alt.replace(/^Foto do produto\s*/i, '') || 'produto'}`;
    if (!image.src.endsWith(productFallback)) image.src = productFallback;
  }

  document.addEventListener('error', event => {
    if (event.target instanceof HTMLImageElement) markMissingImage(event.target);
  }, true);

  function normalizeRoute(value) {
    try {
      const url = new URL(value, location.href);
      return url.pathname.replace(/\/?index\.html$/i, '/').replace(/\.html$/i, '').replace(/\/$/, '') || '/';
    } catch {
      return value;
    }
  }

  function resetMobileNavState() {
    const nav = document.getElementById('nav');
    const menu = document.getElementById('menu');
    if (!nav || !menu) return;
    if (window.matchMedia && !window.matchMedia('(max-width: 850px)').matches) return;
    nav.classList.remove('open');
    menu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-label', 'Abrir menu');
  }

  function normalizeAffiliate(link) {
    if (!(link instanceof HTMLAnchorElement) || !/meli\.la|mercadolivre/i.test(link.href)) return;
    const rel = new Set((link.rel || '').split(/\s+/).filter(Boolean));
    ['noopener', 'noreferrer', 'sponsored', 'nofollow'].forEach(value => rel.add(value));
    link.rel = [...rel].join(' ');
    const text = link.textContent.trim();
    const generic = /^(?:ver\s+(?:oferta|na\s+loja|pre[cç]o)|comprar|oferta|ir\s+para\s+(?:a\s+)?loja)\s*[↗→]?$/i;
    if (text && generic.test(text) && !link.querySelector('img,svg')) link.textContent = 'VER NO MERCADO LIVRE ↗';
    if (!link.getAttribute('aria-label') || /ver oferta|ver na loja|comprar/i.test(link.getAttribute('aria-label'))) {
      link.setAttribute('aria-label', 'Ver no Mercado Livre — abre em nova aba');
    }
    if (!link.title) link.title = 'Abre o anúncio no Mercado Livre em nova aba';
  }

  function onReady() {
    resetMobileNavState();

    const main = document.querySelector('main');
    if (main && !main.id) main.id = 'conteudo-principal';
    if (main && !document.querySelector('.pnm-skip-link')) {
      const skip = document.createElement('a');
      skip.className = 'pnm-skip-link';
      skip.href = '#conteudo-principal';
      skip.textContent = 'Pular para o conteúdo';
      document.body.prepend(skip);
    }

    const current = normalizeRoute(location.href);
    document.querySelectorAll('.nav-links a').forEach(link => {
      const route = normalizeRoute(link.href);
      if (route === current) link.setAttribute('aria-current', 'page');
      const key = route.replace(/^\//, '');
      if (navDescriptions[key]) {
        link.title = navDescriptions[key];
        link.dataset.pnmDescription = navDescriptions[key];
      }
    });

    document.querySelectorAll('a[target="_blank"]').forEach(link => {
      const rel = new Set((link.rel || '').split(/\s+/).filter(Boolean));
      rel.add('noopener');
      rel.add('noreferrer');
      link.rel = [...rel].join(' ');
      normalizeAffiliate(link);
    });
    document.querySelectorAll('a[href]').forEach(normalizeAffiliate);
    new MutationObserver(records => records.forEach(record => {
      record.addedNodes.forEach(node => {
        if (!(node instanceof Element)) return;
        if (node.matches?.('a[href]')) normalizeAffiliate(node);
        node.querySelectorAll?.('a[href]').forEach(normalizeAffiliate);
      });
    })).observe(document.body, { childList: true, subtree: true });

    const images = [...document.images];
    images.forEach((image, index) => {
      if (!image.alt && image.getAttribute('aria-hidden') !== 'true' && image.getAttribute('role') !== 'presentation') {
        const context = image.closest('article,section,figure')?.querySelector('h1,h2,h3,h4')?.textContent?.trim();
        image.alt = context ? `Imagem de ${context}` : 'Imagem do Preço na Mira';
      }
      if (!image.loading && index > 1 && !image.closest('.site-header')) image.loading = 'lazy';
      image.decoding = image.decoding || 'async';
      if (image.complete && image.naturalWidth === 0) markMissingImage(image);
    });

    document.querySelectorAll('button:not([type])').forEach(button => {
      if (!button.closest('form') || button.dataset.pnmSubmit !== undefined) button.type = 'button';
    });

    const syncDisabledAnchor = anchor => {
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const disabled = anchor.classList.contains('disabled') && anchor.getAttribute('href') === '#';
      if (disabled) {
        anchor.setAttribute('aria-disabled', 'true');
        anchor.setAttribute('tabindex', '-1');
        anchor.dataset.pnmManagedDisabled = '1';
      } else if (anchor.dataset.pnmManagedDisabled === '1') {
        anchor.removeAttribute('aria-disabled');
        anchor.removeAttribute('tabindex');
        delete anchor.dataset.pnmManagedDisabled;
      }
    };
    document.querySelectorAll('a.disabled[href="#"]').forEach(syncDisabledAnchor);
    document.addEventListener('click', event => {
      const anchor = event.target.closest?.('a.disabled[href="#"]');
      if (anchor) event.preventDefault();
    }, true);
    new MutationObserver(records => records.forEach(record => syncDisabledAnchor(record.target)))
      .observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class', 'href'] });

    document.querySelectorAll('.empty,.pnm-empty,[data-empty-state]').forEach(element => {
      if (!element.hasAttribute('role')) element.setAttribute('role', 'status');
      element.setAttribute('aria-live', 'polite');
    });

    if (/^\/produto-[^/]+\/?$/.test(path) && !document.querySelector('.pnm-price-disclaimer')) {
      const cta = document.querySelector('.cta-box,.product-info .affiliate-note,.sticky-buy');
      if (cta) {
        const note = document.createElement('p');
        note.className = 'pnm-price-disclaimer';
        note.textContent = 'Preço, frete, estoque e disponibilidade são definidos pelo Mercado Livre e podem mudar sem aviso.';
        cta.append(note);
      }
    }

    const connectivity = document.createElement('div');
    connectivity.className = 'pnm-connectivity';
    connectivity.setAttribute('role', 'status');
    connectivity.setAttribute('aria-live', 'polite');
    connectivity.textContent = 'Você está sem conexão. Os produtos salvos continuam neste navegador.';
    document.body.append(connectivity);
    const syncConnectivity = () => connectivity.classList.toggle('is-visible', !navigator.onLine);
    addEventListener('online', syncConnectivity);
    addEventListener('offline', syncConnectivity);
    syncConnectivity();

    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const dialog = document.querySelector('[role="dialog"].open,[role="dialog"][open],.modal.open,.popup.open,.drawer.open');
      const close = dialog?.querySelector('[data-close],.close,[aria-label*="Fechar" i]');
      if (close instanceof HTMLElement) close.click();
    });

    root.classList.add('pnm-platform-ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady, { once: true });
  else onReady();

  addEventListener('pageshow', resetMobileNavState);
  addEventListener('pagehide', resetMobileNavState);
})();