import { CENTRAL_AREAS, CENTRAL_CONTRACTS } from './contracts.mjs';

const PATHS = Object.freeze({
  painel: '/painel',
  produtos: '/produtos',
  'novo-produto': '/novo-produto',
  'saude-links': '/saude-links',
  historico: '/historico',
});

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeJson(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
}

function publicImageUrl(value) {
  const source = String(value || '').trim();
  if (!source) return 'https://preconamira.com.br/assets/product-photo-unavailable.svg';
  if (/^https:\/\//i.test(source)) return source;
  return `https://preconamira.com.br/${source.replace(/^\/+/, '')}`;
}

function options(values) {
  return [...new Set(values.filter(Boolean).map(String))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
    .map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
    .join('');
}

function card(product, index) {
  const badges = [
    product.oferta === true ? '<span>Oferta</span>' : '',
    product.destaque === true ? '<span>Destaque</span>' : '',
    product.selo ? `<span>${escapeHtml(product.selo)}</span>` : '',
  ].join('');
  return `<article class="product" data-product-index="${index}"><img src="${escapeHtml(publicImageUrl(product.imagem))}" alt="${escapeHtml(product.imagemAlt || product.nome)}" loading="lazy" decoding="async"><div class="product-copy"><h2>${escapeHtml(product.nome)}</h2><div class="meta">${escapeHtml(product.categoria || 'Sem categoria')} · ${escapeHtml(product.marca || 'Sem marca')}</div><code>${escapeHtml(product.id)}</code>${badges ? `<div class="badges">${badges}</div>` : ''}</div><button type="button" data-open-product="${index}">Ver detalhes</button></article>`;
}

function clientScript(products) {
  return `(function(){'use strict';
const products=${safeJson(products)},cards=[...document.querySelectorAll('[data-product-index]')],q=document.getElementById('q'),cat=document.getElementById('cat'),brand=document.getElementById('brand'),offer=document.getElementById('offer'),highlight=document.getElementById('highlight'),sort=document.getElementById('sort'),grid=document.getElementById('grid'),count=document.getElementById('count'),empty=document.getElementById('empty'),detail=document.getElementById('detail'),title=document.getElementById('detail-title'),data=document.getElementById('detail-data'),publication=document.getElementById('detail-publication'),url=document.getElementById('detail-url'),open=document.getElementById('detail-open'),copy=document.getElementById('detail-copy');
const norm=v=>String(v??'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().trim(),bool=(v,e)=>e==='all'||(e==='true'?v===true:v!==true),yes=v=>v===true?'Sim':'Não';
function matches(p){const n=norm(q.value);return [p.nome,p.id,p.marca,p.categoria,p.linkAfiliado].some(v=>norm(v).includes(n))&&(!cat.value||norm(p.categoria)===norm(cat.value))&&(!brand.value||norm(p.marca)===norm(brand.value))&&bool(p.oferta,offer.value)&&bool(p.destaque,highlight.value)}
function cmp(a,b){const x=norm(products[a].nome),y=norm(products[b].nome);if(x<y)return-1;if(x>y)return 1;return String(products[a].id||'').localeCompare(String(products[b].id||''))}
function apply(){const visible=[];cards.forEach(c=>{const i=Number(c.dataset.productIndex),show=matches(products[i]);c.hidden=!show;if(show)visible.push(c)});visible.sort((a,b)=>{const r=cmp(Number(a.dataset.productIndex),Number(b.dataset.productIndex));return sort.value==='name-desc'?-r:r});visible.forEach(c=>grid.appendChild(c));count.textContent=visible.length+' de '+products.length+' produtos';empty.hidden=visible.length!==0}
function row(k,v){const r=document.createElement('div');r.className='row';const a=document.createElement('span'),b=document.createElement('strong');a.textContent=k;b.textContent=v==null||v===''?'—':String(v);r.append(a,b);return r}
function rows(target,items){target.replaceChildren(...items.map(x=>row(x[0],x[1])))}
function show(i){const p=products[i];if(!p)return;title.textContent=p.nome||p.id;rows(data,[['ID',p.id],['Marca',p.marca],['Categoria',p.categoria],['Categoria ID',p.categoriaId],['Tipo',p.tipoProduto],['Resumo',p.resumo]]);rows(publication,[['Loja',p.loja],['Oferta',yes(p.oferta)],['Destaque',yes(p.destaque)],['Selo',p.selo],['Fonte técnica',p.fonteNome||p.fonteTecnica]]);url.textContent=p.linkAfiliado||'—';open.href=/^https:\/\//i.test(String(p.linkAfiliado||''))?p.linkAfiliado:'#';copy.dataset.url=p.linkAfiliado||'';detail.hidden=false;detail.scrollIntoView({behavior:'smooth',block:'start'})}
q.addEventListener('input',apply);[cat,brand,offer,highlight,sort].forEach(x=>x.addEventListener('change',apply));grid.addEventListener('click',e=>{const b=e.target.closest('[data-open-product]');if(b)show(Number(b.dataset.openProduct))});document.getElementById('detail-close').addEventListener('click',()=>{detail.hidden=true});copy.addEventListener('click',async()=>{if(!copy.dataset.url)return;try{await navigator.clipboard.writeText(copy.dataset.url);copy.textContent='Copiado'}catch{copy.textContent='Falha ao copiar'}setTimeout(()=>{copy.textContent='Copiar'},1400)});apply();})();`;
}

export function renderProductsPage(projection, nonce) {
  if (!projection || projection.contract !== CENTRAL_CONTRACTS.catalog.projection.contract || projection.source !== CENTRAL_CONTRACTS.catalog.owner || !Array.isArray(projection.products) || projection.total !== projection.products.length) {
    throw new Error('invalid-central-products-projection');
  }
  const nav = CENTRAL_AREAS.map(area => `<a href="${PATHS[area.id]}"${area.id === 'produtos' ? ' aria-current="page"' : ''}>${escapeHtml(area.label)}</a>`).join('');
  const cards = projection.products.map(card).join('');
  const categories = options(projection.products.map(product => product.categoria));
  const brands = options(projection.products.map(product => product.marca));
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Produtos — Preço na Mira</title><style>
:root{font-family:Inter,system-ui,sans-serif;color:#eaf2ff;background:#08111f}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#08111f;overflow-x:hidden}.layout{display:grid;grid-template-columns:230px minmax(0,1fr);min-height:100vh}.side{padding:24px 18px;border-right:1px solid #203047}.brand{font-weight:800}.sub,.muted{color:#8ea3bd}.side nav{display:grid;gap:6px;margin-top:24px}.side a{color:#cfe0f5;text-decoration:none;padding:10px;border-radius:8px}.side a[aria-current=page],.side a:hover{background:#14233a}.main{padding:30px;min-width:0;max-width:1400px;width:100%}h1{margin:6px 0}.status,.badges,.actions{display:flex;gap:7px;flex-wrap:wrap}.status{margin:20px 0}.status span,.badges span{border:1px solid #34506f;border-radius:999px;padding:5px 8px;font-size:11px}.toolbar{display:grid;grid-template-columns:minmax(220px,2fr) repeat(5,minmax(120px,1fr));gap:9px;margin:18px 0}.field{display:grid;gap:5px}.field label{font-size:11px;color:#8ea3bd}.field input,.field select{min-width:0;width:100%;border:1px solid #2b415f;background:#0e1b2d;color:#eaf2ff;border-radius:9px;padding:10px}.result{color:#9fb8d2;margin:12px 0}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.product{display:grid;grid-template-columns:78px minmax(0,1fr);gap:11px;padding:12px;border:1px solid #223751;background:#0e1b2d;border-radius:13px;min-width:0}.product[hidden]{display:none}.product img{width:78px;height:78px;object-fit:contain;background:#fff;border-radius:9px}.product-copy{min-width:0}.product h2{font-size:15px;margin:0 0 6px}.meta{font-size:11px;color:#9fb8d2}.product code{display:block;margin-top:6px;color:#7890aa;overflow-wrap:anywhere}.product button,.actions button,.actions a,.close{border:1px solid #2b415f;background:#14233a;color:#eaf2ff;border-radius:8px;padding:8px 10px;text-decoration:none}.product>button{grid-column:1/-1}.detail{margin-top:20px;border:1px solid #2b415f;background:#0b1828;border-radius:14px;padding:18px;min-width:0}.detail[hidden],.empty[hidden]{display:none}.detail-head{display:flex;justify-content:space-between;gap:12px}.detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:14px}.section{border:1px solid #223751;border-radius:10px;padding:13px;min-width:0}.section h3{font-size:12px;color:#8ea3bd;margin:0 0 10px}.row{display:grid;grid-template-columns:110px minmax(0,1fr);gap:8px;padding:5px 0;border-bottom:1px solid #182a41}.row span{color:#7890aa;font-size:12px}.row strong{font-size:13px;font-weight:500;overflow-wrap:anywhere}.affiliate{display:block;overflow-wrap:anywhere;word-break:break-word;color:#a9c8ec;margin-bottom:10px}.actions button:disabled{opacity:.45}.empty{padding:20px;border:1px dashed #34506f;border-radius:12px;color:#9fb8d2}@media(max-width:1100px){.toolbar{grid-template-columns:repeat(3,minmax(0,1fr))}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:800px){.layout{display:block}.side{border-right:0;border-bottom:1px solid #203047}.side nav{display:flex;flex-wrap:wrap}.main{padding:22px 16px}.toolbar,.grid,.detail-grid{grid-template-columns:1fr}.row{grid-template-columns:1fr}}
</style></head><body><div class="layout"><aside class="side"><div class="brand">Preço na Mira</div><div class="sub">Central Operacional</div><nav>${nav}</nav></aside><main class="main"><div class="muted">L2.4A · pnm.central-products/v1</div><h1>Produtos</h1><p class="muted">Consulta read-only derivada de data/produtos-index.js. Nenhuma ação desta tela altera catálogo, GitHub ou produção.</p><div class="status"><span>Somente leitura</span><span>${escapeHtml(projection.contract)}</span><span>${escapeHtml(projection.source)}</span><span data-total="${projection.total}">${projection.total} produtos</span></div>
<section class="toolbar" aria-label="Busca e filtros"><div class="field"><label for="q">Buscar</label><input id="q" type="search" autocomplete="off" placeholder="Nome, ID, marca, categoria ou link"></div><div class="field"><label for="cat">Categoria</label><select id="cat"><option value="">Todas</option>${categories}</select></div><div class="field"><label for="brand">Marca</label><select id="brand"><option value="">Todas</option>${brands}</select></div><div class="field"><label for="offer">Oferta</label><select id="offer"><option value="all">Todas</option><option value="true">Com oferta</option><option value="false">Sem oferta</option></select></div><div class="field"><label for="highlight">Destaque</label><select id="highlight"><option value="all">Todos</option><option value="true">Com destaque</option><option value="false">Sem destaque</option></select></div><div class="field"><label for="sort">Ordenar</label><select id="sort"><option value="name-asc">Nome A–Z</option><option value="name-desc">Nome Z–A</option></select></div></section>
<div class="result"><strong id="count">${projection.total} de ${projection.total} produtos</strong> · busca e filtros locais</div><section class="grid" id="grid" aria-live="polite">${cards}</section><div class="empty" id="empty" hidden>Nenhum produto corresponde aos filtros atuais.</div>
<section class="detail" id="detail" hidden aria-labelledby="detail-title"><div class="detail-head"><div><div class="muted">Detalhe read-only</div><h2 id="detail-title"></h2></div><button class="close" id="detail-close" type="button">Fechar</button></div><div class="detail-grid"><section class="section"><h3>DADOS DO PRODUTO</h3><div id="detail-data"></div></section><section class="section"><h3>PUBLICAÇÃO</h3><div id="detail-publication"></div></section><section class="section"><h3>LINK MERCADO LIVRE</h3><span class="affiliate" id="detail-url"></span><div class="actions"><button id="detail-copy" type="button">Copiar</button><a id="detail-open" href="#" target="_blank" rel="noopener noreferrer sponsored">Abrir</a></div></section><section class="section"><h3>SAÚDE DO LINK</h3><p>Saúde dos links será integrada na próxima etapa.</p></section><section class="section"><h3>AÇÕES</h3><div class="actions"><button type="button" disabled>EDITAR</button><button type="button" disabled>NOVO PRODUTO</button></div></section></div></section>
<script nonce="${escapeHtml(nonce)}">${clientScript(projection.products)}</script></main></div></body></html>`;
}
