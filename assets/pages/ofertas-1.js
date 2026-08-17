(()=>{
  'use strict';

  const esc=(s='')=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const products=typeof PRODUTOS!=='undefined'&&Array.isArray(PRODUTOS)?PRODUTOS:[];
  const grid=document.getElementById('offerGrid');
  const tabs=document.getElementById('offerTabs');
  const more=document.getElementById('offerMore');
  const count=document.getElementById('offerCount');
  const PAGE_SIZE=12;
  let filter='';
  let visible=PAGE_SIZE;

  function bucket(p){
    const text=norm([p.tipoProduto,p.categoriaId,p.categoria,p.subtipo,p.subtipoCozinha,p.subtipoCasa,p.subtipoObra,p.subtipoInstalacao,p.subtipoAcabamento].join(' '));
    if(/gamer|pc|gpu|processador|monitor|mouse|teclado|memoria|placa/.test(text))return'gamer';
    if(/casa|obra|instal|acabamento|banheiro|hidraul/.test(text))return'casa';
    if(/cozinha|airfryer|air fryer|cafeteira|geladeira|fogao|forno|panela|lava-loucas/.test(text))return'cozinha';
    return'tecnologia';
  }

  function safeLabel(p){
    const candidates=[p.selo,p.faixa].filter(Boolean);
    const allowed=/custo|benef[ií]cio|premium|intermedi|entrada|destaque|escolha|selecion|recomend/i;
    const label=candidates.find(value=>allowed.test(String(value)));
    if(label)return String(label);
    return p.destaque?'DESTAQUE':'SELECIONADO';
  }

  function card(p){
    const img=p.imagem||p.imagemFallback||'assets/product-placeholder.svg';
    const fallback=p.imagemFallback||'assets/product-placeholder.svg';
    return `<article class="pnm-offer-card">
      <div class="pnm-offer-image">
        <img src="${esc(img)}" data-fallback-src="${esc(fallback)}" width="600" height="600" alt="${esc(p.imagemAlt||p.nome)}" loading="lazy" decoding="async">
        <span>${esc(safeLabel(p))}</span>
      </div>
      <div class="pnm-offer-copy">
        <small>${esc(p.marca||p.categoria||'Produto')}</small>
        <h3>${esc(p.nome)}</h3>
        <p>${esc(p.chamada||p.resumo||'Veja a análise e confirme se esta opção combina com o que você procura.')}</p>
        <div>
          <a href="produto-${encodeURIComponent(p.id)}">ANALISAR</a>
          <a class="hot" href="${esc(p.linkAfiliado)}" target="_blank" rel="sponsored nofollow noopener noreferrer">VER NA LOJA</a>
        </div>
      </div>
    </article>`;
  }

  function currentList(){
    let list=products.filter(p=>p?.linkAfiliado&&(p.destaque||p.faixa||p.selo));
    if(filter)list=list.filter(p=>bucket(p)===filter);
    return list.sort((a,b)=>(b.destaque?1:0)-(a.destaque?1:0)||String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR'));
  }

  function render(){
    const list=currentList();
    const shown=list.slice(0,visible);
    if(count)count.textContent=`${list.length} ${list.length===1?'destaque':'destaques'}`;
    if(grid){
      grid.innerHTML=shown.length
        ?shown.map(card).join('')
        :'<div class="pnm-empty" data-empty-state>Nenhum destaque encontrado neste filtro. Tente outra categoria ou abra o Catálogo.</div>';
    }
    if(more){
      const remaining=Math.max(0,list.length-shown.length);
      more.hidden=remaining===0;
      more.textContent=remaining>0?`CARREGAR MAIS (${Math.min(PAGE_SIZE,remaining)})`:'TODOS CARREGADOS';
      more.setAttribute('aria-expanded',String(remaining===0));
    }
  }

  if(tabs)tabs.addEventListener('click',event=>{
    const button=event.target.closest('[data-filter]');
    if(!button)return;
    filter=button.dataset.filter||'';
    visible=PAGE_SIZE;
    tabs.querySelectorAll('button').forEach(item=>item.classList.toggle('active',item===button));
    render();
  });

  if(more)more.addEventListener('click',()=>{
    visible+=PAGE_SIZE;
    render();
  });

  render();
})();