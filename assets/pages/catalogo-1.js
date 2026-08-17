(()=>{
'use strict';
const esc=(s='')=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const nice=s=>String(s||'').replace(/[-_]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const PAGE_SIZE=24;
const input=document.getElementById('catalogSearch'),universe=document.getElementById('catalogUniverse'),type=document.getElementById('catalogType'),brand=document.getElementById('catalogBrand'),tier=document.getElementById('catalogTier'),sort=document.getElementById('catalogSort'),grid=document.getElementById('catalogGrid'),count=document.getElementById('catalogCount'),more=document.getElementById('catalogMore'),pagination=document.querySelector('.pnm-seo-pagination');
const pathPage=Number(location.pathname.match(/catalogo-pagina-(\d+)/i)?.[1]||document.body.dataset.pnmStaticPage||1);
let page=Math.max(1,pathPage),offset=(page-1)*PAGE_SIZE,limit=PAGE_SIZE;
let preservePrerender=grid?.dataset.pnmPrerendered==='1';

const toolbar=document.querySelector('.pnm-catalog-toolbar');
if(toolbar){const shortcut=document.createElement('div');shortcut.className='pnm-catalog-meta';shortcut.innerHTML='<strong>LINHA DEWALT</strong><span>Ferramentas da marca têm uma vitrine própria, organizada por família e séries especiais.</span><a class="pnm-catalog-more" href="dewalt" style="text-decoration:none;white-space:nowrap">ABRIR DEWALT →</a>';toolbar.parentNode.insertBefore(shortcut,toolbar)}
const universeDefs=[['casa','Casa'],['gamer','Gamer'],['tecnologia','Tecnologia']];
if(universe)universe.innerHTML+=[...universeDefs].map(([v,t])=>`<option value="${v}">${t}</option>`).join('');
const products=typeof PRODUTOS!=='undefined'&&Array.isArray(PRODUTOS)?PRODUTOS:[];
const types=[...new Set(products.map(p=>p.tipoProduto||p.categoriaId||p.categoria).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'pt-BR'));
const brands=[...new Set(products.map(p=>p.marca).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'pt-BR'));
const tiers=[...new Set(products.map(p=>p.faixa||p.selo).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'pt-BR'));
if(type)type.innerHTML+=types.map(x=>`<option value="${esc(x)}">${esc(nice(x))}</option>`).join('');
if(brand)brand.innerHTML+=brands.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
if(tier)tier.innerHTML+=tiers.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
const productUniverses=p=>{try{return (PNMExperienceMeta(p).universos||[])}catch(e){const t=p.tipoProduto;return ['casa','cozinha','lavanderia','obra','instalacao','acabamento'].includes(t)?['casa']:['gamer'].includes(t)?['gamer']:['tecnologia']}};

function card(p,index){const img=p.imagem||p.imagemFallback||'assets/product-placeholder.svg';const fallback=p.imagemFallback||'assets/product-placeholder.svg';const loading=index===0?'eager':'lazy';const priority=index===0?' fetchpriority="high"':'';return `<article class="pnm-product-card" data-pnm-product-id="${esc(p.id)}"><a class="pnm-product-photo" href="produto-${encodeURIComponent(p.id)}"><img src="${esc(img)}" data-fallback-src="${esc(fallback)}" width="600" height="600" alt="${esc(p.imagemAlt||p.nome)}" loading="${loading}" decoding="async"${priority}></a><div class="pnm-product-copy"><div class="pnm-product-top"><span>${esc(p.marca||'Produto')}</span>${p.destaque?'<b>DESTAQUE</b>':''}</div><h2>${esc(p.nome)}</h2><p>${esc(p.resumo||p.chamada||p.categoria||'Veja detalhes, contexto e oferta.')}</p><div class="pnm-product-actions"><a href="produto-${encodeURIComponent(p.id)}">ANALISAR</a><a class="offer" href="${esc(p.linkAfiliado||'#')}" target="_blank" rel="sponsored nofollow noopener noreferrer">VER NO MERCADO LIVRE ↗</a></div></div></article>`}

function hasFilters(){return Boolean(input?.value.trim()||universe?.value||type?.value||brand?.value||tier?.value||sort?.value)}
function filtered(){const q=norm(input?.value.trim());let arr=products.filter(p=>(!universe?.value||productUniverses(p).includes(universe.value))&&(!type?.value||(p.tipoProduto||p.categoriaId||p.categoria)===type.value)&&(!brand?.value||p.marca===brand.value)&&(!tier?.value||(p.faixa||p.selo)===tier.value)&&(!q||norm([p.nome,p.marca,p.categoria,p.tipoProduto,p.subtipo,p.resumo,p.chamada,...(p.chips||[])].join(' ')).includes(q)));if(sort?.value==='az')arr.sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));else if(sort?.value==='brand')arr.sort((a,b)=>(a.marca||'').localeCompare(b.marca||'','pt-BR')||a.nome.localeCompare(b.nome,'pt-BR'));else arr.sort((a,b)=>(b.destaque?1:0)-(a.destaque?1:0)||a.nome.localeCompare(b.nome,'pt-BR'));return arr}

function render({reset=false}={}){
  if(reset){page=1;offset=0;limit=PAGE_SIZE;preservePrerender=false}
  const arr=filtered();
  const shown=arr.slice(offset,offset+limit);
  if(count)count.textContent=`${arr.length} ${arr.length===1?'produto':'produtos'} de ${products.length}`;
  const canPreserve=preservePrerender&&!hasFilters()&&page===pathPage&&limit===PAGE_SIZE&&grid?.children.length>0;
  if(grid&&!canPreserve)grid.innerHTML=shown.map(card).join('')||'<div class="pnm-empty"><b>Nenhum produto encontrado.</b><span>Tente outra palavra ou remova algum filtro.</span></div>';
  preservePrerender=false;
  const remaining=Math.max(0,arr.length-(offset+limit));
  if(more){more.hidden=remaining===0;more.textContent=remaining?`CARREGAR MAIS (${Math.min(PAGE_SIZE,remaining)})`:'TODOS CARREGADOS'}
  if(pagination)pagination.hidden=hasFilters();
}

[input,universe,type,brand,tier,sort].filter(Boolean).forEach(el=>el.addEventListener(el===input?'input':'change',()=>render({reset:true})));
if(more)more.addEventListener('click',()=>{limit+=PAGE_SIZE;render()});
render();
})();
