(function(){
 const storage=(key,limit=999)=>({
   get(){try{return JSON.parse(localStorage.getItem(key)||'[]').filter(Boolean).slice(0,limit)}catch(e){return[]}},
   set(v){const a=[...new Set((v||[]).filter(Boolean))].slice(0,limit);localStorage.setItem(key,JSON.stringify(a));document.dispatchEvent(new CustomEvent('pnm:storage',{detail:{key,value:a}}));return a},
   has(id){return this.get().includes(id)},
   add(id){return this.set([id,...this.get().filter(x=>x!==id)])},
   remove(id){return this.set(this.get().filter(x=>x!==id))},
   toggle(id){const on=this.has(id);on?this.remove(id):this.add(id);return !on},
   clear(){return this.set([])}
 });
 window.PNMFavorites=storage('precoNaMiraFavoritos');
 window.PNMList=storage('precoNaMiraMinhaLista');
 const cartKey='precoNaMiraCarrinhoV1';
 const normalizeCart=(items)=>{const out=[];const seen=new Map();(Array.isArray(items)?items:[]).forEach(raw=>{const id=typeof raw==='string'?raw:String(raw?.id||'');if(!id)return;const qty=Math.max(1,Math.min(99,Number(typeof raw==='string'?1:raw?.qty)||1));if(seen.has(id)){seen.get(id).qty=Math.min(99,seen.get(id).qty+qty)}else{const item={id,qty};seen.set(id,item);out.push(item)}});return out};
 window.PNMCart={
   get(){try{return normalizeCart(JSON.parse(localStorage.getItem(cartKey)||'[]'))}catch(e){return[]}},
   set(items){const value=normalizeCart(items);localStorage.setItem(cartKey,JSON.stringify(value));document.dispatchEvent(new CustomEvent('pnm:storage',{detail:{key:cartKey,value}}));return value},
   has(id){return this.get().some(x=>x.id===id)},
   add(id,qty=1){const items=this.get(),found=items.find(x=>x.id===id);if(found)found.qty=Math.min(99,found.qty+Math.max(1,Number(qty)||1));else items.unshift({id,qty:Math.max(1,Math.min(99,Number(qty)||1))});return this.set(items)},
   remove(id){return this.set(this.get().filter(x=>x.id!==id))},
   setQty(id,qty){const n=Math.max(0,Math.min(99,Number(qty)||0));if(n===0)return this.remove(id);return this.set(this.get().map(x=>x.id===id?{...x,qty:n}:x))},
   toggle(id){if(this.has(id)){this.remove(id);return false}this.add(id);return true},
   count(){return this.get().reduce((n,x)=>n+x.qty,0)},
   distinct(){return this.get().length},
   clear(){return this.set([])}
 };
 window.PNMRecent=storage('precoNaMiraRecentes',18);
 window.PNMRecentSearches=storage('precoNaMiraBuscas',8);
 window.PNMCartToast=function(message,action){let box=document.querySelector('.pnm-cart-toast');if(!box){box=document.createElement('div');box.className='pnm-cart-toast';box.setAttribute('role','status');box.setAttribute('aria-live','polite');document.body.appendChild(box)}box.innerHTML='';const span=document.createElement('span');span.textContent=message;box.appendChild(span);if(action){const a=document.createElement('a');a.href='carrinho';a.textContent=action;box.appendChild(a)}box.classList.add('show');clearTimeout(window.__pnmCartToastTimer);window.__pnmCartToastTimer=setTimeout(()=>box.classList.remove('show'),2600)};
 window.PNMPlural=function(n,sing,plural){return Number(n)===1?sing:(plural||sing+'s')};
 window.PNMRegisterView=function(id){if(id)PNMRecent.add(id)};
 window.PNMCopy=async function(text){try{await navigator.clipboard.writeText(text);return true}catch(e){const t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();const ok=document.execCommand('copy');t.remove();return ok}};
 window.PNMShare=async function(url,title='Preço na Mira'){const u=url||location.href;try{if(navigator.share){await navigator.share({title,url:u});return true}}catch(e){}return PNMCopy(u)};
 window.PNMDataQuality=function(p){if(p?.fonteTecnica)return {kind:'verified',icon:'✓',label:'Especificações com fonte técnica',text:'Há uma fonte técnica cadastrada para conferir as principais especificações.'};return {kind:'check',icon:'!',label:'Confira a variante',text:'Use a ficha como orientação e confirme modelo/configuração no anúncio antes da compra.'}};
 function norm(s=''){return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}
 function sameSubtype(a,b){if(a.tipoProduto==='gamer')return a.subtipoGamer===b.subtipoGamer;if(a.tipoProduto==='casa')return a.subtipoCasa===b.subtipoCasa;if(a.tipoProduto==='cozinha')return a.subtipoCozinha===b.subtipoCozinha;if(a.tipoProduto==='lavanderia')return a.subtipoLavanderia===b.subtipoLavanderia;if(a.tipoProduto==='acessorio')return a.subtipoAcessorio===b.subtipoAcessorio;if(a.tipoProduto==='obra')return a.subtipoObra===b.subtipoObra;if(a.tipoProduto==='instalacao')return a.subtipoInstalacao===b.subtipoInstalacao;if(a.tipoProduto==='acabamento')return a.subtipoAcabamento===b.subtipoAcabamento;return true}
 window.PNMAlternatives=function(p,limit=4){if(!p||typeof PRODUTOS==='undefined')return[];return PRODUTOS.filter(q=>q.id!==p.id&&q.tipoProduto===p.tipoProduto&&sameSubtype(p,q)).sort((a,b)=>(a.marca!==p.marca?0:1)-(b.marca!==p.marca?0:1)).slice(0,limit)};
 const complements={smartphone:['fone','smartwatch'],fone:['smartphone'],smartwatch:['smartphone','fone'],tablet:['fone','smartphone','notebook'],tv:['soundbar'],projetor:['soundbar'],soundbar:['tv'],notebook:['monitor'],monitor:['notebook']};
 const gamerComp={cpu:['motherboard','ram','cooling','gpu'],motherboard:['cpu','ram','case'],gpu:['psu','monitor','case'],ram:['motherboard','cpu'],ssd:['motherboard'],psu:['gpu','case'],case:['motherboard','gpu','cooling'],cooling:['cpu','case'],keyboard:['mouse','monitor'],mouse:['keyboard','monitor']};
 const houseComp={assistente:['iluminacao','energia','camera','robot'],rede:['assistente','camera','robot'],iluminacao:['assistente','energia'],energia:['assistente','iluminacao'],camera:['rede','assistente','acesso'],acesso:['camera','assistente'],robot:['assistente','rede']};
 const kitchenComp={airfryer:['microondas','purificador','cafeteira-filtro'],microondas:['airfryer','forno','cooktop'],forno:['cooktop','microondas','airfryer'],cooktop:['forno','microondas'],fogao:['forno','microondas','purificador'],geladeira:['lava-loucas','purificador'],'lava-loucas':['geladeira','purificador'],liquidificador:['batedeira','purificador'],mixer:['liquidificador','purificador'],batedeira:['liquidificador','cafeteira-filtro'],grill:['airfryer','cafeteira-filtro'],'panela-eletrica':['cooktop','purificador'],panelas:['cooktop','fogao'],purificador:['cafeteira-capsula','cafeteira-espresso','cafeteira-filtro','geladeira'],'cafeteira-capsula':['purificador'],'cafeteira-espresso':['purificador'],'cafeteira-filtro':['purificador']};
 const accessoryComp={powerbank:['carregador','hub'],carregador:['powerbank','hub'],hub:['carregador','powerbank','ram-notebook'],'ram-notebook':['hub']};
 window.PNMComplements=function(p,limit=6){if(!p||typeof PRODUTOS==='undefined')return[];let pool=[];
   if(p.tipoProduto==='caixa'||p.tipoProduto==='lavanderia'||p.tipoProduto==='obra'){pool=[]}
   else if(p.tipoProduto==='gamer'){const subs=gamerComp[p.subtipoGamer]||[];pool=PRODUTOS.filter(q=>q.tipoProduto==='gamer'&&subs.includes(q.subtipoGamer)).concat(PRODUTOS.filter(q=>p.subtipoGamer==='gpu'&&q.tipoProduto==='monitor'))}
   else if(p.tipoProduto==='casa'){const subs=houseComp[p.subtipoCasa]||[];pool=PRODUTOS.filter(q=>q.tipoProduto==='casa'&&subs.includes(q.subtipoCasa)).concat(PRODUTOS.filter(q=>p.subtipoCasa==='rede'&&q.tipoProduto==='internet'))}
   else if(p.tipoProduto==='cozinha'){const subs=kitchenComp[p.subtipoCozinha]||[];pool=PRODUTOS.filter(q=>q.tipoProduto==='cozinha'&&subs.includes(q.subtipoCozinha))}
   else if(p.tipoProduto==='acessorio'){const subs=accessoryComp[p.subtipoAcessorio]||[];pool=PRODUTOS.filter(q=>q.tipoProduto==='acessorio'&&subs.includes(q.subtipoAcessorio));if(['hub','carregador','powerbank'].includes(p.subtipoAcessorio))pool=pool.concat(PRODUTOS.filter(q=>['smartphone','tablet','notebook'].includes(q.tipoProduto)))}
   else if(p.tipoProduto==='acabamento'){const bathroom=['louca-sanitaria','cuba','torneira-banheiro','acessorio-banheiro'],kitchen=['torneira-cozinha'],visual=['tinta','massa-selador','textura','rejunte','iluminacao-decorativa'];const set=bathroom.includes(p.subtipoAcabamento)?bathroom:kitchen.includes(p.subtipoAcabamento)?kitchen:visual;pool=PRODUTOS.filter(q=>q.tipoProduto==='acabamento'&&set.includes(q.subtipoAcabamento))}
   else if(p.tipoProduto==='instalacao'){const wet=['chuveiro','torneira-eletrica','bomba-agua','pressurizador','aquecedor-agua'];pool=wet.includes(p.subtipoInstalacao)?PRODUTOS.filter(q=>q.tipoProduto==='acabamento'&&['louca-sanitaria','cuba','torneira-banheiro','acessorio-banheiro'].includes(q.subtipoAcabamento)):p.subtipoInstalacao==='iluminacao'?PRODUTOS.filter(q=>(q.tipoProduto==='acabamento'&&q.subtipoAcabamento==='iluminacao-decorativa')||(q.tipoProduto==='casa'&&q.subtipoCasa==='iluminacao')):[]}
   else if(p.tipoProduto==='internet'){pool=PRODUTOS.filter(q=>q.tipoProduto==='casa'&&['rede','camera','assistente'].includes(q.subtipoCasa))}
   else {const types=complements[p.tipoProduto]||[];pool=PRODUTOS.filter(q=>types.includes(q.tipoProduto));if(['smartphone','fone','smartwatch'].includes(p.tipoProduto))pool=pool.concat(PRODUTOS.filter(q=>q.tipoProduto==='acessorio'&&['carregador','powerbank'].includes(q.subtipoAcessorio)));if(p.tipoProduto==='tablet')pool=pool.concat(PRODUTOS.filter(q=>q.tipoProduto==='acessorio'&&['carregador','powerbank','hub'].includes(q.subtipoAcessorio)));if(p.tipoProduto==='notebook')pool=pool.concat(PRODUTOS.filter(q=>q.tipoProduto==='acessorio'&&['hub','carregador','powerbank'].includes(q.subtipoAcessorio)),PRODUTOS.filter(q=>q.tipoProduto==='internet'));if(p.tipoProduto==='monitor')pool=pool.concat(PRODUTOS.filter(q=>q.tipoProduto==='acessorio'&&q.subtipoAcessorio==='hub'))}
   const ecosystem=(p.ecosistemas||[]).map(norm);pool=[...new Map(pool.map(q=>[q.id,q])).values()];return pool.filter(q=>q.id!==p.id).sort((a,b)=>{const ea=(a.ecosistemas||[]).map(norm),eb=(b.ecosistemas||[]).map(norm);const sa=(ecosystem.some(x=>ea.includes(x))?3:0)+(a.fonteTecnica?1:0)+(a.destaque?1:0),sb=(ecosystem.some(x=>eb.includes(x))?3:0)+(b.fonteTecnica?1:0)+(b.destaque?1:0);return sb-sa}).slice(0,limit)
 };
 function idFromHref(h){try{const u=new URL(h,location.href),q=u.searchParams.get('id');if(q)return q;const m=(u.pathname.split('/').pop()||'').match(/^produto-(.+?)(?:\.html)?$/);return m?decodeURIComponent(m[1]):null}catch(e){return null}}
 
 function classifyImageCoverage(p){
   if(!p)return {kind:'missing',label:'SEM IMAGEM',className:'is-missing',review:true,real:false,meta:'Sem imagem válida cadastrada.'};
   const raw=norm(p.imagemTipo||'');
   const img=String(p.imagem||'');
   const fallback=String(p.imagemFallback||'');
   const isRaster=/\.(webp|png|jpe?g|avif)(?:\?|$)/i.test(img);
   const isRemote=/^https?:\/\//i.test(img);
   const isSvg=/\.svg(?:\?|$)/i.test(img);
   if(['ia','ai','ai-gerada','ia-gerada','gerada-ia'].includes(raw))return {kind:'ai',label:'IA • REVISAR',className:'is-ai',review:true,real:false,list:'ai',meta:'Imagem gerada por IA como cobertura emergencial. Este produto entrou na fila de revisão manual.',note:'Imagem gerada por IA como último recurso. Assim que você enviar a foto correta, ela pode substituir esta versão no site.'};
   if(raw==='resolucao-automatica-pendente')return {kind:'pending',label:'BUSCA FOTO REAL',className:'is-pending',review:true,real:false,list:'pending',meta:'V17.3.3: sem ilustração de categoria; a foto real é resolvida automaticamente pela referência do produto/oferta.',note:'O produto usa um estado neutro até a foto real do anúncio/modelo ser carregada.'};
   if(raw==='oficial' && !isSvg && (isRaster||isRemote))return {kind:'official',label:'✓ FONTE OFICIAL',className:'is-official',review:false,real:true,list:'real',meta:'Imagem real obtida em fonte oficial do fabricante.',note:''};
   if(raw==='foto-remota-validada' && isRemote && !isSvg)return {kind:'remote-verified',label:'FOTO VALIDADA',className:'is-verified',review:false,real:true,list:'real',meta:'Foto real validada e carregada por referência remota.',note:''};
   if(isRaster && !isRemote)return {kind:'local-photo',label:'FOTO REAL',className:'is-photo',review:false,real:true,list:'real',meta:'Foto real local cadastrada para este produto.',note:''};
   if(isRaster && isRemote)return {kind:'remote-photo',label:'FOTO REMOTA',className:'is-verified',review:false,real:true,list:'real',meta:'Foto real remota cadastrada para este produto.',note:''};
   if(raw==='fallback'||isSvg||(!img&&fallback))return {kind:'pending',label:'FOTO PENDENTE',className:'is-pending',review:true,real:false,list:'pending',meta:'Produto ainda não possui foto real confirmada.',note:'Ilustração genérica não conta como foto real.'};
   return {kind:'missing',label:'SEM IMAGEM',className:'is-missing',review:true,real:false,list:'pending',meta:'Sem foto real válida cadastrada.',note:'O item deve receber uma foto real do produto/modelo.'};
 }
 function imageCoverageSummary(products){
   const list=(Array.isArray(products)?products:[]).map(p=>({product:p,coverage:classifyImageCoverage(p)}));
   return {
     products:list.length,
     official:list.filter(x=>x.coverage.kind==='official').length,
     remoteVerified:list.filter(x=>x.coverage.kind==='remote-verified').length,
     localPhoto:list.filter(x=>['local-photo','remote-photo'].includes(x.coverage.kind)).length,
     ai:list.filter(x=>x.coverage.kind==='ai').map(x=>x.product),
     pending:list.filter(x=>['pending','missing'].includes(x.coverage.kind)).map(x=>x.product),
     real:list.filter(x=>x.coverage.real).map(x=>x.product)
   };
 }
 window.PNMImageCoverage={
   classify:classifyImageCoverage,
   summary:(products)=>imageCoverageSummary(products||window.PRODUTOS||[]),
   listAI:(products)=>imageCoverageSummary(products||window.PRODUTOS||[]).ai,
   listPending:(products)=>imageCoverageSummary(products||window.PRODUTOS||[]).pending
 };
 function applyCoverageBadge(media,p){
   if(!media||!p)return;
   const info=classifyImageCoverage(p);
   const isListingCard=!!media.closest('.pnm-product-card,.product-card,.gamer-product-card,.construction-product-card,.kitchen-product-card,.compact-product-card,.laundry-product,.accessory-card');
   media.querySelectorAll('.pnm-image-status-badge').forEach(el=>el.remove());
   media.querySelectorAll('.official-image-badge').forEach(el=>el.remove());
   if(info.kind==='official'){
     if(isListingCard)return;
     const badge=document.createElement('span');
     badge.className='official-image-badge';
     badge.textContent=info.label;
     media.appendChild(badge);
     return;
   }
   if(!['remote-verified','pending','missing','ai'].includes(info.kind))return;
   const badge=document.createElement('span');
   badge.className='pnm-image-status-badge '+info.className;
   badge.textContent=info.label;
   media.appendChild(badge);
 }
 function enhanceImageCoverage(){
   if(typeof PRODUTOS==='undefined')return;
   const id=document.body?.dataset?.productId||new URLSearchParams(location.search).get('id');
   const p=PRODUTOS.find(x=>x.id===id);
   if(!p)return;
   const info=classifyImageCoverage(p);
   document.body.dataset.imageCoverageKind=info.kind;
   const img=document.querySelector('.product-detail-media img');
   if(img){
     if(!img.dataset.fallbackSrc&&p.imagemFallback)img.dataset.fallbackSrc=p.imagemFallback;
     if(!img.dataset.placeholderSrc)img.dataset.placeholderSrc='assets/product-placeholder.svg';
   }
   const media=document.querySelector('.product-detail-media');
   if(media)applyCoverageBadge(media,p);
   const meta=document.querySelector('.official-media-meta');
   if(meta){
     let span=meta.querySelector('span');
     if(!span){span=document.createElement('span');meta.prepend(span)}
     span.textContent=info.meta;
     let link=meta.querySelector('a');
     const href=p.imagemFonte||((info.review||info.kind==='ai')?'cobertura-imagens#'+(info.kind==='ai'?'ai-review':'manual-review'):'');
     if(href){
       if(!link){link=document.createElement('a');meta.appendChild(link)}
       link.href=href;
       link.textContent=info.review?'VER FILA':'VER FONTE';
       if(/^https?:/i.test(href)){link.target='_blank';link.rel='noopener noreferrer nofollow'}
     }else if(link){link.remove()}
   }
   const copy=document.querySelector('.product-detail-copy');
   if(copy && !copy.querySelector('.image-coverage-note') && info.review){
     const box=document.createElement('div');
     box.className='image-coverage-note '+info.className;
     box.innerHTML=`<strong>${info.kind==='ai'?'🧠 Imagem criada por IA':'🖼️ Cobertura de imagem em revisão'}</strong><p>${info.note}</p><a href="cobertura-imagens#${info.kind==='ai'?'ai-review':'manual-review'}">Abrir lista de revisão →</a>`;
     const anchor=copy.querySelector('.data-quality');
     anchor?anchor.insertAdjacentElement('afterend',box):copy.prepend(box);
   }
 }
 
 const cardSelector='.product-card,.gamer-product-card,.construction-product-card,.kitchen-product-card,.compact-product-card,.pnm-product-card,.accessory-card';
 function syncCardTools(card,id){let tools=card.querySelector('.pnm-card-tools');if(!tools){tools=document.createElement('div');tools.className='pnm-card-tools';const img=card.querySelector('img');const media=card.querySelector('.product-media,.gamer-product-media,.pnm-product-photo,.construction-product-media,.kitchen-product-media,.compact-product-media,.accessory-card>div:first-child')||img?.parentElement||card;media.style.position='relative';media.appendChild(tools)}
   tools.dataset.productId=id;
   const ensure=(cls)=>{let b=tools.querySelector('.'+cls);if(!b){b=document.createElement('button');b.type='button';b.className=cls;tools.appendChild(b)}return b};
   const setState=(b,on,onText,offText,onTitle,offTitle)=>{b.classList.toggle('active',on);const text=on?onText:offText;if(b.textContent!==text)b.textContent=text;const title=on?onTitle:offTitle;b.title=title;b.setAttribute('aria-label',title)};
   const fav=ensure('favorite-toggle');setState(fav,PNMFavorites.has(id),'♥','♡','Remover dos favoritos','Salvar nos favoritos');if(!fav.dataset.bound){fav.dataset.bound='1';fav.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const pid=tools.dataset.productId;PNMFavorites.toggle(pid);syncCardTools(card,pid)})}
   const list=ensure('list-toggle');setState(list,PNMList.has(id),'✓','＋','Remover da Minha Lista','Adicionar à Minha Lista');if(!list.dataset.bound){list.dataset.bound='1';list.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const pid=tools.dataset.productId;PNMList.toggle(pid);syncCardTools(card,pid)})}
   const cart=ensure('cart-toggle');setState(cart,PNMCart.has(id),'✓','🛒','Remover do carrinho','Adicionar ao carrinho');if(!cart.dataset.bound){cart.dataset.bound='1';cart.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const pid=tools.dataset.productId;const added=PNMCart.toggle(pid);PNMCartToast(added?'Adicionado ao carrinho.':'Removido do carrinho.',added?'VER CARRINHO':'');syncCardTools(card,pid)})}
 }
 function productFromCard(card){const link=card.querySelector('a[href^="produto-"],a[href*="produto?id="]');if(!link)return null;const id=idFromHref(link.getAttribute('href'));if(!id||typeof PRODUTOS==='undefined')return null;return PRODUTOS.find(x=>x.id===id)||null}
 function isOfferAnchor(a){return !a.classList.contains('source-link')&&(a.matches('.offer,.offer-fast,.primary-mini,.affiliate-btn,.pnm-ml-cta')||/oferta|mercado livre|pre[cç]o atual|ver pre[cç]o|comprar/i.test(a.textContent||''))}
 function enforceAffiliateLinks(){if(typeof PRODUTOS==='undefined')return;document.querySelectorAll(cardSelector).forEach(card=>{const p=productFromCard(card);if(!p?.linkAfiliado)return;card.querySelectorAll('a[href]').forEach(a=>{if(!isOfferAnchor(a))return;a.href=p.linkAfiliado;a.target='_blank';a.rel='sponsored nofollow noopener noreferrer'})});const id=document.body?.dataset?.productId,p=PRODUTOS.find(x=>x.id===id);if(p?.linkAfiliado)document.querySelectorAll('.affiliate-btn,.pnm-ml-cta,.sticky-offer a,.sticky-buy a').forEach(a=>{if(a.classList.contains('source-link'))return;a.href=p.linkAfiliado;a.target='_blank';a.rel='sponsored nofollow noopener noreferrer'})}
 window.PNMEnsureAffiliateLinks=enforceAffiliateLinks;
 function enhanceCards(){document.querySelectorAll(cardSelector).forEach(card=>{const link=card.querySelector('a[href^="produto-"],a[href*="produto?id="]');if(!link)return;const id=idFromHref(link.getAttribute('href'));if(!id)return;syncCardTools(card,id);const p=typeof PRODUTOS!=='undefined'?PRODUTOS.find(x=>x.id===id):null,img=card.querySelector('img'),media=card.querySelector('.product-media,.gamer-product-media,.pnm-product-photo,.construction-product-media,.kitchen-product-media,.compact-product-media,.accessory-card>div:first-child')||img?.parentElement;if(!p)return;const info=classifyImageCoverage(p);card.classList.toggle('has-official-image',info.kind==='official');card.classList.toggle('needs-image-review',!!info.review);card.classList.toggle('has-ai-image',info.kind==='ai');if(media)applyCoverageBadge(media,p);if(img){if(p.imagemFallback&&!img.dataset.fallbackSrc)img.dataset.fallbackSrc=p.imagemFallback;if(!img.dataset.placeholderSrc)img.dataset.placeholderSrc='assets/product-placeholder.svg';}});enforceAffiliateLinks()}
 function brandLockup(){return '<span class="pnm-brand-mark" aria-hidden="true"></span><span class="pnm-brand-name"><b>PREÇO</b><i>NA MIRA</i></span>'}
 function enhanceBranding(){document.querySelectorAll('.brand').forEach(brand=>{brand.innerHTML=brandLockup();brand.setAttribute('aria-label','Preço na Mira — página inicial')})}
 function enhanceFooter(){const footer=document.querySelector('.footer');if(!footer||footer.dataset.enhanced)return;footer.dataset.enhanced='true';const pageNote=[...footer.querySelectorAll('p')].map(x=>x.textContent.trim()).filter(Boolean).find(x=>!/Compare\. Economize\. Acerte\./i.test(x))||'Escolhas mais claras, comparações com contexto e ofertas em um só lugar.';const environments=[
   ['montar','◆','Projetos','planeje'],['ambiente-cozinha','🍳','Cozinha','combine'],['lavanderia','🧺','Lavanderia','organize'],['ambiente-casa','💡','Casa inteligente','conecte'],['ambiente-gamer','🎮','Gamer','monte'],['obra-base','🧱','Obra base','prepare'],['instalacoes','⚡','Instalações','proteja'],['acabamentos','🎨','Acabamentos','finalize'],['pequenos-espacos','📐','Pequenos espaços','otimize']
  ];const rail=document.createElement('section');rail.className='pnm-environment-rail';rail.setAttribute('aria-label','Ambientes do Preço na Mira');rail.innerHTML=`<div class="container"><div class="pnm-rail-heading"><div><small>CONTINUE EXPLORANDO</small><h2>Entre por um ambiente</h2></div><a href="ambientes">VER TODOS →</a></div><div class="pnm-environment-links">${environments.map(([href,icon,name,verb],index)=>`<a class="rail-${index+1}" href="${href}"><span>${icon}</span><div><small>${verb}</small><b>${name}</b></div><i>→</i></a>`).join('')}</div></div>`;footer.before(rail);footer.innerHTML=`<div class="container pnm-footer-main"><div class="pnm-footer-brand"><a href="/" class="pnm-footer-lockup">${brandLockup()}</a><p>Compare melhor. Monte do seu jeito. Acerte na escolha.</p><div class="pnm-footer-actions"><a href="busca">⌕ Buscar</a><a href="comparativo-geral">⚖️ Comparar</a><a href="montar">Projetos</a><a href="carrinho">🛒 Carrinho <span class="pnm-cart-count">0</span></a></div></div><div class="pnm-footer-market"><span class="pnm-market-badge"><img class="pnm-market-logo" src="assets/mercado-livre-logo.svg" alt="Mercado Livre"></span><strong>Da comparação para a oferta.</strong><p>Os botões de oferta direcionam para anúncios no Mercado Livre. Preço, estoque, frete e vendedor devem ser conferidos antes da compra.</p></div></div><div class="container pnm-footer-bottom"><span>Preço na Mira • Conteúdo independente</span><p>${pageNote}</p><a href="carrinho">🛒 Carrinho <span class="pnm-cart-count">0</span></a></div>`;syncCartBadges()}
 function enhanceNav(){const n=document.querySelector('.nav-links');if(!n)return;const desired=[['universos','Universos'],['ofertas','Ofertas'],['catalogo','Catálogo'],['montar','Projetos'],['minha-lista','Salvos']];n.innerHTML=desired.map(([h,t])=>`<a href="${h}">${t}</a>`).join('')+`<a class="pnm-cart-nav" href="carrinho">Carrinho <span class="pnm-cart-count" aria-label="Itens no carrinho">0</span></a>`;syncCartBadges()}
 function syncCartBadges(){const count=window.PNMCart?PNMCart.count():0;document.querySelectorAll('.pnm-cart-count').forEach(el=>{el.textContent=String(count);el.classList.toggle('has-items',count>0)});document.querySelectorAll('[data-pnm-cart-count]').forEach(el=>el.textContent=String(count))}

 function experienceLabel(id,kind){const x=kind==='u'?(window.PNMUniverseById&&PNMUniverseById(id)):(window.PNMEnvironmentById&&PNMEnvironmentById(id));return x?`${x.icon} ${x.nome}`:id}
 function enhanceProductExperience(){if(typeof PRODUTOS==='undefined'||!window.PNMExperienceMeta)return;const id=document.body?.dataset?.productId||new URLSearchParams(location.search).get('id'),p=PRODUTOS.find(x=>x.id===id);if(!p)return;const meta=PNMExperienceMeta(p),target=document.querySelector('.product-detail-copy');if(!target||target.querySelector('.experience-context'))return;const activeU=meta.universos.map(PNMUniverseById).filter(x=>x&&x.status==='ativo').slice(0,3),activeA=meta.ambientes.map(PNMEnvironmentById).filter(x=>x&&x.status==='ativo').slice(0,4);if(!activeU.length&&!activeA.length)return;const box=document.createElement('div');box.className='experience-context';box.innerHTML=`<strong>🧭 Onde este produto entra</strong><p>Um mesmo produto pode participar de mais de um universo e ambiente.</p><div class="experience-tags">${activeU.map(x=>`<a href="${x.href||'universos'}">${x.icon} ${x.nome}</a>`).join('')}${activeA.map(x=>`<a class="env" href="${x.href||'ambientes'}">${x.icon} ${x.nome}</a>`).join('')}</div>`;const dq=target.querySelector('.data-quality');dq?dq.insertAdjacentElement('afterend',box):target.appendChild(box)}
 function managerForShare(){if(!window.PNMGetManager)return null;const f=location.pathname.split('/').pop(),q=new URLSearchParams(location.search);if(f==='comparativo-fones')return PNMGetManager('fone');if(f==='comparativo-soundbars')return PNMGetManager('soundbar');if(f==='comparativo-smartwatches')return PNMGetManager('smartwatch');if(f==='comparativo-tvs')return PNMGetManager('tv');if(f==='comparativo-smartphones')return PNMGetManager('smartphone');if(f==='comparativo-notebooks')return PNMGetManager('notebook');if(f==='comparativo-monitores')return PNMGetManager('monitor');if(f==='comparativo-tablets')return PNMGetManager('tablet');if(f==='comparativo-internet')return PNMGetManager('internet');if(f==='comparativo-projetores')return PNMGetManager('projetor');if(f==='comparativo-casa')return PNMGetManager('casa',q.get('tipo'));if(f==='comparativo-gamer')return PNMGetManager('gamer',q.get('tipo'));if(f==='comparativo-cozinha')return PNMGetManager('cozinha',q.get('tipo'));if(f==='comparativo-acessorios')return PNMGetManager('acessorio',q.get('tipo'));if(f==='comparativo-obra')return PNMGetManager('obra',q.get('tipo'));if(f==='comparativo-instalacoes')return PNMGetManager('instalacao',q.get('tipo'));if(f==='comparativo-acabamentos')return PNMGetManager('acabamento',q.get('tipo'));if(f==='comparativo-compactos')return PNMGetManager('compacto',q.get('tipo'));if(f==='comparativo-geral')return PNMGetManager('caixa');return null}
 function sharedCompare(){const man=managerForShare(),q=new URLSearchParams(location.search),sel=q.get('sel');if(man&&sel&&!q.get('shareApplied')){man.set(sel.split(',').filter(Boolean).slice(0,4));q.set('shareApplied','1');location.replace(location.pathname+'?'+q.toString());return true}return false}
 function injectShareCompare(){const man=managerForShare();if(!man)return;const target=document.querySelector('.compare-builder,.gamer-section-head,.compare-page-box');if(!target||target.querySelector('.pnm-share-compare'))return;const b=document.createElement('button');b.className='pnm-share-btn pnm-share-compare';b.textContent='🔗 COMPARTILHAR COMPARAÇÃO';b.onclick=async()=>{const u=new URL(location.href);u.searchParams.set('sel',man.get().join(','));u.searchParams.delete('shareApplied');await PNMShare(u.toString(),'Comparação — Preço na Mira');b.textContent='✓ LINK COPIADO';setTimeout(()=>b.textContent='🔗 COMPARTILHAR COMPARAÇÃO',1800)};target.appendChild(b)}
 function enhanceActiveNav(){const page=location.pathname.split('/').pop()||'/';document.querySelectorAll('.nav-links a').forEach(a=>{const target=(a.getAttribute('href')||'').split('?')[0].split('#')[0];if(target===page)a.setAttribute('aria-current','page')})}
 function enhanceHeader(){const header=document.querySelector('.site-header');if(!header)return;const sync=()=>header.classList.toggle('is-scrolled',scrollY>12);sync();addEventListener('scroll',sync,{passive:true})}
 function enhanceMotion(){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;const selectors=['main>section','.product-card','.gamer-hub-card','.gamer-route','.house-entry','.house-hub-card','.house-new-grid>a','.laundry-product','.laundry-rule-grid>article'];const targets=[...new Set(selectors.flatMap(s=>[...document.querySelectorAll(s)]))];targets.forEach((el,index)=>{el.classList.add('pnm-reveal');el.style.setProperty('--reveal-delay',`${Math.min(index%6,5)*45}ms`)});const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target)}}),{rootMargin:'0px 0px -6% 0px',threshold:.06});targets.forEach(el=>observer.observe(el))}
 document.addEventListener('DOMContentLoaded',()=>{if(sharedCompare())return;enhanceBranding();enhanceNav();enhanceCards();enhanceProductExperience();enhanceImageCoverage();enhanceFooter();injectShareCompare();enhanceActiveNav();enhanceHeader();enhanceMotion();syncCartBadges();let queued=false;const observer=new MutationObserver(mutations=>{if(mutations.length&&mutations.every(m=>m.target?.nodeType===1&&m.target.closest?.('.pnm-card-tools')))return;if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;enhanceCards();syncCartBadges()})});const target=document.querySelector('main')||document.body;observer.observe(target,{childList:true,subtree:true});setTimeout(()=>{enhanceCards();enhanceImageCoverage();enhanceMotion();syncCartBadges();enforceAffiliateLinks()},180)});
 document.addEventListener('pnm:storage',()=>setTimeout(()=>{enhanceCards();syncCartBadges()},0));
})();
