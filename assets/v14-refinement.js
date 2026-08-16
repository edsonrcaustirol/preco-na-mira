/* Preço na Mira V14.0 — progressive visual refinement */
(()=>{
  'use strict';
  const d=document, root=d.documentElement;
  root.classList.add('pnm-v14');
  const prefersReduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const basename=(location.pathname.split('/').pop()||'/').toLowerCase();
  d.querySelectorAll('.home-brand-line b,.gamer-signal,.house-overline,.kicker,.gamer-overline').forEach(el=>{
    if(/V13\.6|V13\.7|V12\.\d/i.test(el.textContent||'')) el.innerHTML=el.innerHTML.replace(/V(?:13\.6|13\.7|12\.\d)/ig,'V14.0');
  });
  d.querySelectorAll('.nav-links a').forEach(a=>{
    try{const page=(new URL(a.href,location.href).pathname.split('/').pop()||'/').toLowerCase();if(page===basename)a.setAttribute('aria-current','page')}catch(_){}
  });
  const progress=d.createElement('div');progress.className='pnm-scroll-progress';progress.innerHTML='<i></i>';d.body.appendChild(progress);const progressBar=progress.firstElementChild;
  const updateProgress=()=>{const max=Math.max(1,d.documentElement.scrollHeight-innerHeight),pct=Math.min(100,Math.max(0,(scrollY/max)*100));progressBar.style.width=pct+'%'};addEventListener('scroll',updateProgress,{passive:true});updateProgress();
  if(!prefersReduced&&'IntersectionObserver' in window){
    const targets=[...d.querySelectorAll('main > section')].filter((el,i)=>i>0);targets.forEach(el=>el.classList.add('pnm-v14-reveal'));
    const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');io.unobserve(e.target)}}),{threshold:.08,rootMargin:'0px 0px -5% 0px'});targets.forEach(el=>io.observe(el));
  }
  const finePointer=window.matchMedia&&window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  const enhanceSpotlight=el=>{if(!finePointer||el.classList.contains('pnm-v14-spotlight'))return;el.classList.add('pnm-v14-spotlight');if(!el.querySelector(':scope > .pnm-pointer-glow')){const glow=d.createElement('span');glow.className='pnm-pointer-glow';glow.setAttribute('aria-hidden','true');el.appendChild(glow)}el.addEventListener('pointermove',ev=>{const r=el.getBoundingClientRect();el.style.setProperty('--pnm-mx',`${ev.clientX-r.left}px`);el.style.setProperty('--pnm-my',`${ev.clientY-r.top}px`)},{passive:true})};
  d.querySelectorAll('.home-hero-main,.home-decision-panel,.gamer-rig-visual,.house-map,.product-card,.kitchen-product-card,.laundry-product,.gamer-route,.house-entry,.home-universe-card,.journey-card').forEach(enhanceSpotlight);
  function addMore(grid,keep,labelClosed='VER MAIS',labelOpen='VER MENOS'){
    if(!grid)return;const items=[...grid.children].filter(el=>!el.classList.contains('pnm-more-wrap'));if(items.length<=keep)return;const extras=items.slice(keep);extras.forEach(el=>el.classList.add('pnm-v14-extra'));const wrap=d.createElement('div');wrap.className='pnm-more-wrap';const btn=d.createElement('button');btn.type='button';btn.className='pnm-more-btn';btn.textContent=labelClosed+' ↓';wrap.appendChild(btn);grid.after(wrap);btn.addEventListener('click',()=>{const open=!grid.classList.contains('pnm-v14-expanded');grid.classList.toggle('pnm-v14-expanded',open);extras.forEach(el=>el.classList.toggle('pnm-v14-extra',!open));btn.textContent=(open?labelOpen:labelClosed)+(open?' ↑':' ↓');btn.setAttribute('aria-expanded',String(open))})
  }
  if(d.body.classList.contains('home-v121')){
    addMore(d.getElementById('homeJourneys'),4,'VER MAIS JORNADAS','MOSTRAR MENOS');
    const official=d.getElementById('officialProductStrip');if(official){const holder=official.parentElement;official.classList.add('pnm-collapsible-content');const btn=d.createElement('button');btn.type='button';btn.className='pnm-section-toggle';btn.textContent='VER PRODUTOS COM FOTO →';holder.insertBefore(btn,official);btn.addEventListener('click',()=>{const open=official.classList.toggle('is-open');btn.textContent=open?'RECOLHER GALERIA ↑':'VER PRODUTOS COM FOTO →'})}
    const catalog=d.querySelector('.home-catalog-groups');if(catalog){catalog.classList.add('pnm-collapsible-content','pnm-fold-card');const section=catalog.closest('section'),head=section&&section.querySelector('.section-head'),btn=d.createElement('button');btn.type='button';btn.className='pnm-section-toggle';btn.textContent='ABRIR CATÁLOGO COMPLETO ↓';(head||catalog).after(btn);btn.addEventListener('click',()=>{const open=catalog.classList.toggle('is-open');btn.textContent=open?'FECHAR CATÁLOGO ↑':'ABRIR CATÁLOGO COMPLETO ↓'})}
  }
  if(d.body.classList.contains('gamer-v136'))addMore(d.getElementById('hub'),8,'VER TODO O ARSENAL','RECOLHER ARSENAL');
  let timer=0;const reEnhance=()=>{clearTimeout(timer);timer=setTimeout(()=>d.querySelectorAll('.product-card,.kitchen-product-card,.laundry-product').forEach(enhanceSpotlight),90)};
  if('MutationObserver' in window){const mo=new MutationObserver(reEnhance);d.querySelectorAll('#grid,#hub,.product-grid,.kitchen-product-grid,.laundry-product-grid').forEach(el=>mo.observe(el,{childList:true}))}
})();
