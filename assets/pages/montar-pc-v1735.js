(()=>{
  'use strict';
  const root=document.getElementById('steps');
  if(!root)return;
  const fallback='assets/product-photo-unavailable.svg';
  const esc=(value='')=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const catalog=()=>typeof PRODUTOS!=='undefined'?PRODUTOS:[];
  const byId=id=>catalog().find(product=>product.id===id);
  const imageOf=product=>product?.imagem||product?.imagemFallback||fallback;
  const chips=(product,limit=3)=>(product?.chips||[]).slice(0,limit).map(chip=>`<span>${esc(chip)}</span>`).join('');
  let scheduled=false;

  function bindFallbacks(scope){
    scope.querySelectorAll('img[data-v1735-fallback]:not([data-v1735-ready])').forEach(img=>{
      img.dataset.v1735Ready='1';
      img.addEventListener('error',()=>{if(img.src&&!img.src.endsWith(fallback))img.src=fallback});
    });
  }

  function cardMarkup(product,selected){
    return `<button class="pc-choice-card v1735-card" type="button" data-pc-select="${esc(product.id)}" aria-pressed="${selected}" aria-label="Selecionar ${esc(product.nome)}"><span class="pc-choice-check">✓</span><span class="pc-choice-photo"><img src="${esc(imageOf(product))}" data-v1735-fallback="1" alt="${esc(product.imagemAlt||product.nome)}" loading="lazy" decoding="async"></span><small>${esc(product.marca||product.selo||'Produto')}</small><strong>${esc(product.nome)}</strong><span class="v1735-card-specs">${chips(product,2)}</span></button>`;
  }

  function featureMarkup(product,selected,stageLabel,preview){
    if(!product)return '';
    const state=selected?'PEÇA INSTALADA':preview?'PRÉVIA AO VIVO':'PRÉVIA DA ETAPA';
    const offer=selected&&product.linkAfiliado?`<a class="v1735-offer" href="${esc(product.linkAfiliado)}" target="_blank" rel="sponsored nofollow noopener noreferrer">VER OFERTA ↗</a>`:'';
    return `<div class="pc-stage-feature ${selected?'selected':''} ${preview&&!selected?'v1735-previewing':''}" data-v1735-feature="${esc(product.id)}"><div class="pc-feature-state"><span>${state}</span><i></i></div><div class="pc-feature-image"><img src="${esc(imageOf(product))}" data-v1735-fallback="1" alt="${esc(product.imagemAlt||product.nome)}" loading="lazy" decoding="async"></div><div class="pc-feature-copy"><small>${esc(product.marca||stageLabel)} • ${esc(product.selo||'CATÁLOGO')}</small><h4>${esc(product.nome)}</h4><p class="v1735-feature-description">${esc(product.chamada||product.resumo||'Compare a proposta e confirme os detalhes antes de comprar.')}</p><div class="pc-feature-chips">${chips(product,3)}</div><div class="pc-feature-actions"><button type="button" data-v1735-install="${esc(product.id)}" ${selected?'disabled':''}>${selected?'✓ INSTALADA':'ADICIONAR AO SETUP'}</button><a href="produto-${encodeURIComponent(product.id)}.html">VER FICHA →</a>${offer}</div></div></div>`;
  }

  function renderFeature(stage,select,product,stageLabel,preview=false){
    const current=stage.querySelector('.pc-stage-feature');
    if(!current||!product)return;
    current.outerHTML=featureMarkup(product,product.id===select.value,stageLabel,preview);
    bindFallbacks(stage);
    const button=stage.querySelector('[data-v1735-install]:not([disabled])');
    if(button)button.addEventListener('click',()=>{
      select.value=button.dataset.v1735Install;
      select.dispatchEvent(new Event('change',{bubbles:true}));
    });
  }

  function enhanceStep(article){
    const select=article.querySelector('select[data-key]');
    const stage=article.querySelector('.pc-stage-grid');
    if(!select||!stage)return;
    const stageLabel=(article.querySelector('h3')?.textContent||'Etapa').replace(/^\d+\.\s*/,'').trim();
    const products=[...select.options].filter(o=>o.value).map(o=>byId(o.value)).filter(Boolean);
    const grid=stage.querySelector('.pc-choice-grid');
    if(!grid)return;

    const existing=new Set([...grid.querySelectorAll('[data-pc-select]')].map(el=>el.dataset.pcSelect));
    products.slice(0,9).forEach(product=>{
      if(existing.has(product.id))return;
      grid.insertAdjacentHTML('beforeend',cardMarkup(product,product.id===select.value));
    });

    grid.querySelectorAll('.pc-choice-card').forEach(card=>{
      const product=byId(card.dataset.pcSelect);
      if(!product)return;
      if(!card.querySelector('.v1735-card-specs'))card.insertAdjacentHTML('beforeend',`<span class="v1735-card-specs">${chips(product,2)}</span>`);
      if(card.dataset.v1735Bound==='1')return;
      card.dataset.v1735Bound='1';
      const preview=()=>renderFeature(stage,select,product,stageLabel,product.id!==select.value);
      const restore=()=>renderFeature(stage,select,byId(select.value)||products[0],stageLabel,false);
      card.addEventListener('mouseenter',preview);
      card.addEventListener('mouseleave',restore);
      card.addEventListener('focus',preview);
      card.addEventListener('blur',restore);
      if(!existing.has(product.id))card.addEventListener('click',()=>{
        select.value=product.id;
        select.dispatchEvent(new Event('change',{bubbles:true}));
      });
    });

    const current=byId(select.value)||products[0];
    if(current&&stage.dataset.v1735Ready!=='1'){
      stage.dataset.v1735Ready='1';
      renderFeature(stage,select,current,stageLabel,false);
    }
    const label=article.querySelector('.pc-all-options-label b');
    if(label)label.textContent=products.length>9?`+ ${products.length-9} opções no seletor`:'TODAS VISÍVEIS';
    bindFallbacks(stage);
  }

  function enhance(){
    scheduled=false;
    root.querySelectorAll('.builder-step.pnm-immersive-step').forEach(enhanceStep);
    document.documentElement.dataset.pnmPcV1735='ready';
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(enhance)}
  new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
  schedule();
  setTimeout(schedule,220);
})();
