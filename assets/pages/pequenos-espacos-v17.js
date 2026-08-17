(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=(s='')=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const norm=(s='')=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
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
  const productsForEnv=window.PNMProductsForEnvironment?PNMProductsForEnvironment('pequenos-espacos'):(typeof PRODUTOS==='undefined'?[]:PRODUTOS);

  if($('heroCount'))$('heroCount').textContent=productsForEnv.length;

  function num(value){const n=Number(String(value||'').replace(',','.'));return Number.isFinite(n)&&n>0?n:0;}
  function labelProfile(){return profiles.find(x=>x[0]===profile)?.[1]||'STUDIO';}
  function prettyProfile(){return labelProfile().toLowerCase().replace(/^./,x=>x.toUpperCase()).replace('apê','Apê').replace('home office','Home office');}
  function intentData(){return intentCopy[intent]||intentCopy.cozinhar;}

  function renderProfiles(){
    $('profiles').innerHTML=profiles.map(([id,name,description],index)=>`<button type="button" class="ps-profile ${profile===id?'active':''}" data-profile="${id}" aria-pressed="${profile===id}"><small>${String(index+1).padStart(2,'0')}</small><b>${name}</b><small>${description}</small></button>`).join('');
    document.querySelectorAll('[data-profile]').forEach(button=>button.addEventListener('click',()=>{profile=button.dataset.profile;renderProfiles();syncSummary();}));
  }

  function renderIntents(){
    $('intents').innerHTML=PNM_COMPACT_INTENTS.map((item,index)=>{
      const copy=intentCopy[item.id]||[item.id.toUpperCase(),item.nome,item.descricao];
      const n=PNMCompactProducts(item.id).length;
      return `<button type="button" class="ps-intent ${intent===item.id?'active':''}" data-intent="${item.id}" aria-pressed="${intent===item.id}"><small>${String(index+1).padStart(2,'0')} • ${esc(copy[0])}</small><b>${esc(copy[1])}</b><span>${esc(copy[2])} • ${n} ${PNMPlural(n,'produto','produtos')}</span></button>`;
    }).join('');
    document.querySelectorAll('[data-intent]').forEach(button=>button.addEventListener('click',()=>{intent=button.dataset.intent;renderIntents();renderFilters();renderProducts();syncSummary();}));
  }

  function renderFilters(){
    $('filters').innerHTML=PNM_COMPACT_INTENTS.map(item=>{
      const copy=intentCopy[item.id]||[item.id.toUpperCase(),item.nome];
      return `<button type="button" class="${intent===item.id?'active':''}" data-filter="${item.id}" aria-pressed="${intent===item.id}">${esc(copy[1])}</button>`;
    }).join('');
    document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{intent=button.dataset.filter;renderIntents();renderFilters();renderProducts();syncSummary();}));
  }

  function renderProducts(){
    const copy=intentData();
    const all=PNMCompactProducts(intent).filter(p=>!query||norm([p.nome,p.marca,p.resumo,...(p.chips||[]),...Object.values(p.especificacoes||{})].join(' ')).includes(query));
    const list=PNMCompactBest(all,12);
    $('catalogTitle').textContent=copy[1];
    $('catalogCount').textContent=all.length+' '+PNMPlural(all.length,'produto conectado','produtos conectados')+(all.length>list.length?' • mostrando 12 selecionados':'');
    $('compareLink').href='comparativo-compactos?tipo='+(compareByIntent[intent]||'cozinha-airfryer');
    $('products').innerHTML=list.map(p=>{
      const image=p.imagem||p.imagemFallback||'assets/product-placeholder.svg';
      const fallback=p.imagemFallback||'assets/product-placeholder.svg';
      return `<article class="compact-product-card"><div class="compact-product-media">${p.imagemTipo==='oficial'?'<span class="official-image-badge">✓ FONTE OFICIAL</span>':''}<img src="${esc(image)}" width="600" height="600" loading="lazy" decoding="async" data-fallback-src="${esc(fallback)}" alt="${esc(p.imagemAlt||p.nome)}"></div><div class="compact-product-copy"><small>${esc(p.marca)} • ${esc(p.categoria)}</small><h3>${esc(p.nome)}</h3><p>${esc(p.resumo)}</p><div class="compact-tags">${PNMCompactTags(p).map(tag=>`<span>${esc(tag)}</span>`).join('')}</div><div class="actions"><a class="btn btn-dark" href="produto-${encodeURIComponent(p.id)}">ANALISAR →</a><a class="btn btn-outline offer" href="${esc(p.linkAfiliado)}" target="_blank" rel="sponsored nofollow noopener noreferrer">VER NA LOJA ↗</a></div></div></article>`;
    }).join('');
    $('empty').style.display=list.length?'none':'block';
    setTimeout(()=>window.PNMEnsureAffiliateLinks?.(),0);
  }

  function syncSummary(){
    const length=num($('spaceLength').value),width=num($('spaceWidth').value),height=num($('spaceHeight').value),area=length&&width?length*width:0;
    $('summaryTitle').textContent=prettyProfile()+' compacto';
    $('summaryArea').textContent=area?area.toLocaleString('pt-BR',{maximumFractionDigits:1})+' m²':'Não informada';
    $('summaryFocus').textContent=intentData()[1];
    $('summaryMeasure').textContent=length&&width?(height?'Base + pé-direito':'Base informada'):'Pendentes';
    $('summaryAlert').innerHTML=length&&width?'<b>Base registrada</b><p>O Projeto receberá comprimento e largura. Confirme também folgas, abertura e medidas do produto.</p>':'<b>Antes de comprar</b><p>Registre comprimento e largura para tratar encaixe como restrição real.</p>';
  }

  function createProject(){
    if(!window.PNMProjects){location.href='montar?novo=compacto';return;}
    const length=$('spaceLength').value.trim(),width=$('spaceWidth').value.trim(),height=$('spaceHeight').value.trim();
    const reqKey=requirementByIntent[intent];
    const base=PNMProjects.definitions.compacto?.requirements||[];
    const requirements=Object.fromEntries(base.map(([key])=>[key,key===reqKey?'need':'unknown']));
    const project=PNMProjects.create('compacto',{name:prettyProfile()+' compacto',dimensions:{length,width,height},requirements});
    location.href=`projeto?projeto=${encodeURIComponent(project.id)}&aba=planning`;
  }

  ['spaceLength','spaceWidth','spaceHeight'].forEach(id=>$(id)?.addEventListener('input',syncSummary));
  $('search')?.addEventListener('input',event=>{query=norm(event.target.value.trim());renderProducts();});
  $('createProject')?.addEventListener('click',createProject);

  renderProfiles();
  renderIntents();
  renderFilters();
  renderProducts();
  syncSummary();
})();