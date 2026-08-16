const esc=(s='')=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const activeU=PNM_UNIVERSOS.filter(u=>u.status==='ativo');
  const activeJ=PNM_JORNADAS.filter(j=>j.status==='ativo');
  const officialProducts=PRODUTOS.filter(p=>p.imagemTipo==='oficial');

  document.getElementById('heroProductCount').textContent=PRODUTOS.length;
  document.getElementById('heroUniverseCount').textContent=activeU.length;
  document.getElementById('heroJourneyCount').textContent='4';
  document.getElementById('heroImageCount').textContent=officialProducts.length;

  document.getElementById('homeUniverses').innerHTML=activeU.map((u,i)=>{
    const n=PNMProductsForUniverse(u.id).length;
    const highlights=u.id==='casa'?'CASA STUDIO • COZINHA • AUTOMAÇÃO':u.id==='gamer'?'PC • SETUP • PERIFÉRICOS':'MOBILE • ÁUDIO • ACESSÓRIOS';
    return `<a class="home-universe-card ${u.cor} featured-${i}" href="${u.href}"><span class="universe-symbol">${u.icon}</span><div><small>${n} ${PNMPlural(n,'PRODUTO CONECTADO','PRODUTOS CONECTADOS')}</small><h3>${u.nome}</h3><p>${u.descricao}</p><em>${highlights}</em></div><b>→</b></a>`
  }).join('');

  document.getElementById('homeJourneys').innerHTML=activeJ.slice(0,8).map((j,i)=>`<a class="journey-card active journey-rank-${i}" href="${j.href}"><span class="journey-icon">${j.icon}</span><small>PROJETO OU GUIA</small><h3>${j.nome}</h3><p>${j.descricao}</p><strong>COMEÇAR →</strong></a>`).join('');

  const cfg={
    mobile:[['smartphone','📱','Smartphones','smartphones'],['smartwatch','⌚','Smartwatches','smartwatches'],['fone','🎧','Fones','fones-de-ouvido'],['tablet','📲','Tablets','tablets']],
    ent:[['tv','📺','TVs','tvs'],['projetor','📽️','Projetores','projetores'],['soundbar','🎬','Soundbars','soundbars'],['caixa','🔊','Caixas de som','caixas-de-som']],
    pc:[['notebook','💻','Notebooks','notebooks'],['monitor','🖥️','Monitores','monitores'],['gamer','🧩','Peças de PC','pecas-pc'],['acessorio','🔌','Acessórios Tech','acessorios-tech']],
    house:[['casa','🏠','Casa Inteligente','ambiente-casa'],['cozinha','🍳','Cozinha','ambiente-cozinha'],['lavanderia','🧺','Lavanderia','lavanderia'],['internet','🛰️','Starlink & Internet','internet']]
  };
  function card(x){const [type,icon,name,href]=x,n=PRODUTOS.filter(p=>p.tipoProduto===type).length;return `<a class="category-portal-card" href="${href}"><div class="portal-icon">${icon}</div><span class="kicker">${n} ${PNMPlural(n,'produto','produtos')}</span><h3>${name}</h3><p>Explore, filtre e compare.</p><strong>EXPLORAR →</strong></a>`}
  document.getElementById('cat-mobile').innerHTML=cfg.mobile.map(card).join('');
  document.getElementById('cat-ent').innerHTML=cfg.ent.map(card).join('');
  document.getElementById('cat-pc').innerHTML=cfg.pc.map(card).join('');
  document.getElementById('cat-house').innerHTML=cfg.house.map(card).join('');
  document.getElementById('totalCount').textContent=PRODUTOS.length+' produtos únicos no catálogo';

  const homeNav=document.getElementById('nav');
  if(homeNav&&!homeNav.querySelector('a[href="dewalt"]')){const catalogLink=homeNav.querySelector('a[href="catalogo"]'),dw=document.createElement('a');dw.href='dewalt';dw.textContent='DeWalt';if(catalogLink)catalogLink.insertAdjacentElement('afterend',dw);else homeNav.appendChild(dw)}
  const quickRow=document.querySelector('.home-quick-searches');
  if(quickRow&&!quickRow.querySelector('a[href="dewalt"]'))quickRow.insertAdjacentHTML('beforeend','<a href="dewalt">Linha DeWalt</a>');

  document.getElementById('officialImageCount').textContent=officialProducts.length+' '+PNMPlural(officialProducts.length,'imagem real','imagens reais')+' confirmadas';
  document.getElementById('officialProductStrip').innerHTML=officialProducts.slice(0,10).map(p=>`<a class="official-showcase-card" href="produto-${p.id}"><div class="photo"><img src="${esc(p.imagem)}" loading="lazy" decoding="async" alt="${esc(p.imagemAlt||p.nome)}"></div><small>✓ FONTE OFICIAL</small><b>${esc(p.nome)}</b><span>${esc(p.marca)}</span></a>`).join('');

  function recent(){const A=PNMRecent.get().map(id=>PRODUTOS.find(p=>p.id===id)).filter(Boolean).slice(0,12);document.getElementById('recentSection').style.display=A.length?'block':'none';document.getElementById('recentGrid').innerHTML=A.map(p=>`<a class="recent-card" href="produto-${p.id}"><img src="${esc(p.imagem)}" loading="lazy" decoding="async" alt=""><b>${esc(p.nome)}</b><span>${esc(p.marca)}</span></a>`).join('')}
  document.getElementById('clearRecent').onclick=()=>{PNMRecent.clear();recent()};
  recent();

  const decisionModes={
    buscar:{title:'Escolha o caminho mais rápido.',text:'Você não precisa saber a categoria certa. Busque por produto, marca ou ideia e descubra caminhos possíveis.',href:'busca',cta:'COMEÇAR AGORA →'},
    comparar:{title:'Veja a diferença antes do clique.',text:'Compare produtos lado a lado com linguagem simples, critérios técnicos e contexto de uso.',href:'comparativo-geral',cta:'ABRIR COMPARADORES →'},
    montar:{title:'Planeje antes de comprar.',text:'Crie um projeto de ambiente, registre restrições e leve ao carrinho apenas o que fizer sentido.',href:'montar',cta:'ABRIR PROJETOS →'},
    salvar:{title:'Pesquise hoje. Decida depois.',text:'Use Favoritos e Minha Lista para guardar opções enquanto amadurece sua escolha.',href:'minha-lista',cta:'ABRIR MINHA LISTA →'}
  };
  document.querySelectorAll('#decisionTabs button').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('#decisionTabs button').forEach(x=>x.classList.remove('active'));btn.classList.add('active');const m=decisionModes[btn.dataset.mode];document.getElementById('decisionTitle').textContent=m.title;document.getElementById('decisionText').textContent=m.text;const c=document.getElementById('decisionCta');c.href=m.href;c.textContent=m.cta;}));

  const searchInput=document.getElementById('homeSearchInput'),suggest=document.getElementById('homeSearchSuggestions');
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  function renderSuggestions(){const q=norm(searchInput.value.trim());if(q.length<2){suggest.hidden=true;suggest.innerHTML='';return}const matches=PRODUTOS.filter(p=>norm([p.nome,p.marca,p.tipoProduto,p.subtipoCasa,p.subtipoCozinha,p.subtipoLavanderia,p.subtipoGamer,p.subtipoAcessorio].join(' ')).includes(q)).slice(0,6);if(!matches.length){suggest.hidden=false;suggest.innerHTML=`<a class="search-all" href="busca?q=${encodeURIComponent(searchInput.value)}">Buscar por “${esc(searchInput.value)}” em todo o catálogo →</a>`;return}suggest.hidden=false;suggest.innerHTML=matches.map(p=>`<a href="produto-${p.id}"><img src="${esc(p.imagem)}" loading="lazy" decoding="async" alt=""><span><b>${esc(p.nome)}</b><small>${esc(p.marca)}</small></span><strong>→</strong></a>`).join('')+`<a class="search-all" href="busca?q=${encodeURIComponent(searchInput.value)}">Ver todos os resultados →</a>`}
  searchInput.addEventListener('input',renderSuggestions);
  searchInput.addEventListener('focus',renderSuggestions);
  document.addEventListener('click',e=>{if(!e.target.closest('.home-search-field'))suggest.hidden=true});
  document.querySelectorAll('.home-quick-searches [data-q]').forEach(b=>b.addEventListener('click',()=>{searchInput.value=b.dataset.q;location.href='busca?q='+encodeURIComponent(b.dataset.q)}));
