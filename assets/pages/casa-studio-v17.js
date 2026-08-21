(()=>{
'use strict';

const roomGrid=document.getElementById('csRoomGrid');
const productGrid=document.getElementById('csProductGrid');
const empty=document.getElementById('csEmpty');
const title=document.getElementById('cs-products-title');
const intro=document.getElementById('csProductsIntro');
const status=document.getElementById('csStatus');

if(!roomGrid||!productGrid||!empty||!title||!intro||!status)return;

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[char]));

const rooms=[
  {id:'cozinha',label:'Cozinha',description:'Eletros e equipamentos organizados pelo uso na cozinha.'},
  {id:'sala-cinema',label:'Sala & Cinema',description:'Imagem, áudio e conectividade para a área de estar.'},
  {id:'banheiro',label:'Banheiro',description:'Louças, metais, ducha e iluminação ligados ao ambiente.'},
  {id:'lavanderia',label:'Lavanderia',description:'Equipamentos e apoio para lavar, secar e organizar.'},
  {id:'home-office',label:'Home Office',description:'Computação, monitor, rede e acessórios para trabalhar.'},
  {id:'casa-inteligente',label:'Casa Inteligente',description:'Rede, automação, segurança, acesso e limpeza conectada.'}
];

const products=()=>typeof PRODUTOS!=='undefined'&&Array.isArray(PRODUTOS)?PRODUTOS:[];
let activeRoom=null;

function definition(roomId){
  return window.PNMProjects?.definitions?.[roomId]||null;
}

function matchingContexts(roomId,product){
  const def=definition(roomId);
  if(!def?.rules)return [];
  return Object.entries(def.rules).flatMap(([key,rule])=>{
    let matches=false;
    try{matches=Boolean(rule(product))}catch(_){}
    if(!matches)return [];
    const label=def.requirements.find(item=>item[0]===key)?.[1]||key;
    return [label];
  });
}

function quality(product){
  return (product.fonteTecnica?4:0)+(product.imagemTipo==='oficial'?2:0)+(product.destaque?1:0);
}

function productsFor(roomId){
  return products()
    .filter(product=>product&&product.id&&product.nome&&product.imagem&&product.linkAfiliado)
    .map(product=>({product,contexts:matchingContexts(roomId,product)}))
    .filter(item=>item.contexts.length)
    .sort((a,b)=>quality(b.product)-quality(a.product)||String(a.product.nome).localeCompare(String(b.product.nome),'pt-BR'));
}

function availableRooms(){
  return rooms.map(room=>({...room,items:productsFor(room.id)})).filter(room=>room.items.length);
}

function renderRooms(){
  const list=availableRooms();
  if(!list.length){
    roomGrid.innerHTML='<div class="cs-empty"><strong>Nenhum ambiente disponível agora.</strong><span>O catálogo carregou, mas não há relações seguras para exibir no Casa Studio.</span></div>';
    return;
  }
  roomGrid.innerHTML=list.map((room,index)=>`
    <button class="cs-room-card" type="button" data-room="${esc(room.id)}" aria-pressed="${activeRoom===room.id?'true':'false'}">
      <span class="cs-room-index" aria-hidden="true">${String(index+1).padStart(2,'0')}</span>
      <h3>${esc(room.label)}</h3>
      <p>${esc(room.description)}</p>
      <span class="cs-room-foot"><span>${room.items.length} ${room.items.length===1?'produto relacionado':'produtos relacionados'}</span><b>VER PRODUTOS →</b></span>
    </button>
  `).join('');
}

function projectContaining(roomId,productId){
  if(!window.PNMProjects)return null;
  return PNMProjects.list().find(project=>project.type===roomId&&project.selection.includes(productId))||null;
}

function projectFor(roomId){
  if(!window.PNMProjects)return null;
  const active=PNMProjects.active();
  if(active?.type===roomId)return active;
  const existing=PNMProjects.list().find(project=>project.type===roomId);
  return existing||PNMProjects.create(roomId);
}

function projectHref(project){
  return project?`projeto?projeto=${encodeURIComponent(project.id)}&aba=products`:'montar';
}

function card(item,roomId){
  const p=item.product;
  const existing=projectContaining(roomId,p.id);
  const fallback=p.imagemFallback||'assets/product-photo-unavailable.svg';
  const context=item.contexts.slice(0,2).join(' • ');
  const summary=p.resumo||p.chamada||p.categoria||'Produto do catálogo Preço na Mira.';
  return `
    <article class="cs-product-card">
      <div class="cs-product-media">
        <img src="${esc(p.imagem)}" data-fallback-src="${esc(fallback)}" alt="${esc(p.imagemAlt||`Foto do produto ${p.nome}`)}" loading="lazy" decoding="async"/>
      </div>
      <div class="cs-product-copy">
        <span class="cs-product-context">${esc(context)}</span>
        <h3>${esc(p.nome)}</h3>
        <p>${esc(summary)}</p>
        <div class="cs-product-actions">
          <a href="produto-${encodeURIComponent(p.id)}">ANALISAR</a>
          <a class="cs-offer" href="${esc(p.linkAfiliado)}" target="_blank" rel="sponsored nofollow noopener noreferrer">VER OFERTA ↗</a>
          <button class="cs-add ${existing?'is-added':''}" type="button" data-add-product="${esc(p.id)}" data-room="${esc(roomId)}">${existing?'NO PROJETO':'ADICIONAR AO PROJETO'}</button>
        </div>
      </div>
    </article>`;
}

function renderProducts(roomId,{scroll=false}={}){
  activeRoom=roomId;
  const room=rooms.find(item=>item.id===roomId);
  const items=productsFor(roomId);
  renderRooms();

  if(!room||!items.length){
    title.textContent='Nenhum produto relacionado neste ambiente.';
    intro.textContent='Não vamos forçar associações quando os dados atuais não forem suficientes.';
    productGrid.innerHTML='';
    empty.hidden=false;
    return;
  }

  const visible=items.slice(0,12);
  title.textContent=room.label;
  intro.textContent=`Seleção inicial com ${visible.length} de ${items.length} ${items.length===1?'produto relacionado':'produtos relacionados'} no catálogo atual.`;
  productGrid.innerHTML=visible.map(item=>card(item,roomId)).join('');
  empty.hidden=true;

  const url=new URL(location.href);
  url.searchParams.set('ambiente',roomId);
  history.replaceState(null,'',url);

  if(scroll){
    document.getElementById('produtos')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
}

function addToProject(roomId,productId){
  if(!window.PNMProjects){
    status.hidden=false;
    status.textContent='Projetos não estão disponíveis neste navegador agora.';
    return;
  }
  const already=projectContaining(roomId,productId);
  if(already){
    status.hidden=false;
    status.innerHTML=`<span>Este produto já está em <strong>${esc(already.name)}</strong>.</span><a href="${projectHref(already)}">ABRIR PROJETO →</a>`;
    return;
  }

  const project=projectFor(roomId);
  if(!project)return;
  const selection=[...project.selection];
  if(!selection.includes(productId))selection.push(productId);
  const updated=PNMProjects.update(project.id,{selection});
  PNMProjects.setActive(project.id);

  status.hidden=false;
  status.innerHTML=`<span>Produto adicionado a <strong>${esc(updated?.name||project.name)}</strong>.</span><a href="${projectHref(updated||project)}">ABRIR PROJETO →</a>`;
  renderProducts(roomId);
}

roomGrid.addEventListener('click',event=>{
  const button=event.target.closest('[data-room]');
  if(!button)return;
  renderProducts(button.dataset.room,{scroll:true});
});

productGrid.addEventListener('click',event=>{
  const button=event.target.closest('[data-add-product]');
  if(!button)return;
  addToProject(button.dataset.room,button.dataset.addProduct);
});

productGrid.addEventListener('error',event=>{
  const image=event.target.closest('img[data-fallback-src]');
  if(!image)return;
  const fallback=image.dataset.fallbackSrc;
  if(fallback&&image.src!==new URL(fallback,location.href).href)image.src=fallback;
},{capture:true});

renderRooms();

const requested=new URLSearchParams(location.search).get('ambiente');
if(requested&&rooms.some(room=>room.id===requested)&&productsFor(requested).length){
  renderProducts(requested);
}
})();