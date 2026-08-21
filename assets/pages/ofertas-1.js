(()=>{
  'use strict';
  const esc=(s='')=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const products=typeof PRODUTOS!=='undefined'&&Array.isArray(PRODUTOS)?PRODUTOS:[];
  const grid=document.getElementById('offerGrid');
  const tabs=document.getElementById('offerTabs');
  const more=document.getElementById('offerMore');
  const count=document.getElementById('offerCount');
  const pagination=document.querySelector('.pnm-seo-pagination');
  const CURATION_TARGET=30;
  const PAGE_SIZE=30;
  const BUCKET_QUOTAS={casa:8,tecnologia:8,gamer:7,cozinha:7};
  const pathPage=Number(location.pathname.match(/ofertas-pagina-(\d+)/i)?.[1]||document.body.dataset.pnmStaticPage||1);
  let page=Math.max(1,pathPage),offset=(page-1)*PAGE_SIZE,visible=PAGE_SIZE,filter='';
  let preservePrerender=grid?.dataset.pnmPrerendered==='1';

  function bucket(p){
    const text=norm([p.tipoProduto,p.categoriaId,p.categoria,p.subtipo,p.subtipoCozinha,p.subtipoCasa,p.subtipoObra,p.subtipoInstalacao,p.subtipoAcabamento].join(' '));
    if(/gamer|pc|gpu|processador|monitor|mouse|teclado|memoria|placa/.test(text))return'gamer';
    if(/cozinha|airfryer|air fryer|cafeteira|geladeira|fogao|forno|panela|lava-loucas/.test(text))return'cozinha';
    if(/casa|obra|instal|acabamento|banheiro|hidraul|lavanderia|limpeza|aspirador/.test(text))return'casa';
    return'tecnologia';
  }
  function criterion(p){
    const explicit=norm([p.faixa,p.selo].filter(Boolean).join(' '));
    if(/custo.?beneficio|beneficio/.test(explicit))return{label:'CUSTO-BENEFÍCIO',score:60};
    if(/entrada|econom|acessivel/.test(explicit))return{label:'OPÇÃO DE ENTRADA',score:50};
    if(/premium|topo|avancad/.test(explicit))return{label:'PREMIUM',score:40};
    if(/intermedi|equilibr/.test(explicit))return{label:'EQUILÍBRIO',score:35};
    if(/recomend|escolha|selecion/.test(explicit))return{label:'SELECIONADO',score:25};
    if(/destaque/.test(explicit)||p.destaque===true)return{label:'DESTAQUE',score:30};
    return{label:'SELECIONADO',score:20};
  }
  function reasonText(p){return String(p.chamada||p.resumo||'').trim()}
  function compareCandidates(a,b){
    const scoreA=criterion(a).score+(a.destaque===true?10:0);
    const scoreB=criterion(b).score+(b.destaque===true?10:0);
    return scoreB-scoreA||String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR');
  }
  function takeBalanced(candidates,limit,selected,brandCounts){
    const chosen=[];
    for(const maxPerBrand of [1,2,3,Number.POSITIVE_INFINITY]){
      for(const p of candidates){
        if(chosen.length>=limit)break;
        if(selected.some(item=>item.id===p.id)||chosen.some(item=>item.id===p.id))continue;
        const brandKey=norm(p.marca||'sem-marca');
        if((brandCounts.get(brandKey)||0)>=maxPerBrand)continue;
        chosen.push(p);
        brandCounts.set(brandKey,(brandCounts.get(brandKey)||0)+1);
      }
      if(chosen.length>=limit)break;
    }
    selected.push(...chosen);
  }
  function curate(list){
    const candidates=list.filter(p=>p?.linkAfiliado&&reasonText(p)).sort(compareCandidates);
    const selected=[],brandCounts=new Map();
    for(const [group,quota] of Object.entries(BUCKET_QUOTAS))takeBalanced(candidates.filter(p=>bucket(p)===group),quota,selected,brandCounts);
    if(selected.length<CURATION_TARGET)takeBalanced(candidates,CURATION_TARGET-selected.length,selected,brandCounts);
    if(selected.length<CURATION_TARGET){for(const p of candidates){if(selected.length>=CURATION_TARGET)break;if(!selected.some(item=>item.id===p.id))selected.push(p)}}
    return selected.slice(0,CURATION_TARGET).sort(compareCandidates);
  }
  const curated=curate(products);

  function card(p,index){
    const img=p.imagem||p.imagemFallback||'assets/product-placeholder.svg',fallback=p.imagemFallback||'assets/product-placeholder.svg',loading=index===0?'eager':'lazy',priority=index===0?' fetchpriority="high"':'',meta=criterion(p);
    return `<article class="pnm-offer-card" data-pnm-product-id="${esc(p.id)}"><div class="pnm-offer-image"><img src="${esc(img)}" data-fallback-src="${esc(fallback)}" width="600" height="600" alt="${esc(p.imagemAlt||p.nome)}" loading="${loading}" decoding="async"${priority}><span>${esc(meta.label)}</span></div><div class="pnm-offer-copy"><small>${esc(p.marca||p.categoria||'Produto')}</small><h3>${esc(p.nome)}</h3><p><strong>Por que olhar:</strong> ${esc(reasonText(p))}</p><div><a href="produto-${encodeURIComponent(p.id)}">ANALISAR</a><a class="hot" href="${esc(p.linkAfiliado)}" target="_blank" rel="sponsored nofollow noopener noreferrer" aria-label="Ver ${esc(p.nome)} no Mercado Livre — abre em nova aba">VER NO MERCADO LIVRE ↗</a></div></div></article>`;
  }
  function currentList(){return filter?curated.filter(p=>bucket(p)===filter):curated}
  function render({reset=false}={}){
    if(reset){page=1;offset=0;visible=PAGE_SIZE;preservePrerender=false}
    const list=currentList(),shown=list.slice(offset,offset+visible),canPreserve=preservePrerender&&!filter&&page===pathPage&&visible===PAGE_SIZE&&grid?.children.length>0;
    if(count)count.textContent=`${list.length} ${list.length===1?'produto selecionado':'produtos selecionados'}`;
    if(grid&&!canPreserve)grid.innerHTML=shown.length?shown.map(card).join(''):'<div class="pnm-empty" data-empty-state>Nenhum item desta curadoria está neste filtro. Tente outra categoria ou abra o Catálogo completo.</div>';
    preservePrerender=false;
    if(more){const remaining=Math.max(0,list.length-(offset+visible));more.hidden=remaining===0;more.textContent=remaining?`CARREGAR MAIS (${Math.min(PAGE_SIZE,remaining)})`:'TODOS CARREGADOS';more.setAttribute('aria-expanded',String(remaining===0))}
    if(pagination)pagination.hidden=Boolean(filter);
  }
  if(tabs)tabs.addEventListener('click',event=>{const button=event.target.closest('[data-filter]');if(!button)return;filter=button.dataset.filter||'';tabs.querySelectorAll('button').forEach(item=>item.classList.toggle('active',item===button));render({reset:true})});
  if(more)more.addEventListener('click',()=>{visible+=PAGE_SIZE;render()});
  render();
})();
