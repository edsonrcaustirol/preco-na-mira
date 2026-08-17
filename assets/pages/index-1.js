(()=>{
  'use strict';

  const esc=(s='')=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const products=Array.isArray(window.PRODUTOS)?window.PRODUTOS:[];

  function hasUsefulImage(p){
    const image=String(p?.imagem||'');
    return p?.imagemTipo==='oficial'||/\.(?:webp|png|jpe?g|avif)(?:\?|$)/i.test(image);
  }

  function highlightLabel(p){
    if(p?.selo)return p.selo;
    if(p?.faixa)return p.faixa;
    if(p?.destaque)return 'Destaque selecionado';
    return 'Boa opção';
  }

  function chooseHighlights(limit=6){
    const eligible=products
      .filter(p=>p?.linkAfiliado&&(p.destaque||p.faixa||p.selo))
      .sort((a,b)=>(b.destaque?1:0)-(a.destaque?1:0)||(hasUsefulImage(b)?1:0)-(hasUsefulImage(a)?1:0)||String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR'));
    const pool=eligible.length?eligible:products.filter(p=>p?.linkAfiliado);
    const selected=[],types=new Map(),brands=new Map();
    for(const p of pool){
      const type=String(p.tipoProduto||'outro');
      const brand=norm(p.marca||'');
      if((types.get(type)||0)>=2)continue;
      if(brand&&(brands.get(brand)||0)>=1)continue;
      selected.push(p);
      types.set(type,(types.get(type)||0)+1);
      if(brand)brands.set(brand,(brands.get(brand)||0)+1);
      if(selected.length>=limit)break;
    }
    if(selected.length<limit){
      for(const p of pool){
        if(selected.some(x=>x.id===p.id))continue;
        selected.push(p);
        if(selected.length>=limit)break;
      }
    }
    return selected;
  }

  function highlightCard(p){
    const image=p.imagem||p.imagemFallback||'assets/product-placeholder.svg';
    const fallback=p.imagemFallback||'assets/product-placeholder.svg';
    const category=p.categoria||p.tipoProduto||'Produto';
    return `<article class="smart-ad-card">
      <div class="smart-ad-inner is-compact">
        <a class="smart-ad-media" href="produto-${encodeURIComponent(p.id)}" aria-label="Analisar ${esc(p.nome)}">
          <span class="smart-ad-kicker">${esc(highlightLabel(p))}</span>
          <img src="${esc(image)}" data-fallback-src="${esc(fallback)}" width="600" height="600" loading="lazy" decoding="async" alt="${esc(p.imagemAlt||p.nome)}">
        </a>
        <div class="smart-ad-copy">
          <small>${esc(p.marca||'Marca')} • ${esc(category)}</small>
          <h3>${esc(p.nome)}</h3>
          <p>${esc(p.chamada||p.resumo||'Veja a análise e confira se esta opção faz sentido para você.')}</p>
          <div class="smart-ad-actions">
            <a href="produto-${encodeURIComponent(p.id)}">ANALISAR →</a>
            <a class="offer" href="${esc(p.linkAfiliado)}" target="_blank" rel="sponsored nofollow noopener noreferrer">VER OFERTA ↗</a>
          </div>
        </div>
      </div>
    </article>`;
  }

  const offerGrid=document.getElementById('homeOfferGrid');
  if(offerGrid){
    const highlights=chooseHighlights(6);
    offerGrid.innerHTML=highlights.length
      ?highlights.map(highlightCard).join('')
      :'<div class="pnm-empty" data-empty-state>Nenhum destaque disponível neste momento. Use a busca para explorar o catálogo.</div>';
  }

  function recent(){
    const section=document.getElementById('recentSection');
    const grid=document.getElementById('recentGrid');
    if(!section||!grid||!window.PNMRecent)return;
    const recentProducts=PNMRecent.get().map(id=>products.find(p=>p.id===id)).filter(Boolean).slice(0,8);
    section.style.display=recentProducts.length?'block':'none';
    grid.innerHTML=recentProducts.map(p=>`<a class="recent-card" href="produto-${encodeURIComponent(p.id)}"><img src="${esc(p.imagem||p.imagemFallback||'assets/product-placeholder.svg')}" width="360" height="360" loading="lazy" decoding="async" alt="${esc(p.imagemAlt||p.nome)}"><b>${esc(p.nome)}</b><span>${esc(p.marca||'')}</span></a>`).join('');
  }

  const clearRecent=document.getElementById('clearRecent');
  if(clearRecent)clearRecent.addEventListener('click',()=>{PNMRecent.clear();recent()});
  recent();

  const searchInput=document.getElementById('homeSearchInput');
  const suggest=document.getElementById('homeSearchSuggestions');
  if(searchInput&&suggest){
    function renderSuggestions(){
      const q=norm(searchInput.value.trim());
      if(q.length<2){suggest.hidden=true;suggest.innerHTML='';return;}
      const matches=products.filter(p=>norm([p.nome,p.marca,p.categoria,p.tipoProduto,p.subtipoCasa,p.subtipoCozinha,p.subtipoLavanderia,p.subtipoGamer,p.subtipoAcessorio,p.subtipoObra,p.subtipoInstalacao,p.subtipoAcabamento].join(' ')).includes(q)).slice(0,6);
      suggest.hidden=false;
      if(!matches.length){
        suggest.innerHTML=`<a class="search-all" href="busca?q=${encodeURIComponent(searchInput.value)}">Buscar por “${esc(searchInput.value)}” em todo o catálogo →</a>`;
        return;
      }
      suggest.innerHTML=matches.map(p=>`<a href="produto-${encodeURIComponent(p.id)}"><img src="${esc(p.imagem||p.imagemFallback||'assets/product-placeholder.svg')}" width="56" height="56" loading="lazy" decoding="async" alt=""><span><b>${esc(p.nome)}</b><small>${esc(p.marca||'')}</small></span><strong>→</strong></a>`).join('')+`<a class="search-all" href="busca?q=${encodeURIComponent(searchInput.value)}">Ver todos os resultados →</a>`;
    }
    searchInput.addEventListener('input',renderSuggestions);
    searchInput.addEventListener('focus',renderSuggestions);
    document.addEventListener('click',e=>{if(!e.target.closest('.home-search-field'))suggest.hidden=true});
  }

  document.querySelectorAll('.home-quick-searches [data-q]').forEach(button=>button.addEventListener('click',()=>{
    const q=button.dataset.q||'';
    if(searchInput)searchInput.value=q;
    location.href='busca?q='+encodeURIComponent(q);
  }));
})();