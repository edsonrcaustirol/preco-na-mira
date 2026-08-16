(()=>{
 const esc=(s='')=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 const profiles=[
  ['studio','STUDIO','Ambientes integrados'],['kitnet','KITNET','Essencial e funcional'],['ape-1-quarto','APÊ 1 QUARTO','Poucos cômodos'],['quarto','QUARTO','Dormir e guardar'],
  ['cozinha','COZINHA','Bancada disputada'],['home-office','HOME OFFICE','Trabalho flexível'],['lavanderia','LAVANDERIA','Operação enxuta'],['banheiro','BANHEIRO','Medidas críticas']
 ];
 const intentCopy={
  cozinhar:['COZINHA','Cozinhar','Bancada e cocção'],lavar:['LAVANDERIA','Lavar','Água, esgoto e operação'],trabalhar:['TRABALHO','Trabalhar','Posto flexível'],limpar:['LIMPEZA','Limpar','Piso livre e automação'],
  banheiro:['BANHEIRO','Banheiro','Louças, metais e banho'],iluminar:['ILUMINAÇÃO','Iluminar','Luz funcional e conforto'],conectar:['REDE','Conectar','Internet e dispositivos'],relaxar:['ENTRETENIMENTO','Relaxar','Tela, projeção e áudio']
 };
 const compareByIntent={cozinhar:'cozinha-airfryer',lavar:'lavanderia-compacta',trabalhar:'trabalho-notebook',limpar:'limpeza-robot',banheiro:'banheiro-cuba',iluminar:'luz-conectada',conectar:'rede-roteador',relaxar:'entretenimento-tv'};
 const requirementByIntent={cozinhar:'cozinha',lavar:'lavanderia',trabalhar:'trabalho',limpar:'limpeza',banheiro:'banheiro',iluminar:'iluminacao',conectar:'conectividade',relaxar:'entretenimento'};
 let profile=new URLSearchParams(location.search).get('perfil')||'studio';
 let intent=new URLSearchParams(location.search).get('foco')||'cozinhar';
 let query='';
 const $=id=>document.getElementById(id);
 const productsForEnv=window.PNMProductsForEnvironment?PNMProductsForEnvironment('pequenos-espacos'):(typeof PRODUTOS==='undefined'?[]:PRODUTOS);
 $('heroCount').textContent=productsForEnv.length;
 function num(v){const n=Number(String(v||'').replace(',','.'));return Number.isFinite(n)&&n>0?n:0}
 function labelProfile(){return profiles.find(x=>x[0]===profile)?.[1]||'STUDIO'}
 function intentData(){return intentCopy[intent]||intentCopy.cozinhar}
 function renderProfiles(){
  $('profiles').innerHTML=profiles.map(([id,n,d],i)=>`<button type="button" class="ps-profile ${profile===id?'active':''}" data-profile="${id}"><small>${String(i+1).padStart(2,'0')}</small><b>${n}</b><small>${d}</small></button>`).join('');
  document.querySelectorAll('[data-profile]').forEach(b=>b.addEventListener('click',()=>{profile=b.dataset.profile;renderProfiles();syncSummary()}));
 }
 function renderIntents(){
  $('intents').innerHTML=PNM_COMPACT_INTENTS.map((x,i)=>{const c=intentCopy[x.id]||[x.id.toUpperCase(),x.nome,x.descricao],n=PNMCompactProducts(x.id).length;return `<button type="button" class="ps-intent ${intent===x.id?'active':''}" data-intent="${x.id}"><small>${String(i+1).padStart(2,'0')} • ${esc(c[0])}</small><b>${esc(c[1])}</b><span>${esc(c[2])} • ${n} ${PNMPlural(n,'produto','produtos')}</span></button>`}).join('');
  document.querySelectorAll('[data-intent]').forEach(b=>b.addEventListener('click',()=>{intent=b.dataset.intent;renderIntents();renderFilters();renderProducts();syncSummary()}));
 }
 function renderFilters(){
  $('filters').innerHTML=PNM_COMPACT_INTENTS.map(x=>{const c=intentCopy[x.id]||[x.id.toUpperCase(),x.nome];return `<button type="button" class="${intent===x.id?'active':''}" data-filter="${x.id}">${esc(c[1])}</button>`}).join('');
  document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{intent=b.dataset.filter;renderIntents();renderFilters();renderProducts();syncSummary()}));
 }
 function renderProducts(){
  const info=PNM_COMPACT_INTENTS.find(x=>x.id===intent),copy=intentData();
  const all=PNMCompactProducts(intent).filter(p=>!query||[p.nome,p.marca,p.resumo,...(p.chips||[]),...Object.values(p.especificacoes||{})].join(' ').toLowerCase().includes(query));
  const list=PNMCompactBest(all,12);
  $('catalogTitle').textContent=copy[1];
  $('catalogCount').textContent=all.length+' '+PNMPlural(all.length,'produto conectado','produtos conectados')+(all.length>list.length?' • exibindo 12':'');
  $('compareLink').href='comparativo-compactos.html?tipo='+(compareByIntent[intent]||'cozinha-airfryer');
  $('products').innerHTML=list.map(p=>`<article class="compact-product-card"><div class="compact-product-media">${p.imagemTipo==='oficial'?'<span class="official-image-badge">✓ FONTE OFICIAL</span>':''}<img src="${esc(p.imagem)}" loading="lazy" decoding="async" data-fallback-src="${esc(p.imagemFallback||p.imagem)}" alt="${esc(p.imagemAlt||p.nome)}"></div><div class="compact-product-copy"><small>${esc(p.marca)} • ${esc(p.categoria)}</small><h3>${esc(p.nome)}</h3><p>${esc(p.resumo)}</p><div class="compact-tags">${PNMCompactTags(p).map(x=>`<span>${esc(x)}</span>`).join('')}</div><div class="actions"><a class="btn btn-dark" href="produto-${encodeURIComponent(p.id)}.html">ANALISAR →</a><a class="btn btn-outline offer" href="${esc(p.linkAfiliado)}" target="_blank" rel="sponsored nofollow noopener noreferrer">OFERTA ↗</a></div></div></article>`).join('');
  $('empty').style.display=list.length?'none':'block';
  setTimeout(()=>window.PNMEnsureAffiliateLinks?.(),0);
 }
 function syncSummary(){
  const l=num($('spaceLength').value),w=num($('spaceWidth').value),h=num($('spaceHeight').value),area=l&&w?l*w:0;
  $('summaryTitle').textContent=labelProfile().replace('APÊ','Apê').replace('HOME OFFICE','Home office').replace('STUDIO','Studio').replace('KITNET','Kitnet').replace('COZINHA','Cozinha').replace('LAVANDERIA','Lavanderia').replace('BANHEIRO','Banheiro').replace('QUARTO','Quarto')+' compacto';
  $('summaryArea').textContent=area?area.toLocaleString('pt-BR',{maximumFractionDigits:1})+' m²':'Não informada';
  $('summaryFocus').textContent=intentData()[1];
  $('summaryMeasure').textContent=l&&w?(h?'Base + pé-direito':'Base informada'):'Pendentes';
  $('summaryAlert').innerHTML=l&&w?'<b>Base registrada</b><p>O Projeto receberá comprimento e largura. Ainda confirme folgas, abertura, acesso e medidas do produto antes da compra.</p>':'<b>Antes de comprar</b><p>Registre comprimento e largura para o Projeto tratar encaixe como restrição real.</p>';
 }
 function createProject(){
  if(!window.PNMProjects){location.href='montar.html?novo=compacto';return}
  const l=$('spaceLength').value.trim(),w=$('spaceWidth').value.trim(),h=$('spaceHeight').value.trim();
  const reqKey=requirementByIntent[intent],base=PNMProjects.definitions.compacto?.requirements||[];
  const requirements=Object.fromEntries(base.map(([k])=>[k,k===reqKey?'need':'unknown']));
  const p=PNMProjects.create('compacto',{name:`${labelProfile().replace('APÊ','Apê').replace('STUDIO','Studio').replace('KITNET','Kitnet').replace('HOME OFFICE','Home office').replace('COZINHA','Cozinha').replace('LAVANDERIA','Lavanderia').replace('BANHEIRO','Banheiro').replace('QUARTO','Quarto')} compacto`,dimensions:{length:l,width:w,height:h},requirements});
  location.href=`projeto.html?projeto=${encodeURIComponent(p.id)}&aba=planning`;
 }
 ['spaceLength','spaceWidth','spaceHeight'].forEach(id=>$(id).addEventListener('input',syncSummary));
 $('search').addEventListener('input',e=>{query=e.target.value.trim().toLowerCase();renderProducts()});
 ['createProjectTop','createProject','createProjectBottom'].forEach(id=>$(id)?.addEventListener('click',createProject));
 $('menu')?.addEventListener('click',()=>{$('nav')?.classList.toggle('open')});
 renderProfiles();renderIntents();renderFilters();renderProducts();syncSummary();
})();
