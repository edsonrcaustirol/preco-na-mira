(()=>{
  const SPECIAL='https://meli.la/24zmozq';
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const esc=(s='')=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const all=Array.isArray(window.PRODUTOS)?window.PRODUTOS:(typeof PRODUTOS!=='undefined'?PRODUTOS:[]);
  const products=all.filter(p=>norm(p.marca).includes('dewalt')||norm(p.nome).includes('dewalt'));
  const special=products.find(p=>[p.linkAfiliado,p.linkOriginal].filter(Boolean).some(x=>String(x).includes('24zmozq')));
  const grid=document.getElementById('dewaltGrid');
  const filters=document.getElementById('dewaltFilters');
  const count=document.getElementById('dewaltCount');
  const categoryCount=document.getElementById('dewaltCategoryCount');
  const specialBox=document.getElementById('dewaltSpecialVisual');
  const specialTitle=document.getElementById('dewaltSpecialTitle');
  const specialText=document.getElementById('dewaltSpecialText');
  const specialAnalyze=document.getElementById('dewaltSpecialAnalyze');
  const specialOffer=document.getElementById('dewaltSpecialOffer');
  const subtype=p=>p.subtipoObra||p.subtipoAcessorio||p.subtipoInstalacao||p.subtipo||p.tipoProduto||p.categoria||'Outros';
  const nice=s=>String(s||'').replace(/[-_]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  const kinds=[...new Set(products.map(subtype).filter(Boolean))].sort((a,b)=>nice(a).localeCompare(nice(b),'pt-BR'));
  if(count)count.textContent=products.length||'—';
  if(categoryCount)categoryCount.textContent=kinds.length||'—';
  if(special){
    specialTitle.textContent=special.nome;
    specialText.textContent=special.chamada||special.resumo||'Uma edição especial escolhida para ocupar a vitrine principal da Linha DeWalt.';
    specialBox.innerHTML=`<img src="${esc(special.imagem||special.imagemFallback||'assets/product-photo-unavailable.svg')}" alt="${esc(special.imagemAlt||special.nome)}" decoding="async">`;
    specialAnalyze.href=`produto-${encodeURIComponent(special.id)}`;
    specialAnalyze.hidden=false;
    specialOffer.href=special.linkAfiliado||SPECIAL;
  }else{
    specialOffer.href=SPECIAL;
  }
  const card=p=>{
    const img=p.imagem||p.imagemFallback||'assets/product-photo-unavailable.svg';
    const fallback=p.imagemFallback||'assets/product-photo-unavailable.svg';
    const chips=(p.chips||[]).slice(0,3);
    return `<article class="dw-card" data-kind="${esc(subtype(p))}">
      <a class="dw-photo" href="produto-${encodeURIComponent(p.id)}"><img src="${esc(img)}" alt="${esc(p.imagemAlt||p.nome)}" loading="lazy" decoding="async" data-fallback-src="${esc(fallback)}"></a>
      <div class="dw-card-body">
        <div class="dw-card-top"><span>${esc(p.marca||'DeWalt')}</span><span>${esc(p.selo||nice(subtype(p)))}</span></div>
        <h3>${esc(p.nome)}</h3>
        <p>${esc(p.resumo||p.chamada||p.categoria||'Veja a ficha, contexto e oferta do produto.')}</p>
        ${chips.length?`<div class="dw-chips">${chips.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}
        <div class="dw-card-actions"><a href="produto-${encodeURIComponent(p.id)}">ANALISAR</a><a class="offer" href="${esc(p.linkAfiliado||'#')}" target="_blank" rel="sponsored nofollow noopener noreferrer">VER OFERTA</a></div>
      </div>
    </article>`;
  };
  function render(kind=''){
    const view=kind?products.filter(p=>subtype(p)===kind):products;
    if(!view.length){
      grid.innerHTML='<div class="dw-empty"><b>Novos produtos estão em validação.</b><span>Os links deste lote já entraram na fila. Nome, modelo e foto só aparecem aqui depois da confirmação para evitar cadastro errado.</span></div>';
      return;
    }
    grid.innerHTML=view.map(card).join('');
  }
  if(filters){
    const buttons=[['','Todos'],...kinds.map(k=>[k,nice(k)])];
    filters.innerHTML=buttons.map(([v,t],i)=>`<button class="dw-filter${i===0?' active':''}" type="button" data-kind="${esc(v)}">${esc(t)}</button>`).join('');
    filters.addEventListener('click',e=>{
      const b=e.target.closest('.dw-filter');if(!b)return;
      filters.querySelectorAll('.dw-filter').forEach(x=>x.classList.remove('active'));b.classList.add('active');render(b.dataset.kind||'');
    });
  }
  render();
})();
