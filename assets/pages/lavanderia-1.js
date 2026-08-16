(()=>{
  const esc=(s='')=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const all=PRODUTOS.filter(p=>p.tipoProduto==='lavanderia');
  let profile=new URLSearchParams(location.search).get('tipo');if(!['compacta','alta-capacidade'].includes(profile))profile='compacta';
  document.getElementById('total').textContent=all.length;document.getElementById('compactCount').textContent=all.filter(p=>p.subtipoLavanderia==='compacta').length;document.getElementById('largeCount').textContent=all.filter(p=>p.subtipoLavanderia==='alta-capacidade').length;
  function render(){
    const list=all.filter(p=>p.subtipoLavanderia===profile),compact=profile==='compacta';
    document.querySelectorAll('[data-profile]').forEach(b=>b.classList.toggle('active',b.dataset.profile===profile));
    document.getElementById('eyebrow').textContent=compact?'POUCO ESPAÇO':'MAIOR CAPACIDADE';
    document.getElementById('title').textContent=compact?'Lavadoras para espaços pequenos':'Lavadoras de maior capacidade';
    document.getElementById('count').textContent=list.length+' '+PNMPlural(list.length,'produto','produtos')+' nesta régua.';
    const context=document.getElementById('contextLink');context.style.display=compact?'inline-flex':'none';
    document.getElementById('grid').innerHTML=list.map(p=>`<article class="laundry-product"><div class="laundry-product-media"><img src="${esc(p.imagem)}" loading="lazy" decoding="async" data-fallback-src="${esc(p.imagemFallback)}" alt="${esc(p.imagemAlt||p.nome)}">${p.imagemTipo==='oficial'?'<span class="official-image-badge">✓ FONTE OFICIAL</span>':''}</div><div class="laundry-product-copy"><small>${esc(p.marca)} • ${esc(p.selo)}</small><h3>${esc(p.nome)}</h3><p>${esc(p.resumo)}</p><div class="laundry-tags">${(p.chips||[]).slice(1).map(x=>`<span>${esc(x)}</span>`).join('')}</div><div class="actions"><a class="btn btn-dark" href="produto-${encodeURIComponent(p.id)}.html">ANALISAR →</a><a class="btn btn-outline" href="${esc(p.linkAfiliado)}" target="_blank" rel="sponsored nofollow noopener noreferrer">OFERTA</a></div></div></article>`).join('');
    history.replaceState(null,'','?tipo='+profile);
  }
  document.querySelectorAll('[data-profile]').forEach(b=>b.onclick=()=>{profile=b.dataset.profile;render();document.getElementById('catalogo').scrollIntoView({behavior:'smooth'})});
  document.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>{profile=b.dataset.jump;render();document.getElementById('catalogo').scrollIntoView({behavior:'smooth'})});
  render();
})();
