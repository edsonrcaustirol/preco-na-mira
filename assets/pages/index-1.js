(()=>{
  'use strict';
  const esc=(s='')=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const products=typeof PRODUTOS!=='undefined'&&Array.isArray(PRODUTOS)?PRODUTOS:[];
  const RECENT_KEY='precoNaMiraRecentes';

  function readRecent(){try{const value=JSON.parse(localStorage.getItem(RECENT_KEY)||'[]');return Array.isArray(value)?value.filter(Boolean).slice(0,18):[]}catch(_){return[]}}
  function clearRecent(){try{localStorage.removeItem(RECENT_KEY)}catch(_){};recent()}
  function hasUsefulImage(p){const image=String(p?.imagem||'');return p?.imagemTipo==='oficial'||/\.(?:webp|png|jpe?g|avif)(?:\?|$)/i.test(image)}
  function highlightLabel(p){if(p?.selo)return p.selo;if(p?.faixa)return p.faixa;if(p?.destaque)return'Destaque selecionado';return'Boa opção'}
  function chooseHighlights(limit=6){const eligible=products.filter(p=>p?.linkAfiliado&&(p.destaque||p.faixa||p.selo)).sort((a,b)=>(b.destaque?1:0)-(a.destaque?1:0)||(hasUsefulImage(b)?1:0)-(hasUsefulImage(a)?1:0)||String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR'));const pool=eligible.length?eligible:products.filter(p=>p?.linkAfiliado),selected=[],types=new Map(),brands=new Map();for(const p of pool){const type=String(p.tipoProduto||'outro'),brand=norm(p.marca||'');if((types.get(type)||0)>=2||brand&&(brands.get(brand)||0)>=1)continue;selected.push(p);types.set(type,(types.get(type)||0)+1);if(brand)brands.set(brand,(brands.get(brand)||0)+1);if(selected.length>=limit)break}for(const p of pool){if(selected.length>=limit)break;if(!selected.some(x=>x.id===p.id))selected.push(p)}return selected}
  function highlightCard(p,index){const image=p.imagem||p.imagemFallback||'assets/product-placeholder.svg',fallback=p.imagemFallback||'assets/product-placeholder.svg',category=p.categoria||p.tipoProduto||'Produto',loading=index===0?'eager':'lazy',priority=index===0?' fetchpriority="high"':'';return `<article class="smart-ad-card" data-pnm-product-id="${esc(p.id)}"><div class="smart-ad-inner is-compact"><a class="smart-ad-media" href="produto-${encodeURIComponent(p.id)}" aria-label="Analisar ${esc(p.nome)}"><span class="smart-ad-kicker">${esc(highlightLabel(p))}</span><img src="${esc(image)}" data-fallback-src="${esc(fallback)}" width="600" height="600" loading="${loading}" decoding="async"${priority} alt="${esc(p.imagemAlt||p.nome)}"></a><div class="smart-ad-copy"><small>${esc(p.marca||'Marca')} • ${esc(category)}</small><h3>${esc(p.nome)}</h3><p>${esc(p.chamada||p.resumo||'Veja a análise e confira se esta opção faz sentido para você.')}</p><div class="smart-ad-actions"><a href="produto-${encodeURIComponent(p.id)}">ANALISAR →</a><a class="offer" href="${esc(p.linkAfiliado)}" target="_blank" rel="sponsored nofollow noopener noreferrer">VER NO MERCADO LIVRE ↗</a></div></div></div></article>`}

  const offerGrid=document.getElementById('homeOfferGrid');
  if(offerGrid&&offerGrid.dataset.pnmPrerendered!=='1'){const highlights=chooseHighlights(6);offerGrid.innerHTML=highlights.length?highlights.map(highlightCard).join(''):'<div class="pnm-empty" data-empty-state>Nenhum destaque disponível neste momento. Use a busca para explorar o catálogo.</div>'}

  function recent(){const section=document.getElementById('recentSection'),grid=document.getElementById('recentGrid');if(!section||!grid)return;const list=readRecent().map(id=>products.find(p=>p.id===id)).filter(Boolean).slice(0,8);section.style.display=list.length?'block':'none';grid.innerHTML=list.map(p=>`<a class="recent-card" href="produto-${encodeURIComponent(p.id)}"><img src="${esc(p.imagem||p.imagemFallback||'assets/product-placeholder.svg')}" width="360" height="360" loading="lazy" decoding="async" alt="${esc(p.imagemAlt||p.nome)}"><b>${esc(p.nome)}</b><span>${esc(p.marca||'')}</span></a>`).join('')}
  document.getElementById('clearRecent')?.addEventListener('click',clearRecent);recent();

  const searchInput=document.getElementById('homeSearchInput'),suggest=document.getElementById('homeSearchSuggestions');
  if(searchInput&&suggest){function renderSuggestions(){const q=norm(searchInput.value.trim());if(q.length<2){suggest.hidden=true;suggest.innerHTML='';return}const matches=products.filter(p=>norm([p.nome,p.marca,p.categoria,p.tipoProduto,p.subtipoCasa,p.subtipoCozinha,p.subtipoLavanderia,p.subtipoGamer,p.subtipoAcessorio,p.subtipoObra,p.subtipoInstalacao,p.subtipoAcabamento].join(' ')).includes(q)).slice(0,6);suggest.hidden=false;suggest.innerHTML=matches.length?matches.map(p=>`<a href="produto-${encodeURIComponent(p.id)}"><img src="${esc(p.imagem||p.imagemFallback||'assets/product-placeholder.svg')}" width="56" height="56" loading="lazy" decoding="async" alt=""><span><b>${esc(p.nome)}</b><small>${esc(p.marca||'')}</small></span><strong>→</strong></a>`).join('')+`<a class="search-all" href="busca?q=${encodeURIComponent(searchInput.value)}">Ver todos os resultados →</a>`:`<a class="search-all" href="busca?q=${encodeURIComponent(searchInput.value)}">Buscar por “${esc(searchInput.value)}” em todo o catálogo →</a>`}searchInput.addEventListener('input',renderSuggestions);searchInput.addEventListener('focus',renderSuggestions);document.addEventListener('click',e=>{if(!e.target.closest('.home-search-field'))suggest.hidden=true})}
  document.querySelectorAll('.home-quick-searches [data-q]').forEach(button=>button.addEventListener('click',()=>{const q=button.dataset.q||'';if(searchInput)searchInput.value=q;location.href='busca?q='+encodeURIComponent(q)}));
})();

/* E1 TEMP NAV DEBUG START — remover integralmente após o diagnóstico. */
;(()=>{
  'use strict';

  let enabled=false;
  try {
    const params=new URLSearchParams(location.search);
    const homePath=location.pathname==='/'||/\/index\.html$/i.test(location.pathname);
    enabled=homePath&&params.get('pnm_nav_debug')==='1';
  } catch (_) {}
  if(!enabled)return;

  const DEBUG_MS=12000;
  const started=performance.now();
  const mutations=[];
  let observer=null;
  let timer=null;
  let observerActive=true;

  const elapsed=()=>Math.max(0,Math.round(performance.now()-started));
  const yesNo=value=>value?'SIM':'NÃO';
  const cleanClass=value=>String(value||'').replace(/\s+/g,' ').trim().slice(0,220)||'(vazio)';
  const safeUrl=value=>{
    if(!value)return'(inline)';
    try{const url=new URL(value,location.href);return `${url.origin}${url.pathname}`}catch(_){return'(inválida)'}
  };
  const safeLocation=()=>`${location.origin}${location.pathname}?pnm_nav_debug=1`;

  function snapshot(){
    const nav=document.getElementById('nav');
    const menu=document.getElementById('menu');
    const navCount=document.querySelectorAll('#nav').length;
    const navLinksCount=document.querySelectorAll('.nav-links').length;
    const media850=Boolean(window.matchMedia&&window.matchMedia('(max-width: 850px)').matches);
    const computed=nav?getComputedStyle(nav):null;
    const e1Link=document.querySelector('link[data-pnm-e1-mobile-critical],link[href*="pnm-e1-mobile-critical.css"]');
    const stylesheets=[...document.styleSheets].map(sheet=>safeUrl(sheet.href)).filter((value,index,array)=>array.indexOf(value)===index);
    const e1SheetLoaded=stylesheets.some(value=>/\/assets\/pnm-e1-mobile-critical\.css$/i.test(value));
    const hasOpen=Boolean(nav?.classList.contains('open'));
    const display=computed?.display||'(sem #nav)';
    return {
      nav,menu,navCount,navLinksCount,media850,computed,e1Link,stylesheets,e1SheetLoaded,hasOpen,display,
      closedButVisible:Boolean(nav&&!hasOpen&&display!=='none'),
      duplicateNav:navCount!==1||navLinksCount!==1,
      classChanged:mutations.length>0,
    };
  }

  function render(){
    const panel=document.getElementById('pnm-e1-nav-debug-panel');
    if(!panel)return;
    const state=snapshot();
    const e1Href=state.e1Link?safeUrl(state.e1Link.href):'(ausente)';
    const lines=[
      'PNM NAV DEBUG — E1 TEMP — SOMENTE LEITURA',
      `location.href: ${safeLocation()}`,
      `#nav: ${state.navCount} | .nav-links: ${state.navLinksCount}`,
      `className #nav: ${state.nav?cleanClass(state.nav.className):'(ausente)'}`,
      `aria-expanded #menu: ${state.menu?.getAttribute('aria-expanded')??'(ausente)'}`,
      `media850: ${yesNo(state.media850)}`,
      `display: ${state.display}`,
      `visibility: ${state.computed?.visibility||'(sem #nav)'}`,
      `opacity: ${state.computed?.opacity||'(sem #nav)'}`,
      `position: ${state.computed?.position||'(sem #nav)'}`,
      `pointer-events: ${state.computed?.pointerEvents||'(sem #nav)'}`,
      `z-index: ${state.computed?.zIndex||'(sem #nav)'}`,
      `max-height: ${state.computed?.maxHeight||'(sem #nav)'}`,
      `overflow: ${state.computed?.overflow||'(sem #nav)'}`,
      `CSS E1 link: ${yesNo(Boolean(state.e1Link))} | ${e1Href}`,
      `CSS E1 em document.styleSheets: ${yesNo(state.e1SheetLoaded)}`,
      '',
      `A) nav contém .open: ${yesNo(state.hasOpen)}`,
      `B) sem .open + display != none: ${state.closedButVisible?'SIM ⚠':'NÃO'}`,
      `C) CSS E1 ausente/não carregado: ${(!state.e1Link||!state.e1SheetLoaded)?'SIM ⚠':'NÃO'}`,
      `D) media850=false: ${!state.media850?'SIM ⚠':'NÃO'}`,
      `E) mais de um nav/menu: ${state.duplicateNav?'SIM ⚠':'NÃO'}`,
      `F) className mudou após início: ${state.classChanged?'SIM ⚠':'NÃO'}`,
      '',
      'stylesheets carregadas (sanitizadas):',
      ...(state.stylesheets.length?state.stylesheets.map(value=>`- ${value}`):['- nenhuma']),
      '',
      `MutationObserver: ${observerActive?'ATIVO':'ENCERRADO'} (${DEBUG_MS/1000}s)` ,
      ...(mutations.length?mutations.slice(-8).map(value=>`- ${value}`):['- nenhuma mudança de className observada']),
    ];
    panel.textContent=lines.join('\n');
  }

  function mount(){
    if(document.getElementById('pnm-e1-nav-debug-panel'))return;
    const panel=document.createElement('pre');
    panel.id='pnm-e1-nav-debug-panel';
    panel.setAttribute('aria-label','Diagnóstico temporário da navegação mobile');
    panel.style.cssText='position:fixed;left:6px;right:6px;bottom:6px;z-index:2147483647;margin:0;max-height:88vh;overflow:auto;padding:8px;border:1px solid rgba(255,255,255,.4);border-radius:8px;background:rgba(4,8,16,.96);color:#fff;font:9px/1.32 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;white-space:pre-wrap;word-break:break-word;pointer-events:none;text-align:left;box-shadow:0 10px 30px rgba(0,0,0,.45)';
    document.body.append(panel);

    const nav=document.getElementById('nav');
    if(nav&&typeof MutationObserver==='function'){
      observer=new MutationObserver(records=>{
        for(const record of records){
          if(record.type!=='attributes'||record.attributeName!=='class')continue;
          mutations.push(`${elapsed()}ms class: "${cleanClass(record.oldValue)}" → "${cleanClass(record.target.className)}"`);
        }
        render();
      });
      observer.observe(nav,{attributes:true,attributeFilter:['class'],attributeOldValue:true});
    }

    render();
    timer=setInterval(render,400);
    setTimeout(()=>{
      if(timer)clearInterval(timer);
      observer?.disconnect();
      observerActive=false;
      render();
    },DEBUG_MS);
  }

  if(document.body)mount();
  else document.addEventListener('DOMContentLoaded',mount,{once:true});
})();
/* E1 TEMP NAV DEBUG END */
