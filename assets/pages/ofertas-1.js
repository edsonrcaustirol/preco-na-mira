(()=>{
  'use strict';
  const esc=(s='')=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const products=typeof PRODUTOS!=='undefined'&&Array.isArray(PRODUTOS)?PRODUTOS:[];
  const grid=document.getElementById('offerGrid');
  const tabs=document.getElementById('offerTabs');
  const more=document.getElementById('offerMore');
  const count=document.getElementById('offerCount');
  const pagination=document.querySelector('.pnm-seo-pagination');
  const PAGE_SIZE=24;
  const pathPage=Number(location.pathname.match(/ofertas-pagina-(\d+)/i)?.[1]||document.body.dataset.pnmStaticPage||1);
  let page=Math.max(1,pathPage),offset=(page-1)*PAGE_SIZE,visible=PAGE_SIZE,filter='';
  let preservePrerender=grid?.dataset.pnmPrerendered==='1';

  function bucket(p){
    const text=norm([p.tipoProduto,p.categoriaId,p.categoria,p.subtipo,p.subtipoCozinha,p.subtipoCasa,p.subtipoObra,p.subtipoInstalacao,p.subtipoAcabamento].join(' '));
    if(/gamer|pc|gpu|processador|monitor|mouse|teclado|memoria|placa/.test(text))return'gamer';
    if(/casa|obra|instal|acabamento|banheiro|hidraul/.test(text))return'casa';
    if(/cozinha|airfryer|air fryer|cafeteira|geladeira|fogao|forno|panela|lava-loucas/.test(text))return'cozinha';
    return'tecnologia';
  }
  function safeLabel(p){const candidates=[p.selo,p.faixa].filter(Boolean),allowed=/custo|benef[ií]cio|premium|intermedi|entrada|destaque|escolha|selecion|recomend/i;return String(candidates.find(value=>allowed.test(String(value)))||(p.destaque?'DESTAQUE':'SELECIONADO'))}
  function card(p,index){const img=p.imagem||p.imagemFallback||'assets/product-placeholder.svg',fallback=p.imagemFallback||'assets/product-placeholder.svg',loading=index===0?'eager':'lazy',priority=index===0?' fetchpriority="high"':'';return `<article class="pnm-offer-card" data-pnm-product-id="${esc(p.id)}"><div class="pnm-offer-image"><img src="${esc(img)}" data-fallback-src="${esc(fallback)}" width="600" height="600" alt="${esc(p.imagemAlt||p.nome)}" loading="${loading}" decoding="async"${priority}><span>${esc(safeLabel(p))}</span></div><div class="pnm-offer-copy"><small>${esc(p.marca||p.categoria||'Produto')}</small><h3>${esc(p.nome)}</h3><p>${esc(p.chamada||p.resumo||'Veja a análise e confirme se esta opção combina com o que você procura.')}</p><div><a href="produto-${encodeURIComponent(p.id)}">ANALISAR</a><a class="hot" href="${esc(p.linkAfiliado)}" target="_blank" rel="sponsored nofollow noopener noreferrer">VER NO MERCADO LIVRE ↗</a></div></div></article>`}
  function currentList(){let list=products.filter(p=>p?.linkAfiliado&&(p.destaque||p.faixa||p.selo));if(filter)list=list.filter(p=>bucket(p)===filter);return list.sort((a,b)=>(b.destaque?1:0)-(a.destaque?1:0)||String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR'))}
  function render({reset=false}={}){
    if(reset){page=1;offset=0;visible=PAGE_SIZE;preservePrerender=false}
    const list=currentList(),shown=list.slice(offset,offset+visible),canPreserve=preservePrerender&&!filter&&page===pathPage&&visible===PAGE_SIZE&&grid?.children.length>0;
    if(count)count.textContent=`${list.length} ${list.length===1?'destaque':'destaques'}`;
    if(grid&&!canPreserve)grid.innerHTML=shown.length?shown.map(card).join(''):'<div class="pnm-empty" data-empty-state>Nenhum destaque encontrado neste filtro. Tente outra categoria ou abra o Catálogo.</div>';
    preservePrerender=false;
    if(more){const remaining=Math.max(0,list.length-(offset+visible));more.hidden=remaining===0;more.textContent=remaining?`CARREGAR MAIS (${Math.min(PAGE_SIZE,remaining)})`:'TODOS CARREGADOS';more.setAttribute('aria-expanded',String(remaining===0))}
    if(pagination)pagination.hidden=Boolean(filter);
  }
  if(tabs)tabs.addEventListener('click',event=>{const button=event.target.closest('[data-filter]');if(!button)return;filter=button.dataset.filter||'';tabs.querySelectorAll('button').forEach(item=>item.classList.toggle('active',item===button));render({reset:true})});
  if(more)more.addEventListener('click',()=>{visible+=PAGE_SIZE;render()});
  render();
})();
