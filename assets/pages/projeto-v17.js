(()=>{
 'use strict';
 const $=s=>document.querySelector(s);
 const app=$('#projectApp');
 const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 const shareLink=async(url,title='Projeto — Preço na Mira')=>{
  try{if(navigator.share){await navigator.share({title,url});return true}}catch(e){}
  try{await navigator.clipboard.writeText(url);return true}catch(e){
   const t=document.createElement('textarea');t.value=url;document.body.appendChild(t);t.select();const ok=document.execCommand('copy');t.remove();return ok;
  }
 };
 const params=new URLSearchParams(location.search);
 let imported=false;
 if(params.get('share')){
  const p=PNMProjects.importShared(params.get('share'));
  if(p){params.delete('share');params.set('projeto',p.id);history.replaceState(null,'',`${location.pathname}?${params.toString()}`);imported=true;}
 }
 let project=null;
 const requestedNew=params.get('novo');
 const requestedId=params.get('projeto');
 if(requestedNew){
  project=PNMProjects.create(PNMProjects.environments[requestedNew]?requestedNew:'cozinha');
  params.delete('novo');params.set('projeto',project.id);history.replaceState(null,'',`${location.pathname}?${params.toString()}`);
 }
 if(!project&&requestedId)project=PNMProjects.get(requestedId);
 if(!project&&requestedId){
  const active=PNMProjects.active();
  const type=active?.type||params.get('ambiente')||'cozinha';
  app.innerHTML=`<section class="p4-empty-page"><div class="container"><div class="p4-empty-card"><span class="pj-kicker">PROJETO NÃO ENCONTRADO</span><h1>Este projeto não está salvo neste navegador.</h1><p>Projetos ficam armazenados localmente. Para abrir em outro dispositivo, use um link gerado pela ação Compartilhar.</p><div class="p4-inline-actions"><a class="p4-primary" href="montar">VOLTAR A PROJETOS</a><a class="p4-secondary" href="projeto?novo=${encodeURIComponent(PNMProjects.environments[type]?type:'cozinha')}">CRIAR OUTRO</a></div></div></div></section>`;
  document.title='Projeto não encontrado — Preço na Mira';
  return;
 }
 if(!project)project=PNMProjects.active();
 if(!project){
  app.innerHTML='<section class="p4-empty-page"><div class="container"><div class="p4-empty-card"><span class="pj-kicker">MONTAR • PROJETOS</span><h1>Comece escolhendo o que você quer montar.</h1><p>Você ainda não tem um projeto salvo neste navegador.</p><a class="p4-primary" href="montar">ESCOLHER UM PROJETO →</a></div></div></section>';
  document.title='Comece um projeto — Preço na Mira';
  return;
 }
 PNMProjects.setActive(project.id);
 let tab=params.get('aba')||'overview';
 const tabMap={overview:'Resumo',planning:'O que preciso',products:'Produtos',cart:'Revisar'};
 if(!tabMap[tab])tab='overview';
 const env=()=>PNMProjects.environments[project.type]||PNMProjects.environments.cozinha;
 const def=()=>PNMProjects.definitions[project.type]||PNMProjects.definitions.cozinha;
 const allProducts=()=>typeof PRODUTOS==='undefined'?[]:PRODUTOS;
 const productById=id=>allProducts().find(p=>p.id===id);
 const needs=()=>Object.entries(project.requirements||{}).filter(([,value])=>value==='need');
 const issueList=()=>PNMProjects.diagnostics(project).filter(item=>['critical','warning'].includes(item.level));
 function set(patch){project=PNMProjects.update(project.id,patch)||project;render();}
 function tabHref(key){const q=new URLSearchParams(location.search);q.set('projeto',project.id);q.set('aba',key);q.delete('novo');q.delete('ambiente');return `projeto?${q.toString()}`;}
 function head(){
  const issues=issueList().length;
  return `<section class="p4-work-head"><div class="container p4-project-shell"><div class="p4-work-top"><a class="p4-back" href="montar">← PROJETOS</a><div class="p4-work-actions"><button type="button" data-action="share">COMPARTILHAR</button><button type="button" data-action="duplicate">DUPLICAR</button></div></div><div class="p4-title-row"><div><span class="pj-overline">${esc(env().label)}</span><label class="p4-project-name-label" for="projectName">Nome do projeto</label><input id="projectName" class="p4-project-name" maxlength="60" value="${esc(project.name)}"><p>${issues?`${issues} ${issues===1?'pendência técnica para revisar':'pendências técnicas para revisar'}`:'Sem pendências técnicas críticas neste momento'} • salvo automaticamente</p></div></div><nav class="p4-step-nav" aria-label="Etapas do projeto">${Object.entries(tabMap).map(([key,label],index)=>`<a class="${tab===key?'active':''}" ${tab===key?'aria-current="page"':''} href="${tabHref(key)}"><small>${String(index+1).padStart(2,'0')}</small>${label}${key==='cart'&&project.selection.length?` <span>${project.selection.length}</span>`:''}</a>`).join('')}</nav></div></section>`;
 }
 function diagnosticsHtml(limit=4){
  const items=issueList().slice(0,limit);
  return items.length?`<div class="pj-diagnostics">${items.map(item=>`<article class="pj-diagnostic ${item.level}"><strong>${esc(item.title)}</strong><p>${esc(item.text)}</p></article>`).join('')}</div>`:'<div class="p4-ok-state"><strong>Nenhuma pendência técnica crítica.</strong><span>Continue pela etapa indicada abaixo.</span></div>';
 }
 function nextStep(){
  const needCount=needs().length;
  if(!needCount)return {label:'Diga o que ainda precisa',text:'Essa é a informação que realmente determina quais grupos de produtos aparecem.',href:tabHref('planning'),step:'PASSO 2'};
  if(!project.selection.length)return {label:'Ver produtos relevantes',text:`Você marcou ${needCount} ${needCount===1?'necessidade':'necessidades'}. Agora veja poucas opções por necessidade.`,href:tabHref('products'),step:'PASSO 3'};
  return {label:'Revisar minha seleção',text:`Você já separou ${project.selection.length} ${project.selection.length===1?'produto':'produtos'} para este projeto.`,href:tabHref('cart'),step:'PASSO 4'};
 }
 function overview(){
  const next=nextStep();
  return `<section class="p4-work-main"><div class="container p4-project-shell"><div class="p4-overview-grid"><section class="p4-focus-card"><span class="pj-kicker">${next.step}</span><h1>${esc(next.label)}</h1><p>${esc(next.text)}</p><a class="p4-primary" href="${next.href}">CONTINUAR →</a></section><aside class="p4-status-card"><span class="pj-kicker">RESUMO</span><dl><div><dt>Projeto</dt><dd>${esc(env().label)}</dd></div><div><dt>Marcado como “Preciso”</dt><dd>${needs().length}</dd></div><div><dt>Produtos selecionados</dt><dd>${project.selection.length}</dd></div></dl></aside></div>${issueList().length?`<section class="p4-secondary-panel"><div class="p4-panel-title"><div><span class="pj-kicker">ANTES DE COMPRAR</span><h2>Pendências registradas</h2></div><a href="${tabHref('planning')}">REVISAR CONTEXTO →</a></div>${diagnosticsHtml()}</section>`:''}</div></section>`;
 }
 function requirementRows(){
  return def().requirements.map(([key,label])=>{
   const value=project.requirements[key]||'unknown';
   const status=value==='have'?'Você já tem':value==='need'?'Entra na busca de produtos':value==='skip'?'Fora deste projeto':'Escolha uma opção';
   return `<div class="p4-req"><div class="p4-req-copy"><strong>${esc(label)}</strong><span>${esc(status)}</span></div><div class="p4-choice-switch" data-requirement="${esc(key)}" aria-label="Status de ${esc(label)}">${[['have','JÁ TENHO'],['need','PRECISO'],['skip','NÃO ENTRA']].map(([val,text])=>`<button type="button" class="${value===val?'active':''}" data-value="${val}" aria-pressed="${value===val?'true':'false'}">${text}</button>`).join('')}</div></div>`;
  }).join('');
 }
 function infraFields(){
  const labels={voltage:'Tensão disponível',water:'Ponto de água',drain:'Ponto de esgoto',gas:'Gás',network:'Rede / internet'};
  const options={
   voltage:[['','Não informado'],['127','127 V'],['220','220 V'],['ambos','127 V e 220 V'],['nao-sei','Não sei ainda']],
   water:[['','Não informado'],['sim','Confirmado'],['nao','Não existe'],['planejar','Precisa planejar']],
   drain:[['','Não informado'],['sim','Confirmado'],['nao','Não existe'],['planejar','Precisa planejar']],
   gas:[['','Não informado'],['encanado','Gás encanado'],['botijao','Botijão'],['nao','Sem gás'],['nao-sei','Não sei ainda']],
   network:[['','Não informado'],['wifi','Wi-Fi'],['cabo','Cabo + Wi-Fi'],['planejar','Precisa planejar'],['nao','Não é necessário']]
  };
  return def().infra.map(key=>`<div class="pj-infra-item"><label for="infra-${key}">${labels[key]}</label><select id="infra-${key}" data-infra="${key}">${options[key].map(([value,text])=>`<option value="${value}" ${project.infra[key]===value?'selected':''}>${text}</option>`).join('')}</select></div>`).join('');
 }
 function planning(){
  const needCount=needs().length;
  return `<section class="p4-work-main"><div class="container p4-project-shell"><section class="p4-primary-panel"><div class="p4-panel-title"><div><span class="pj-kicker">DECISÃO PRINCIPAL</span><h1>O que ainda precisa entrar?</h1><p>Somente itens marcados como <strong>Preciso</strong> alimentam a seleção de produtos. “Já tenho” evita recomendações desnecessárias.</p></div></div><div class="p4-req-list">${requirementRows()}</div><div class="p4-panel-actions"><a class="p4-primary" href="${tabHref('products')}">${needCount?'VER PRODUTOS →':'VER RESULTADO →'}</a><span>${needCount?`${needCount} ${needCount===1?'necessidade marcada':'necessidades marcadas'}`:'Nenhuma necessidade marcada ainda'}</span></div></section><details class="p4-tech-details"><summary><span><strong>Contexto técnico</strong><small>Opcional • medidas e infraestrutura para registrar alertas de instalação</small></span><b>+</b></summary><div class="p4-tech-body"><p class="p4-tech-explain">Esses dados ajudam a registrar pendências e cuidados antes da compra. Hoje eles <strong>não escolhem o modelo do produto</strong>; por isso ficam fora da decisão principal.</p><section><h2>Medidas do ambiente</h2><div class="pj-dimensions">${[['length','Comprimento'],['width','Largura'],['height','Pé-direito']].map(([key,label])=>`<div class="pj-field"><label for="dim-${key}">${label}</label><input id="dim-${key}" data-dim="${key}" inputmode="decimal" value="${esc(project.dimensions[key])}" placeholder="0,00"><span class="unit">m</span></div>`).join('')}</div></section><section><h2>Infraestrutura disponível</h2><div class="pj-infra-grid">${infraFields()}</div></section><section><h2>Pendências detectadas</h2>${diagnosticsHtml(99)}</section></div></details></div></section>`;
 }
 function productCard(product,reason){
  const selected=project.selection.includes(product.id);
  const favorite=window.PNMFavorites?.has(product.id);
  const fallback=product.imagemFallback||'assets/product-placeholder.svg';
  const offer=product.linkAfiliado?`<a class="p4-product-link" href="${esc(product.linkAfiliado)}" target="_blank" rel="sponsored nofollow noopener noreferrer">VER NO MERCADO LIVRE ↗</a>`:'';
  return `<article class="p4-product ${selected?'selected':''}"><div class="p4-product-media"><img src="${esc(product.imagem||fallback)}" data-fallback-src="${esc(fallback)}" alt="${esc(product.imagemAlt||product.nome)}" loading="lazy" decoding="async"></div><div class="p4-product-copy"><span class="p4-product-reason">Para: ${esc(reason)}</span><small>${esc(product.marca||product.categoria||'Produto')}</small><h3>${esc(product.nome)}</h3><div class="p4-product-actions"><button type="button" class="p4-select-product ${selected?'selected':''}" data-select-product="${esc(product.id)}">${selected?'REMOVER DO PROJETO':'ADICIONAR AO PROJETO'}</button><a href="produto-${encodeURIComponent(product.id)}">ANALISAR</a><button type="button" data-pj-fav="${esc(product.id)}" aria-pressed="${favorite?'true':'false'}">${favorite?'SALVO':'SALVAR'}</button>${offer}</div></div></article>`;
 }
 function selectedList(){
  const items=project.selection.map(productById).filter(Boolean);
  if(!items.length)return '<div class="p4-empty-state"><strong>Nenhum produto selecionado.</strong><span>Escolha uma opção abaixo para formar o conjunto do projeto.</span></div>';
  return `<div class="p4-selected-list">${items.map(product=>`<div class="p4-selected-item"><img src="${esc(product.imagem||product.imagemFallback||'assets/product-placeholder.svg')}" data-fallback-src="${esc(product.imagemFallback||'assets/product-placeholder.svg')}" alt=""><div><strong>${esc(product.nome)}</strong><span>${esc(product.marca||product.categoria||'Produto')}</span></div><button type="button" data-remove-product="${esc(product.id)}">REMOVER</button></div>`).join('')}</div>`;
 }
 function products(){
  const groups=PNMProjects.recommendations(project,allProducts(),3);
  return `<section class="p4-work-main"><div class="container p4-project-shell"><section class="p4-primary-panel"><div class="p4-panel-title"><div><span class="pj-kicker">RESULTADO</span><h1>Poucas opções, separadas pelo que você pediu.</h1><p>Os grupos abaixo existem porque você marcou essas necessidades como <strong>Preciso</strong>. Não usamos preço, desconto ou compatibilidade que não esteja segura nos dados.</p></div><a href="${tabHref('planning')}">ALTERAR ESCOLHAS</a></div>${groups.length?groups.map(group=>`<section class="p4-rec-group"><div class="p4-rec-head"><div><span>VOCÊ MARCOU “PRECISO”</span><h2>${esc(group.label)}</h2></div><small>${group.items.length} ${group.items.length===1?'opção inicial':'opções iniciais'}</small></div><div class="pj-rec-grid">${group.items.map(product=>productCard(product,group.label)).join('')}</div></section>`).join(''):'<div class="p4-empty-state"><strong>Ainda não há produtos para mostrar.</strong><span>Volte em “O que preciso” e marque pelo menos uma necessidade. Se a base não tiver opção segura para uma necessidade, ela não é fabricada.</span><a class="p4-primary" href="'+tabHref('planning')+'">MARCAR NECESSIDADES →</a></div>'}</section><section class="p4-secondary-panel"><div class="p4-panel-title"><div><span class="pj-kicker">NO PROJETO</span><h2>Sua seleção</h2></div><a href="${tabHref('cart')}">REVISAR →</a></div>${selectedList()}</section></div></section>`;
 }
 function cart(){
  const items=project.selection.map(productById).filter(Boolean);
  const inCart=items.filter(product=>window.PNMCart?.has(product.id));
  return `<section class="p4-work-main"><div class="container p4-project-shell"><section class="p4-primary-panel"><div class="p4-panel-title"><div><span class="pj-kicker">REVISÃO</span><h1>Revise o conjunto antes de comprar.</h1><p>Adicionar ao carrinho organiza sua intenção. Preço, estoque, frete, vendedor, variante e instalação devem ser confirmados no anúncio.</p></div><a href="${tabHref('products')}">VOLTAR A PRODUTOS</a></div>${items.length?`<div class="p4-review-list">${items.map(product=>`<article class="p4-review-item"><img src="${esc(product.imagem||product.imagemFallback||'assets/product-placeholder.svg')}" data-fallback-src="${esc(product.imagemFallback||'assets/product-placeholder.svg')}" alt=""><div><strong>${esc(product.nome)}</strong><span>${esc(product.marca||product.categoria||'Produto')}</span><div class="p4-review-links"><a href="produto-${encodeURIComponent(product.id)}">ANALISAR</a>${product.linkAfiliado?`<a href="${esc(product.linkAfiliado)}" target="_blank" rel="sponsored nofollow noopener noreferrer">MERCADO LIVRE ↗</a>`:''}</div></div><button type="button" class="${window.PNMCart?.has(product.id)?'active':''}" data-cart-product="${esc(product.id)}">${window.PNMCart?.has(product.id)?'REMOVER DO CARRINHO':'ADICIONAR AO CARRINHO'}</button></article>`).join('')}</div><div class="p4-review-actions"><button type="button" class="p4-primary" data-action="cart-all">ADICIONAR TODOS AO CARRINHO</button><a class="p4-secondary" href="carrinho">ABRIR CARRINHO COMPLETO →</a><span>${inCart.length} de ${items.length} no carrinho</span></div>`:'<div class="p4-empty-state"><strong>Nenhum produto no projeto.</strong><span>Escolha produtos antes de revisar.</span><a class="p4-primary" href="'+tabHref('products')+'">VER PRODUTOS →</a></div>'}</section></div></section>`;
 }
 function render(){
  project=PNMProjects.get(project.id)||project;
  const content=tab==='planning'?planning():tab==='products'?products():tab==='cart'?cart():overview();
  app.innerHTML=head()+content;
  document.title=`${project.name} — Projeto | Preço na Mira`;
  if(imported){window.PNMCartToast?.('Projeto compartilhado importado.');imported=false;}
 }
 function updateInput(element){
  if(element.id==='projectName'){project=PNMProjects.update(project.id,{name:element.value.trim()||env().defaultName})||project;return;}
  if(element.dataset.dim){set({dimensions:{[element.dataset.dim]:element.value}});return;}
  if(element.dataset.infra){set({infra:{[element.dataset.infra]:element.value}});}
 }
 document.addEventListener('change',event=>{if(event.target.matches('#projectName,[data-dim],[data-infra]'))updateInput(event.target);});
 document.addEventListener('blur',event=>{if(event.target.id==='projectName')updateInput(event.target);},true);
 document.addEventListener('click',async event=>{
  const req=event.target.closest('[data-requirement] button');
  if(req){const box=req.closest('[data-requirement]');set({requirements:{[box.dataset.requirement]:req.dataset.value}});return;}
  const favorite=event.target.closest('[data-pj-fav]');
  if(favorite){window.PNMFavorites?.toggle(favorite.dataset.pjFav);render();window.PNMCartToast?.(window.PNMFavorites?.has(favorite.dataset.pjFav)?'Salvo nos favoritos.':'Removido dos favoritos.');return;}
  const select=event.target.closest('[data-select-product]');
  if(select){const id=select.dataset.selectProduct;const selection=[...project.selection];const index=selection.indexOf(id);index>=0?selection.splice(index,1):selection.push(id);set({selection});return;}
  const remove=event.target.closest('[data-remove-product]');
  if(remove){set({selection:project.selection.filter(id=>id!==remove.dataset.removeProduct)});return;}
  const cartProduct=event.target.closest('[data-cart-product]');
  if(cartProduct&&window.PNMCart){window.PNMCart.toggle(cartProduct.dataset.cartProduct);render();window.PNMCartToast?.(window.PNMCart.has(cartProduct.dataset.cartProduct)?'Adicionado ao carrinho.':'Removido do carrinho.','VER CARRINHO');return;}
  const action=event.target.closest('[data-action]');
  if(!action)return;
  if(action.dataset.action==='share'){
   const url=new URL('projeto',location.href);url.searchParams.set('share',PNMProjects.encode(project));
   await shareLink(url.toString(),'Projeto — Preço na Mira');window.PNMCartToast?.('Link do projeto copiado.');return;
  }
  if(action.dataset.action==='duplicate'){
   const duplicate=PNMProjects.duplicate(project.id);location.href=`projeto?projeto=${encodeURIComponent(duplicate.id)}`;return;
  }
  if(action.dataset.action==='cart-all'&&window.PNMCart){project.selection.forEach(id=>{if(!window.PNMCart.has(id))window.PNMCart.add(id);});render();window.PNMCartToast?.('Itens do projeto adicionados ao carrinho.','VER CARRINHO');}
 });
 render();
})();
