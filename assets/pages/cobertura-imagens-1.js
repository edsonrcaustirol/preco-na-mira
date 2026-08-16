(()=>{
  const esc=(s='')=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const niceType=p=>p.categoria||p.tipoProduto||'Produto';
  const pickSummary=()=>window.PNMImageCoverage?PNMImageCoverage.summary(PRODUTOS):{products:0,official:0,remoteVerified:0,localPhoto:0,ai:[],pending:[],real:[]};
  const infoFor=p=>window.PNMImageCoverage.classify(p);
  const state={q:'',status:'',type:'',brand:''};
  const summary=pickSummary();
  const byKind={
    real:summary.real,
    ai:summary.ai,
    pending:summary.pending
  };
  const stats=document.getElementById('coverageStats');
  stats.innerHTML=`<article class="pnm-stat"><b>${summary.products}</b><span>Produtos no catálogo</span></article><article class="pnm-stat"><b>${summary.real.length}</b><span>Com foto real</span></article><article class="pnm-stat"><b>${summary.ai.length}</b><span>Imagens feitas por IA</span></article><article class="pnm-stat"><b>${summary.pending.length}</b><span>Busca automática de foto real</span></article>`;

  const typeSel=document.getElementById('coverageType');
  const brandSel=document.getElementById('coverageBrand');
  const allProducts=[...PRODUTOS].sort((a,b)=>String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR'));
  const types=[...new Set(allProducts.map(p=>niceType(p)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const brands=[...new Set(allProducts.map(p=>p.marca).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  typeSel.innerHTML += types.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
  brandSel.innerHTML += brands.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');

  function match(p,group){
    const info=infoFor(p);
    const hay=[p.nome,p.marca,niceType(p),p.id,p.selo,p.resumo,info.label].join(' ').toLowerCase();
    if(state.q && !hay.includes(state.q))return false;
    if(state.brand && p.marca!==state.brand)return false;
    if(state.type && niceType(p)!==state.type)return false;
    if(state.status){
      if(state.status==='ai' && info.kind!=='ai')return false;
      if(state.status==='pending' && !['pending','missing'].includes(info.kind))return false;
      if(state.status==='official' && info.kind!=='official')return false;
      if(state.status==='verified' && !info.real)return false;
    }
    if(group==='ai')return info.kind==='ai';
    if(group==='pending')return ['pending','missing'].includes(info.kind);
    if(group==='real')return info.real;
    return true;
  }

  function row(p){
    const info=infoFor(p);
    const img=esc(p.imagem||p.imagemFallback||'assets/product-placeholder.svg');
    const fb=esc(p.imagemFallback||'assets/product-placeholder.svg');
    return `<article class="pnm-coverage-row"><img src="${img}" data-fallback-src="${fb}" data-placeholder-src="assets/product-placeholder.svg" alt="${esc(p.imagemAlt||p.nome)}"><div><h3>${esc(p.nome)}</h3><p>${esc(p.marca||'Marca não informada')} • ${esc(niceType(p))}</p><p>ID: ${esc(p.id)}</p></div><div class="pnm-coverage-meta"><span class="pnm-coverage-badge ${esc(info.className)}">${esc(info.label)}</span><span>${esc(info.meta)}</span></div><div class="pnm-coverage-meta"><span>${esc(p.fonteNome||p.marca||'—')}</span><span>${p.imagemFonte?`<a href="${esc(p.imagemFonte)}" target="_blank" rel="noopener noreferrer nofollow">Fonte da imagem ↗</a>`:'Sem fonte externa cadastrada'}</span></div><div class="pnm-coverage-actions-col"><a href="produto-${encodeURIComponent(p.id)}.html">Analisar</a>${p.linkAfiliado?`<a href="${esc(p.linkAfiliado)}" target="_blank" rel="sponsored nofollow noopener noreferrer">Oferta ↗</a>`:''}</div></article>`;
  }

  function renderSection(id,items,empty){
    const target=document.getElementById(id);
    const group=id==='ai-review'?'ai':id==='manual-review'?'pending':'real';const filtered=items.filter(p=>match(p,group));
    const count=target.querySelector('[data-count]');
    if(count)count.textContent=String(filtered.length);
    const box=target.querySelector('[data-list]');
    box.innerHTML=filtered.length?filtered.map(row).join(''):`<div class="pnm-empty-state">${empty}</div>`;
  }

  function render(){
    renderSection('ai-review',byKind.ai,'Nenhum produto com imagem gerada por IA no momento. Quando isso acontecer, ele aparece aqui automaticamente para revisão manual.');
    renderSection('manual-review',byKind.pending,'Nenhum produto aguardando resolução automática nesta filtragem.');
    renderSection('verified-review',byKind.real,'Nenhum produto com foto real nesta filtragem.');
  }

  document.getElementById('coverageSearch').addEventListener('input',e=>{state.q=e.target.value.trim().toLowerCase();render()});
  document.getElementById('coverageStatus').addEventListener('change',e=>{state.status=e.target.value;render()});
  typeSel.addEventListener('change',e=>{state.type=e.target.value;render()});
  brandSel.addEventListener('change',e=>{state.brand=e.target.value;render()});
  render();
})();
