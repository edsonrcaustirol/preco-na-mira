(()=>{
  'use strict';
  const S={
    impermeabilizante:['💧','Impermeabilizantes'],manta:['▰','Mantas & fitas'],aditivo:['＋','Aditivos'],espuma:['▧','Espumas expansivas'],selante:['≈','Selantes'],cobertura:['⌂','Telhas & coberturas'],ferramenta:['⚒','Ferramentas'],epi:['⛑','EPIs & proteção']
  };
  const attr='subtipoObra',tipoProduto='obra',compare='comparativo-obra',PAGE_SIZE=18;
  const esc=(s='')=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  let tipo=new URLSearchParams(location.search).get('tipo');
  if(!S[tipo])tipo=Object.keys(S)[0];
  let q='',visible=PAGE_SIZE,manager=PNMGetManager(tipoProduto,tipo);

  const allCount=PRODUTOS.filter(p=>p.tipoProduto===tipoProduto).length;
  document.getElementById('heroCount').textContent=allCount+' '+PNMPlural(allCount,'produto conectado','produtos conectados');

  const filters=document.getElementById('filters');
  const loadMore=document.getElementById('loadMore');
  filters.innerHTML=Object.entries(S).map(([key,value])=>`<button type="button" data-t="${key}" class="${key===tipo?'active':''}">${value[0]} ${value[1]}</button>`).join('');

  filters.addEventListener('click',event=>{
    const button=event.target.closest('[data-t]');
    if(!button)return;
    tipo=button.dataset.t;
    visible=PAGE_SIZE;
    manager=PNMGetManager(tipoProduto,tipo);
    history.replaceState(null,'','?tipo='+encodeURIComponent(tipo));
    filters.querySelectorAll('button').forEach(item=>item.classList.toggle('active',item===button));
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
    return `<article class="construction-product-card ${manager.has(p.id)?'is-selected':''}">
      <div class="construction-product-media">
        <img src="${esc(image)}" width="600" height="600" loading="lazy" decoding="async" data-fallback-src="${esc(fallback)}" alt="${esc(p.imagemAlt||p.nome)}">
        ${p.imagemTipo==='oficial'?'<span class="official-image-badge">✓ FONTE OFICIAL</span>':''}
      </div>
      <div class="construction-product-copy">
        <small>${esc(p.marca)} • ${esc(p.selo||p.categoria)}</small>
        <h3>${esc(p.nome)}</h3>
        <p>${esc(p.resumo)}</p>
        <div class="construction-chips">${(p.chips||[]).slice(0,4).map(x=>`<span>${esc(x)}</span>`).join('')}</div>
        <button type="button" data-c="${esc(p.id)}" class="compare-toggle ${manager.has(p.id)?'selected':''}">${manager.has(p.id)?'✓ SELECIONADO':'⚖️ COMPARAR'}</button>
        <div class="actions"><a class="btn btn-dark" href="produto-${encodeURIComponent(p.id)}">ANALISAR →</a><a class="btn btn-outline" href="${esc(p.linkAfiliado)}" target="_blank" rel="sponsored nofollow noopener noreferrer">VER NA LOJA</a></div>
      </div>
    </article>`;
  }

  function render(){
    const all=currentProducts();
    const shown=all.slice(0,visible);
    document.getElementById('title').textContent=S[tipo][0]+' '+S[tipo][1];
    document.getElementById('count').textContent=all.length+' '+PNMPlural(all.length,'produto','produtos')+(all.length>shown.length?` • exibindo ${shown.length}`:'')+' • compare itens do mesmo grupo.';
    document.getElementById('compareLink').href=compare+'?tipo='+encodeURIComponent(tipo);
    document.getElementById('grid').innerHTML=shown.map(card).join('');
    document.getElementById('empty').style.display=all.length?'none':'block';
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
    go.href=compare+'?tipo='+encodeURIComponent(tipo);
    go.classList.toggle('disabled',selected.length<2);
  }

  document.getElementById('search').addEventListener('input',event=>{q=event.target.value.trim().toLowerCase();visible=PAGE_SIZE;render();});
  document.getElementById('clear').addEventListener('click',()=>{manager.clear();render();});
  loadMore?.addEventListener('click',()=>{visible+=PAGE_SIZE;render();});
  render();
})();