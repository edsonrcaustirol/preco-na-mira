(()=>{
  'use strict';
  const root=document.getElementById('steps');
  if(!root)return;
  const esc=(value='')=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const catalog=()=>typeof PRODUTOS!=='undefined'?PRODUTOS:(window.PRODUTOS||[]);
  const byId=id=>catalog().find(product=>product.id===id);
  const fallback='assets/product-photo-unavailable.svg';
  const imageOf=product=>product?.imagem||product?.imagemFallback||fallback;
  const stageKeys=['cpu','motherboard','ram','gpu','ssd','psu','case','cooling','monitor','keyboard','mouse'];
  const shortLabels=['CPU','PLACA','RAM','GPU','SSD','FONTE','GABINETE','COOLER'];
  const iconLabels=['🧠','🧩','⚡','🎮','💾','🔌','🖥️','❄️'];
  let scheduled=false;

  const portal=document.createElement('aside');
  portal.id='pcHoverPreview';
  portal.className='pc-hover-preview';
  portal.setAttribute('aria-hidden','true');
  document.body.appendChild(portal);

  function safeImageMarkup(product,className=''){
    return `<img class="${className}" src="${esc(imageOf(product))}" data-pnm-fallback="${fallback}" alt="${esc(product?.imagemAlt||product?.nome||'Foto do produto')}" loading="lazy" decoding="async">`;
  }

  function bindImageFallbacks(scope=document){
    scope.querySelectorAll?.('img[data-pnm-fallback]:not([data-pnm-fallback-ready])').forEach(image=>{
      image.dataset.pnmFallbackReady='true';
      image.addEventListener('error',()=>{
        const replacement=image.dataset.pnmFallback;
        if(replacement&&image.getAttribute('src')!==replacement)image.setAttribute('src',replacement);
      });
    });
  }

  function chips(product,limit=3){
    return (product?.chips||[]).slice(0,limit).map(chip=>`<span>${esc(chip)}</span>`).join('');
  }

  function showPreview(anchor,product,stageLabel){
    if(!product||matchMedia('(hover:none)').matches)return;
    portal.innerHTML=`<div class="pc-hover-top"><div class="pc-hover-photo">${safeImageMarkup(product)}</div><div><small>${esc(stageLabel)} • PRÉVIA</small><h4>${esc(product.nome)}</h4><p>${esc(product.chamada||product.resumo||'Abra a ficha para conferir todos os detalhes.')}</p></div></div><div class="pc-hover-specs">${chips(product,4)}</div><small class="pc-hover-tip">CLIQUE PARA INSTALAR ESTA PEÇA NO SETUP</small>`;
    bindImageFallbacks(portal);
    portal.classList.add('show');
    portal.setAttribute('aria-hidden','false');
    requestAnimationFrame(()=>{
      const rect=anchor.getBoundingClientRect(),width=portal.offsetWidth||340,height=portal.offsetHeight||260;
      const left=rect.right+14+width<=innerWidth?rect.right+14:Math.max(12,rect.left-width-14);
      const top=Math.min(Math.max(12,rect.top-24),Math.max(12,innerHeight-height-12));
      portal.style.left=`${left}px`;portal.style.top=`${top}px`;
    });
  }

  function hidePreview(){portal.classList.remove('show');portal.setAttribute('aria-hidden','true')}

  function productOptions(select){
    return [...select.options].filter(option=>option.value).map(option=>byId(option.value)).filter(Boolean);
  }

  function choiceMarkup(product,selectedId,stageLabel){
    const selected=product.id===selectedId;
    return `<button class="pc-choice-card" type="button" data-pc-select="${esc(product.id)}" aria-pressed="${selected}" aria-label="Selecionar ${esc(product.nome)}"><span class="pc-choice-check">✓</span><span class="pc-choice-photo">${safeImageMarkup(product)}</span><small>${esc(product.marca||product.selo||stageLabel)}</small><strong>${esc(product.nome)}</strong></button>`;
  }

  function featureMarkup(product,selected,stageLabel){
    if(!product)return '<div class="pc-stage-feature"><div class="pc-feature-copy"><h4>Nenhum produto disponível nesta etapa.</h4></div></div>';
    return `<div class="pc-stage-feature ${selected?'selected':''}"><div class="pc-feature-state"><span>${selected?'PEÇA INSTALADA':'PRÉVIA DA ETAPA'}</span><i></i></div><div class="pc-feature-image">${safeImageMarkup(product)}</div><div class="pc-feature-copy"><small>${esc(product.marca||stageLabel)} • ${esc(product.selo||'CATÁLOGO')}</small><h4>${esc(product.nome)}</h4><div class="pc-feature-chips">${chips(product,3)}</div><div class="pc-feature-actions"><button type="button" data-pc-feature-select="${esc(product.id)}" ${selected?'disabled':''}>${selected?'✓ INSTALADA':'ADICIONAR AO SETUP'}</button><a href="produto.html?id=${encodeURIComponent(product.id)}">VER FICHA →</a></div></div></div>`;
  }

  function decorateStep(article,index){
    if(article.dataset.pnmImmersive==='true')return;
    article.dataset.pnmImmersive='true';
    article.classList.add('pnm-immersive-step');
    const select=article.querySelector('select[data-key]');
    if(!select)return;
    const options=productOptions(select),selectedId=select.value;
    const selected=byId(selectedId),featured=selected||options[0];
    const stageLabel=(article.querySelector('h3')?.textContent||`Etapa ${index+1}`).replace(/^\d+\.\s*/, '').trim();
    let visible=options.slice(0,6);
    if(selected&&!visible.some(item=>item.id===selected.id))visible=[selected,...visible.slice(0,5)];
    const stage=document.createElement('div');
    stage.className='pc-stage-grid';
    stage.innerHTML=`${featureMarkup(featured,Boolean(selected),stageLabel)}<div class="pc-choice-zone"><div class="pc-choice-heading"><b>Produtos disponíveis</b><span>${options.length} OPÇÕES<br>PASSE O MOUSE PARA AMPLIAR</span></div><div class="pc-choice-grid">${visible.map(product=>choiceMarkup(product,selectedId,stageLabel)).join('')}</div></div>`;
    select.before(stage);
    bindImageFallbacks(stage);
    const label=document.createElement('div');
    label.className='pc-all-options-label';
    label.innerHTML=`<span>CATÁLOGO COMPLETO DA ETAPA</span><b>${options.length>visible.length?`+ ${options.length-visible.length} opções no seletor`:'TODAS VISÍVEIS'}</b>`;
    select.before(label);
    select.setAttribute('aria-label',`Todas as opções de ${stageLabel}`);
    stage.querySelectorAll('[data-pc-select]').forEach(button=>{
      const product=byId(button.dataset.pcSelect);
      button.addEventListener('mouseenter',()=>showPreview(button,product,stageLabel));
      button.addEventListener('mouseleave',hidePreview);
      button.addEventListener('focus',()=>showPreview(button,product,stageLabel));
      button.addEventListener('blur',hidePreview);
      button.addEventListener('click',()=>{hidePreview();select.value=button.dataset.pcSelect;select.dispatchEvent(new Event('change',{bubbles:true}))});
    });
    const featureButton=stage.querySelector('[data-pc-feature-select]:not([disabled])');
    if(featureButton)featureButton.addEventListener('click',()=>{select.value=featureButton.dataset.pcFeatureSelect;select.dispatchEvent(new Event('change',{bubbles:true}))});
  }

  function currentState(){
    try{return JSON.parse(localStorage.getItem('pnmPcBuilderV8')||'{}')}catch{return{}}
  }

  function cockpitMarkup(articles){
    const state=currentState(),chosen=shortLabels.map((label,index)=>byId(state[stageKeys[index]]));
    const complete=chosen.filter(Boolean).length,progress=Math.round(complete/8*100);
    return `<div class="pc-build-cockpit" style="--pc-progress:${progress}%"><div class="pc-cockpit-head"><div><small>BUILD CONTROL • COMPATIBILIDADE ATIVA</small><h2>Seu PC ganha forma peça por peça.</h2></div><strong>${complete}<span>/8 OBRIGATÓRIAS</span></strong></div><div class="pc-progress-track"><i></i></div><div class="pc-slot-strip">${chosen.map((product,index)=>`<div class="pc-slot ${product?'filled':''}" title="${esc(product?.nome||shortLabels[index]+' ainda não escolhida')}">${product?safeImageMarkup(product):`<small>${iconLabels[index]}</small>`}<b>${esc(product?.marca||shortLabels[index])}</b></div>`).join('')}</div></div>`;
  }

  function decorateSummary(){
    const summary=document.getElementById('summary');
    if(!summary)return;
    const state=currentState(),chosen=stageKeys.map(key=>byId(state[key])).filter(Boolean),progress=Math.round(stageKeys.slice(0,8).filter(key=>state[key]).length/8*100);
    [...summary.querySelectorAll('.builder-list-item')].forEach((item,index)=>{
      const product=chosen[index];
      if(!product||item.dataset.pnmVisual==='true')return;
      item.dataset.pnmVisual='true';item.classList.add('pnm-summary-visual');
      const label=item.querySelector('b')?.textContent||'PEÇA',name=item.querySelector('span')?.textContent||product.nome;
      item.innerHTML=`<div class="pnm-summary-photo">${safeImageMarkup(product)}</div><div class="pnm-summary-copy"><b>${esc(label)}</b><span>${esc(name)}</span></div>`;
      bindImageFallbacks(item);
    });
    let meter=document.querySelector('.pc-summary-progress');
    if(!meter){meter=document.createElement('div');meter.className='pc-summary-progress';document.getElementById('status')?.after(meter)}
    meter.style.setProperty('--pc-progress',`${progress}%`);
    meter.innerHTML=`<span><b>PROGRESSO DO SETUP</b><strong>${progress}%</strong></span><i></i>`;
  }

  function enhance(){
    scheduled=false;
    const articles=[...root.querySelectorAll('.builder-step')];
    if(!articles.length)return;
    articles.forEach(decorateStep);
    if(!root.querySelector('.pc-build-cockpit')){
      root.insertAdjacentHTML('afterbegin',cockpitMarkup(articles));
      bindImageFallbacks(root.querySelector('.pc-build-cockpit'));
    }
    decorateSummary();
    document.documentElement.dataset.pnmPcImmersive='ready';
  }

  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(enhance)}
  new MutationObserver(()=>{if(root.querySelector('.builder-step:not([data-pnm-immersive="true"])'))schedule()}).observe(root,{childList:true,subtree:true});
  addEventListener('scroll',hidePreview,{passive:true});
  addEventListener('resize',hidePreview,{passive:true});
  schedule();
  setTimeout(schedule,180);
  window.PNM_MONTAR_PC_IMMERSIVE=true;
})();
