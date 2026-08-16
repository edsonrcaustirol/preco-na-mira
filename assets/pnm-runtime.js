/* Preço na Mira — visual refinement */
(()=>{
  'use strict';
  const d=document, root=d.documentElement;
  root.classList.add('pnm-premium');
  const prefersReduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const basename=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  d.querySelectorAll('.home-brand-line,.gamer-signal,.house-overline,.kicker,.gamer-overline').forEach(el=>{
    el.childNodes.forEach(n=>{
      if(n.nodeType===Node.TEXT_NODE)n.textContent=n.textContent.replace(/\s*[•\-]?\s*(?:EXPERIÊNCIA\s+|CATÁLOGO\s+)?V(?:14\.\d+|13\.\d+|12\.\d+)/ig,'').replace(/\s{2,}/g,' ');
    });
  });
  d.querySelectorAll('.nav-links a').forEach(a=>{
    try{const page=(new URL(a.href,location.href).pathname.split('/').pop()||'index.html').toLowerCase();if(page===basename)a.setAttribute('aria-current','page')}catch(_){}
  });
  const progress=d.createElement('div');progress.className='pnm-scroll-progress';progress.innerHTML='<i></i>';d.body.appendChild(progress);const progressBar=progress.firstElementChild;
  const updateProgress=()=>{const max=Math.max(1,d.documentElement.scrollHeight-innerHeight),pct=Math.min(100,Math.max(0,(scrollY/max)*100));progressBar.style.width=pct+'%'};addEventListener('scroll',updateProgress,{passive:true});updateProgress();
  if(!prefersReduced&&'IntersectionObserver' in window){
    const targets=[...d.querySelectorAll('main > section')].filter((el,i)=>i>0);targets.forEach(el=>el.classList.add('pnm-reveal'));
    const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');io.unobserve(e.target)}}),{threshold:.08,rootMargin:'0px 0px -5% 0px'});targets.forEach(el=>io.observe(el));
  }
  const finePointer=window.matchMedia&&window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  const enhanceSpotlight=el=>{if(!finePointer||el.classList.contains('pnm-spotlight'))return;el.classList.add('pnm-spotlight');if(!el.querySelector(':scope > .pnm-pointer-glow')){const glow=d.createElement('span');glow.className='pnm-pointer-glow';glow.setAttribute('aria-hidden','true');el.appendChild(glow)}el.addEventListener('pointermove',ev=>{const r=el.getBoundingClientRect();el.style.setProperty('--pnm-mx',`${ev.clientX-r.left}px`);el.style.setProperty('--pnm-my',`${ev.clientY-r.top}px`)},{passive:true})};
  d.querySelectorAll('.home-hero-main,.home-decision-panel,.gamer-rig-visual,.house-map,.product-card,.kitchen-product-card,.laundry-product,.gamer-route,.house-entry,.home-universe-card,.journey-card').forEach(enhanceSpotlight);
  function addMore(grid,keep,labelClosed='VER MAIS',labelOpen='VER MENOS'){
    if(!grid)return;const items=[...grid.children].filter(el=>!el.classList.contains('pnm-more-wrap'));if(items.length<=keep)return;const extras=items.slice(keep);extras.forEach(el=>el.classList.add('pnm-extra'));const wrap=d.createElement('div');wrap.className='pnm-more-wrap';const btn=d.createElement('button');btn.type='button';btn.className='pnm-more-btn';btn.textContent=labelClosed+' ↓';wrap.appendChild(btn);grid.after(wrap);btn.addEventListener('click',()=>{const open=!grid.classList.contains('pnm-expanded');grid.classList.toggle('pnm-expanded',open);extras.forEach(el=>el.classList.toggle('pnm-extra',!open));btn.textContent=(open?labelOpen:labelClosed)+(open?' ↑':' ↓');btn.setAttribute('aria-expanded',String(open))})
  }
  if(d.body.classList.contains('home-v121')){
    addMore(d.getElementById('homeJourneys'),4,'VER MAIS OPÇÕES','MOSTRAR MENOS');
    const official=d.getElementById('officialProductStrip');if(official){const holder=official.parentElement;official.classList.add('pnm-collapsible-content');const btn=d.createElement('button');btn.type='button';btn.className='pnm-section-toggle';btn.textContent='VER PRODUTOS COM FOTO →';holder.insertBefore(btn,official);btn.addEventListener('click',()=>{const open=official.classList.toggle('is-open');btn.textContent=open?'RECOLHER GALERIA ↑':'VER PRODUTOS COM FOTO →'})}
    const catalog=d.querySelector('.home-catalog-groups');if(catalog){catalog.classList.add('pnm-collapsible-content','pnm-fold-card');const section=catalog.closest('section'),head=section&&section.querySelector('.section-head'),btn=d.createElement('button');btn.type='button';btn.className='pnm-section-toggle';btn.textContent='ABRIR CATÁLOGO COMPLETO ↓';(head||catalog).after(btn);btn.addEventListener('click',()=>{const open=catalog.classList.toggle('is-open');btn.textContent=open?'FECHAR CATÁLOGO ↑':'ABRIR CATÁLOGO COMPLETO ↓'})}
  }
  if(d.body.classList.contains('gamer-v136'))addMore(d.getElementById('hub'),8,'VER TODO O ARSENAL','RECOLHER ARSENAL');
  let timer=0;const reEnhance=()=>{clearTimeout(timer);timer=setTimeout(()=>d.querySelectorAll('.product-card,.kitchen-product-card,.laundry-product').forEach(enhanceSpotlight),90)};
  if('MutationObserver' in window){const mo=new MutationObserver(reEnhance);d.querySelectorAll('#grid,#hub,.product-grid,.kitchen-product-grid,.laundry-product-grid').forEach(el=>mo.observe(el,{childList:true}))}
})();

;
/* Preço na Mira — Destaques Inteligentes */
(()=>{
  'use strict';
  const d=document;
  const ROTATE_MS=3000;
  const reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer=window.matchMedia&&window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  const norm=(s='')=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const esc=(s='')=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const tokens=s=>norm(s).split(/[^a-z0-9]+/).filter(x=>x.length>1);
  const hasRealPhoto=p=>p.imagemTipo==='oficial'||/\.(webp|png|jpe?g)$/i.test(String(p.imagem||''));
  const hay=p=>norm([
    p.nome,p.marca,p.categoria,p.resumo,p.chamada,p.selo,p.tipoProduto,
    p.subtipoCasa,p.subtipoCozinha,p.subtipoLavanderia,p.subtipoGamer,p.subtipoAcessorio,
    ...(p.chips||[]),...Object.keys(p.especificacoes||{}),...Object.values(p.especificacoes||{})
  ].join(' '));

  if(typeof PRODUTOS==='undefined') return;

  function readArray(key){try{const a=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(a)?a.filter(Boolean):[]}catch(_){return[]}}
  function interests(){
    const searches=(window.PNMRecentSearches?.get?.()||readArray('precoNaMiraBuscas')).slice(0,8);
    const recentIds=(window.PNMRecent?.get?.()||readArray('precoNaMiraRecentes')).slice(0,12);
    const viewed=recentIds.map(id=>PRODUTOS.find(p=>p.id===id)).filter(Boolean);
    const typeWeight=new Map(), brandWeight=new Map(), subtypeWeight=new Map();
    viewed.forEach((p,i)=>{
      const w=Math.max(1,6-i*.35);
      typeWeight.set(p.tipoProduto,(typeWeight.get(p.tipoProduto)||0)+w);
      if(p.marca) brandWeight.set(norm(p.marca),(brandWeight.get(norm(p.marca))||0)+w*.55);
      const sub=p.subtipoGamer||p.subtipoCasa||p.subtipoCozinha||p.subtipoLavanderia||p.subtipoAcessorio;
      if(sub) subtypeWeight.set(norm(sub),(subtypeWeight.get(norm(sub))||0)+w*.85);
    });
    return {searches,viewed,typeWeight,brandWeight,subtypeWeight};
  }

  function rankProducts(){
    const I=interests();
    const searchWords=I.searches.flatMap((s,i)=>tokens(s).map(t=>({t,w:Math.max(1,7-i*.55)})));
    const scored=PRODUTOS.map((p,idx)=>{
      const h=hay(p); let score=0;
      I.searches.forEach((s,i)=>{const n=norm(s); if(n&&h.includes(n)) score+=12-Math.min(i,6);});
      searchWords.forEach(({t,w})=>{if(h.includes(t)) score+=w;});
      score+=(I.typeWeight.get(p.tipoProduto)||0)*1.1;
      score+=(I.brandWeight.get(norm(p.marca))||0);
      const sub=norm(p.subtipoGamer||p.subtipoCasa||p.subtipoCozinha||p.subtipoLavanderia||p.subtipoAcessorio||'');
      score+=(I.subtypeWeight.get(sub)||0)*1.15;
      if(p.destaque) score+=2.4;
      if(hasRealPhoto(p)) score+=3.2;
      else if(p.imagem&&p.imagemTipo!=='fallback') score+=.8;
      if(I.viewed.some(v=>v.id===p.id)) score-=1.2; // favor descoberta, sem esconder o que já foi visto.
      score+=((idx*37)%17)/100; // desempate determinístico.
      return {p,score};
    }).sort((a,b)=>b.score-a.score);

    const hasSignals=I.searches.length||I.viewed.length;
    let pool=scored;
    if(!hasSignals) pool=scored.sort((a,b)=>((b.p.destaque?1:0)-(a.p.destaque?1:0))||((hasRealPhoto(b.p)?1:0)-(hasRealPhoto(a.p)?1:0))||b.score-a.score);

    // Preferência por produtos com foto real nos anúncios.
    const photoFirst=[...pool.filter(x=>hasRealPhoto(x.p)), ...pool.filter(x=>!hasRealPhoto(x.p))];

    // Diversidade: limita repetição excessiva de um mesmo tipo/marca.
    const out=[], types=new Map(), brands=new Map();
    for(const x of photoFirst){
      const t=x.p.tipoProduto||'outro', b=norm(x.p.marca||'');
      if((types.get(t)||0)>=4) continue;
      if(b&&(brands.get(b)||0)>=3) continue;
      out.push(x.p);types.set(t,(types.get(t)||0)+1);if(b)brands.set(b,(brands.get(b)||0)+1);
      if(out.length>=18) break;
    }
    if(out.length<12){for(const x of photoFirst){if(!out.some(p=>p.id===x.p.id))out.push(x.p);if(out.length>=18)break}}
    return {products:out,signals:I};
  }

  function reasonFor(p,I){
    const h=hay(p);
    const search=I.searches.find(s=>tokens(s).some(t=>h.includes(t)));
    if(search) return `Relacionado à sua busca “${search}”`;
    const typeHit=I.viewed.find(v=>v.tipoProduto===p.tipoProduto);
    if(typeHit) return `Porque você explorou ${typeHit.categoria||typeHit.tipoProduto}`;
    if(p.destaque) return 'Destaque selecionado do catálogo';
    return 'Uma descoberta para ampliar suas opções';
  }

  function productMarkup(p,reason,compact=false){
    const image=p.imagem||p.imagemFallback||'assets/product-placeholder.svg';
    const fallback=p.imagemFallback||'assets/product-placeholder.svg';
    return `<div class="smart-ad-inner ${compact?'is-compact':''}">
      <a class="smart-ad-media" href="produto-${encodeURIComponent(p.id)}.html" aria-label="Analisar ${esc(p.nome)}">
        <span class="smart-ad-kicker">${esc(reason)}</span>${hasRealPhoto(p)?`<span class="smart-photo-badge">FOTO</span>`:""}
        <img src="${esc(image)}" data-fallback-src="${esc(fallback)}" alt="${esc(p.imagemAlt||p.nome)}">
      </a>
      <div class="smart-ad-copy">
        <small>${esc(p.marca)} • ${esc(p.categoria)}</small>
        <h3>${esc(p.nome)}</h3>
        <p>${esc(p.chamada||p.resumo||'Veja os detalhes e compare antes de escolher.')}</p>
        <div class="smart-ad-actions">
          <a href="produto-${encodeURIComponent(p.id)}.html">ANALISAR →</a>
          ${p.linkAfiliado?`<a class="offer" href="${esc(p.linkAfiliado)}" target="_blank" rel="sponsored nofollow noopener noreferrer">VER OFERTA ↗</a>`:''}
        </div>
      </div>
    </div>`;
  }

  function makeRotator(card,queue,offset,signals,compact=false){
    let index=offset%queue.length, timer=null, paused=false;
    card.setAttribute('role','group');card.setAttribute('aria-roledescription','carrossel de produtos');
    const render=(animate=true)=>{
      const p=queue[index];card.classList.toggle('is-changing',animate&&!reduced);
      const swap=()=>{card.innerHTML=productMarkup(p,reasonFor(p,signals),compact)+`<div class="smart-ad-controls"><button type="button" data-dir="-1" aria-label="Produto anterior">‹</button><span>${index+1}/${queue.length}</span><button type="button" data-dir="1" aria-label="Próximo produto">›</button></div><i class="smart-ad-timer" aria-hidden="true"></i>`;bind();requestAnimationFrame(()=>card.classList.remove('is-changing'))};
      if(animate&&!reduced)setTimeout(swap,130);else swap();
    };
    const schedule=()=>{clearInterval(timer);if(reduced||paused)return;timer=setInterval(()=>{index=(index+1)%queue.length;render(true)},ROTATE_MS)};
    const bind=()=>card.querySelectorAll('[data-dir]').forEach(btn=>btn.onclick=e=>{e.preventDefault();e.stopPropagation();index=(index+Number(btn.dataset.dir)+queue.length)%queue.length;render(true);schedule()});
    card.addEventListener('mouseenter',()=>{paused=true;schedule()});
    card.addEventListener('mouseleave',()=>{paused=false;schedule()});
    card.addEventListener('focusin',()=>{paused=true;schedule()});
    card.addEventListener('focusout',()=>{paused=false;schedule()});
    document.addEventListener('visibilitychange',()=>{paused=d.hidden;schedule()});
    render(false);schedule();
  }

  function mountHome(){
    if(!d.body.classList.contains('home-v121')||d.getElementById('smartHighlights'))return;
    const anchor=d.querySelector('.home-how-section')||d.querySelector('.home-universe-section');if(!anchor)return;
    const {products,signals}=rankProducts();if(products.length<4)return;
    const personalized=signals.searches.length||signals.viewed.length;
    const section=d.createElement('section');section.className='smart-highlights-section';section.id='smartHighlights';
    section.innerHTML=`<div class="container">
      <div class="smart-highlights-head">
        <div><span class="home-section-label">VITRINE INTELIGENTE</span><h2>${personalized?'Destaques escolhidos para você.':'Produtos que merecem entrar no radar.'}</h2><p>${personalized?'Veja produtos mais alinhados com o que você pesquisou e abriu por aqui.':'Comece pesquisando e esta vitrine passa a mostrar opções mais relevantes para você.'}</p></div>
      </div>
      <div class="smart-ad-grid"><article class="smart-ad-card smart-ad-main" id="smartAd0"></article><article class="smart-ad-card" id="smartAd1"></article><article class="smart-ad-card" id="smartAd2"></article></div>
      <div class="smart-privacy-note"><span>◎</span><p><b>Personalização local.</b> O Preço na Mira usa apenas o histórico salvo neste navegador para reorganizar esta vitrine. Nenhum login é necessário.</p><button type="button" id="smartReset">REDEFINIR PERSONALIZAÇÃO</button></div>
    </div>`;
    anchor.after(section);
    const q0=products.slice(0,6),q1=[...products.slice(6,12),...products.slice(0,2)].slice(0,6),q2=[...products.slice(12,18),...products.slice(2,6)].slice(0,6);
    makeRotator(d.getElementById('smartAd0'),q0,0,signals,false);
    makeRotator(d.getElementById('smartAd1'),q1.length?q1:q0,1,signals,true);
    makeRotator(d.getElementById('smartAd2'),q2.length?q2:q0,2,signals,true);
    const reset=d.getElementById('smartReset');reset.onclick=()=>{try{localStorage.removeItem('precoNaMiraBuscas');localStorage.removeItem('precoNaMiraRecentes')}catch(_){};location.reload()};
  }

  // Record searches made from home too, including shortcut searches.
  function wireHomeSearch(){
    const form=d.getElementById('homeSearchForm'), input=d.getElementById('homeSearchInput');
    if(form&&input)form.addEventListener('submit',()=>{const q=input.value.trim();if(q&&window.PNMRecentSearches?.add)PNMRecentSearches.add(q)}, {capture:true});
    d.querySelectorAll('.home-quick-searches [data-q]').forEach(btn=>btn.addEventListener('click',()=>{const q=btn.dataset.q;if(q&&window.PNMRecentSearches?.add)PNMRecentSearches.add(q)}, {capture:true}));
  }

  // Update the showcase on storage changes without making the rest of the page jump repeatedly.
  mountHome();wireHomeSearch();

  // Add a subtle active glow on cards, but only for precise pointers.
  if(finePointer)d.querySelectorAll('.smart-ad-card').forEach(card=>card.addEventListener('pointermove',e=>{const r=card.getBoundingClientRect();card.style.setProperty('--smart-x',`${e.clientX-r.left}px`);card.style.setProperty('--smart-y',`${e.clientY-r.top}px`)}));
})();

;
(function(){
  const doc=document;
  const $=(s,r=doc)=>r.querySelector(s);
  const $$=(s,r=doc)=>Array.from(r.querySelectorAll(s));
  const decisionTabs=$$('#decisionTabs button');
  const radarOptions=$$('.radar-option');
  if(decisionTabs.length){
    const sync=(mode)=>{
      decisionTabs.forEach(btn=>btn.classList.toggle('active',btn.dataset.mode===mode));
      radarOptions.forEach(btn=>btn.classList.toggle('active',btn.dataset.mode===mode));
      const active=decisionTabs.find(btn=>btn.dataset.mode===mode);
      if(active && !active.__firing){
        active.__firing=true;
        active.click();
        setTimeout(()=>active.__firing=false,0);
      }
    };
    radarOptions.forEach(btn=>btn.addEventListener('click',()=>sync(btn.dataset.mode)));
    decisionTabs.forEach(btn=>btn.addEventListener('click',()=>{radarOptions.forEach(x=>x.classList.toggle('active',x.dataset.mode===btn.dataset.mode));}));
    const current=decisionTabs.find(btn=>btn.classList.contains('active'))||decisionTabs[0];
    if(current) radarOptions.forEach(btn=>btn.classList.toggle('active',btn.dataset.mode===current.dataset.mode));
  }

  const revealTargets=$$('.product-card,.mini-card,.journey-card,.universe-card,.home-how-grid article,.home-universe-grid-v121 .home-universe-card,.home-house-path article,.panel,.side-card,.category-portal-card,.smart-ad-card');
  if('IntersectionObserver' in window && revealTargets.length){
    const io=new IntersectionObserver((entries)=>{
      entries.forEach((e)=>{
        if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}
      })
    },{threshold:.12,rootMargin:'0px 0px -20px 0px'});
    revealTargets.forEach((el,i)=>{el.classList.add('reveal-pnm');el.style.transitionDelay=(Math.min(i%6,5)*35)+'ms';io.observe(el)});
  }
})();

;
(()=>{const d=document;const clean=(s='')=>String(s).replace(/\s+/g,' ').trim();
// Remove visible legacy version fragments that escaped earlier templates.
d.querySelectorAll('span,small,b,strong').forEach(el=>{if(el.children.length)return;const t=el.textContent||'';if(/\bV(?:13|14)\.\d\b/i.test(t))el.textContent=clean(t.replace(/\s*[•\-]?\s*V(?:13|14)\.\d\b/ig,''));});
// Turn empty/legacy topbar copy into a concise trust line on public pages.
const top=d.querySelector('.topbar:not(.home-topbar)');if(top&&!d.body.classList.contains('catalog-admin')&&top.textContent.length>90)top.textContent='Conteúdo independente • Alguns links podem gerar comissão, sem custo extra para você.';
// Ensure mobile menu works even on older pages with inline handlers removed/overridden.
const m=d.getElementById('menu'),n=d.getElementById('nav');if(m&&n&&!m.dataset.consolidated){m.dataset.consolidated='1';m.addEventListener('click',()=>n.classList.toggle('open'));}
})();

;
/* Preço na Mira — navegação consolidada V17.2.1 */
(()=>{
  const old=document.getElementById('menu'),nav=document.getElementById('nav');
  if(!old||!nav)return;
  // Replace the button node to discard legacy listeners from page-level scripts/runtimes.
  const menu=old.cloneNode(true);old.replaceWith(menu);
  const sync=()=>{const open=nav.classList.contains('open');menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Fechar menu':'Abrir menu')};
  menu.dataset.pnmMenuOwner='1';
  menu.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();nav.classList.toggle('open');sync()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav.classList.contains('open')){nav.classList.remove('open');sync();menu.focus()}});
  document.addEventListener('click',e=>{if(nav.classList.contains('open')&&!nav.contains(e.target)&&e.target!==menu){nav.classList.remove('open');sync()}},{passive:true});
  nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');sync()}));
  sync();
})();
