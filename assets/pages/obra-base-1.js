(()=>{
  'use strict';

  const S={
    impermeabilizante:['💧','Impermeabilizantes'],
    manta:['▰','Mantas & fitas'],
    aditivo:['＋','Aditivos'],
    espuma:['▧','Espumas expansivas'],
    selante:['≈','Selantes'],
    cobertura:['⌂','Telhas & coberturas'],
    ferramenta:['⚒','Ferramentas'],
    epi:['⛑','EPIs & proteção']
  };
  const attr='subtipoObra',tipoProduto='obra',compare='comparativo-obra',PAGE_SIZE=18;
  const defaultTipo=Object.keys(S)[0];
  const esc=(s='')=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  const filters=document.getElementById('filters');
  const loadMore=document.getElementById('loadMore');
  const search=document.getElementById('search');
  const empty=document.getElementById('empty');

  function readLocation(){
    const params=new URLSearchParams(location.search);
    const requested=params.get('tipo');
    const rawQuery=(params.get('q')||'').trim();
    return {
      tipo:S[requested]?requested:defaultTipo,
      q:rawQuery.toLowerCase(),
      rawQuery,
      needsCanonical:requested!==(S[requested]?requested:defaultTipo)
    };
  }

  let state=readLocation();
  let tipo=state.tipo;
  let q=state.q;
  let visible=PAGE_SIZE;
  let manager=PNMGetManager(tipoProduto,tipo);
  search.value=state.rawQuery;

  const allCount=PRODUTOS.filter(p=>p.tipoProduto===tipoProduto).length;
  document.getElementById('heroCount').textContent=allCount+' '+PNMPlural(allCount,'produto conectado','produtos conectados');

  filters.innerHTML=Object.entries(S).map(([key,value])=>
    `<button type="button" data-t="${key}" class="${key===tipo?'active':''}" aria-pressed="${key===tipo?'true':'false'}">${value[0]} ${value[1]}</button>`
  ).join('');

  function syncFilterState(){
    filters.querySelectorAll('[data-t]').forEach(button=>{
      const active=button.dataset.t===tipo;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',active?'true':'false');
    });
  }

  function urlForState(){
    const params=new URLSearchParams();
    params.set('tipo',tipo);
    const value=search.value.trim();
    if(value)params.set('q',value);
    return location.pathname+'?'+params.toString()+location.hash;
  }

  function writeUrl(mode){
    history[mode+'State']({tipo},'',urlForState());
  }

  function applyLocationState({canonicalize=false}={}){
    state=readLocation();
    tipo=state.tipo;
    q=state.q;
    visible=PAGE_SIZE;
    manager=PNMGetManager(tipoProduto,tipo);
    search.value=state.rawQuery;
    syncFilterState();
    if(canonicalize&&state.needsCanonical)writeUrl('replace');
    render();
  }

  filters.addEventListener('click',event=>{
    const button=event.target.closest('[data-t]');
    if(!button||button.dataset.t===tipo)return;
    tipo=button.dataset.t;
    visible=PAGE_SIZE;
    manager=PNMGetManager(tipoProduto,tipo);
    writeUrl('push');
    syncFilterState();
    render();
  });

  function currentProducts(){
    return PRODUTOS
      .filter(p=>p.tipoProduto===tipoProduto&&p[attr]===tipo)
      .filter(p=>!q||[p.nome,p.marca,p.resumo,...(p.chips||[]),...Object.values(p.especificacoes||{})].join(' ').toLowerCase().includes(q));
  }

  function card(p){
    const image=p.imagem||p.imagemFallback||'assets/product-placeholder.svg';
    const fallback=p.imagemFallback||'assets/product-placeholder.svg';
    const selected=manager.has(p.id);
    return `<article class="construction-product-card ${selected?'is-selected':''}">
      <div class="construction-product-media">
        <img src="${esc(image)}" width="600" height="600" loading="lazy" decoding="async" data-fallback-src="${esc(fallback)}" alt="${esc(p.imagemAlt||p.nome)}">
        ${p.imagemTipo==='oficial'?'<span class="official-image-badge">✓ FONTE OFICIAL</span>':''}
      </div>
      <div class="construction-product-copy">
        <small>${esc(p.marca)} • ${esc(p.selo||p.categoria)}</small>
        <h3>${esc(p.nome)}</h3>
        <p>${esc(p.resumo)}</p>
        <div class="construction-chips">${(p.chips||[]).slice(0,4).map(x=>`<span>${esc(x)}</span>`).join('')}</div>
        <button type="button" data-c="${esc(p.id)}" class="compare-toggle ${selected?'selected':''}" aria-pressed="${selected?'true':'false'}">${selected?'✓ SELECIONADO':'⚖️ COMPARAR'}</button>
        <div class="actions"><a class="btn btn-dark" href="produto-${encodeURIComponent(p.id)}">ANALISAR →</a><a class="btn btn-outline" href="${esc(p.linkAfiliado)}" target="_blank" rel="sponsored nofollow noopener noreferrer">VER NA LOJA</a></div>
      </div>
    </article>`;
  }

  function renderEmpty(all){
    if(all.length){
      empty.hidden=true;
      empty.textContent='';
      return;
    }
    empty.hidden=false;
    if(q){
      empty.innerHTML=`<strong>Nenhum produto encontrado nesta busca.</strong><span>Tente outro termo ou escolha outra subárea acima.</span><a href="catalogo">ABRIR CATÁLOGO →</a>`;
    }else{
      empty.innerHTML=`<strong>Não encontramos produtos cadastrados nesta seleção no momento.</strong><span>Escolha outra subárea acima ou consulte o catálogo completo.</span><a href="catalogo">ABRIR CATÁLOGO →</a>`;
    }
  }

  function render(){
    const all=currentProducts();
    const shown=all.slice(0,visible);
    document.getElementById('title').textContent=S[tipo][0]+' '+S[tipo][1];
    document.getElementById('count').textContent=all.length+' '+PNMPlural(all.length,'produto','produtos')+(all.length>shown.length?` • exibindo ${shown.length}`:'')+' • compare itens do mesmo grupo.';
    document.getElementById('compareLink').href=compare+'?tipo='+encodeURIComponent(tipo);
    document.getElementById('grid').innerHTML=shown.map(card).join('');
    renderEmpty(all);

    document.querySelectorAll('[data-c]').forEach(button=>button.addEventListener('click',()=>{
      const result=manager.toggle(button.dataset.c);
      if(result==='limit')alert('Até 4 itens do mesmo grupo por comparação.');
      render();
    }));

    if(loadMore){
      const remaining=Math.max(0,all.length-shown.length);
      loadMore.hidden=remaining===0;
      loadMore.textContent=remaining?`CARREGAR MAIS (${Math.min(PAGE_SIZE,remaining)})`:'TODOS CARREGADOS';
    }
    tray();
  }

  function tray(){
    const selected=manager.get().map(id=>PRODUTOS.find(p=>p.id===id)).filter(Boolean);
    document.getElementById('tray').classList.toggle('show',selected.length>0);
    document.getElementById('trayCount').textContent=selected.length+' de 4 • '+S[tipo][1];
    document.getElementById('trayItems').innerHTML=selected.map(p=>`<span class="compare-chip">${esc(p.nome)} <button type="button" data-r="${esc(p.id)}" aria-label="Remover ${esc(p.nome)} da comparação">×</button></span>`).join('');
    document.querySelectorAll('[data-r]').forEach(button=>button.addEventListener('click',()=>{manager.remove(button.dataset.r);render();}));

    const go=document.getElementById('go');
    const disabled=selected.length<2;
    go.classList.toggle('disabled',disabled);
    go.setAttribute('aria-disabled',disabled?'true':'false');
    go.tabIndex=disabled?-1:0;
    if(disabled)go.removeAttribute('href');
    else go.href=compare+'?tipo='+encodeURIComponent(tipo);
  }

  search.addEventListener('input',event=>{
    q=event.target.value.trim().toLowerCase();
    visible=PAGE_SIZE;
    writeUrl('replace');
    render();
  });

  document.getElementById('clear').addEventListener('click',()=>{manager.clear();render();});
  loadMore?.addEventListener('click',()=>{visible+=PAGE_SIZE;render();});
  window.addEventListener('popstate',()=>applyLocationState({canonicalize:true}));

  syncFilterState();
  if(state.needsCanonical)writeUrl('replace');
  render();
})();