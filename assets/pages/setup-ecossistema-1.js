const KEY='pnmEcoBuilderV13';
let state={};
try{state=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
const qs=new URLSearchParams(location.search);
if(qs.get('setup')){try{state=JSON.parse(atob(qs.get('setup')))}catch(e){}}
function esc(s=''){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function imgTag(p){const src=esc((p&&p.imagem)||'');const fb=esc((p&& (p.imagemFallback||p.imagem))||'');if(!p) return '';return `<img src="${src}" alt="${esc(p.imagemAlt||p.nome)}" loading="lazy" decoding="async" data-fallback-src="${fb}">`;}
function visualFirst(arr){return [...arr].sort((a,b)=>Number(Boolean(b.imagem&&!String(b.imagem).endsWith('.svg')))-Number(Boolean(a.imagem&&!String(a.imagem).endsWith('.svg'))))}
const data=(typeof PRODUTOS!=='undefined'?PRODUTOS:[]);
const groups={
  phone:visualFirst(data.filter(p=>p.tipoProduto==='smartphone')),
  watch:visualFirst(data.filter(p=>p.tipoProduto==='smartwatch')),
  head:visualFirst(data.filter(p=>p.tipoProduto==='fone')),
  charger:visualFirst(data.filter(p=>p.tipoProduto==='acessorio'&&p.subtipoAcessorio==='carregador')),
  power:visualFirst(data.filter(p=>p.tipoProduto==='acessorio'&&p.subtipoAcessorio==='powerbank')),
  hub:visualFirst(data.filter(p=>p.tipoProduto==='acessorio'&&p.subtipoAcessorio==='hub'))
};
const sels={};
Object.keys(groups).forEach(k=>sels[k]=document.getElementById(k));
function fill(sel,arr,optional=false){sel.innerHTML=(optional?'<option value="">Sem item / decidir depois</option>':'')+arr.map(p=>`<option value="${p.id}">${esc(p.marca)} — ${esc(p.nome)}</option>`).join('')}
fill(sels.phone,groups.phone);
fill(sels.watch,groups.watch);
fill(sels.head,groups.head);
fill(sels.charger,groups.charger,true);
fill(sels.power,groups.power,true);
fill(sels.hub,groups.hub,true);
Object.keys(sels).forEach(k=>{if(state[k]) sels[k].value=state[k]});
function actionButtons(p){
  const analyze=`<a class="btn btn-dark" href="produto-${encodeURIComponent(p.id)}.html">ANALISAR</a>`;
  const offer=p.linkAfiliado?`<a class="btn btn-outline" href="${esc(p.linkAfiliado)}" target="_blank" rel="sponsored noopener">VER OFERTA</a>`:`<a class="btn btn-outline" href="produto-${encodeURIComponent(p.id)}.html">VER DETALHES</a>`;
  return `<div class="builder-actions">${analyze}${offer}</div>`;
}
function pills(p){const arr=(p.chips||[]).slice(0,4);return arr.length?`<div class="builder-pills">${arr.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}
function card(p,label){
  if(!p) return `<div class="builder-empty">${esc(label)} ainda não definido.<br>Você pode decidir depois.</div>`;
  return `<article class="builder-product-card"><div class="builder-product-media"><span class="builder-product-badge">${esc(label)} · ${esc(p.selo||p.marca)}</span>${imgTag(p)}</div><div class="builder-product-copy"><div class="eyeline">${esc(p.marca)} • ${esc(p.categoria||p.tipoProduto)}</div><h3>${esc(p.nome)}</h3><p>${esc(p.chamada||p.resumo||'')}</p>${pills(p)}${actionButtons(p)}</div></article>`;
}
function product(k){return groups[k].find(x=>x.id===sels[k].value)}
function suggest(){
  const phone=product('phone');
  if(!phone) return;
  const w=groups.watch.find(x=>x.marca===phone.marca)||groups.watch[0];
  const h=groups.head.find(x=>x.marca===phone.marca)||groups.head[0];
  if(!state.watch&&w) sels.watch.value=w.id;
  if(!state.head&&h) sels.head.value=h.id;
  render();
}
function stageStrip(items){
  return `<div class="immersive-stage-strip">${items.map(({title,p})=>`<div class="immersive-stage-tile">${p?imgTag(p):'<div style="font-size:22px">＋</div>'}<b>${esc(title)}</b><small>${esc(p?p.marca:'opcional')}</small></div>`).join('')}</div>`;
}
function stageSummary(P){
  const core=[P.phone,P.watch,P.head].filter(Boolean);
  const extras=[P.charger,P.power,P.hub].filter(Boolean);
  const sameBrand=core.length?core.filter(x=>x.marca===P.phone.marca).length:0;
  const summary=[
    {title:'Núcleo do ecossistema',text:sameBrand===3?`Celular, relógio e fone estão na mesma marca (${P.phone.marca}). A chance de integração natural é maior.`:sameBrand===2?`Parte do núcleo conversa por marca. Ainda assim, avalie recursos reais, não só o logo.`:`Você misturou marcas no núcleo. Isso pode ser ótimo se a combinação atender melhor seu uso.`},
    {title:'Acessórios de apoio',text:extras.length?`Você já adicionou ${extras.length} ${extras.length===1?'acessório opcional':'acessórios opcionais'} para energia e conexões.`:'Você manteve os extras em aberto. Boa opção para decidir o essencial primeiro.'},
    {title:'Leitura rápida',text:`O conjunto foi organizado para equilibrar uso diário, mobilidade e praticidade de recarga/conectividade.`}
  ];
  return summary.map(m=>`<div class="immersive-summary-chip"><strong>${esc(m.title)}</strong><span>${esc(m.text)}</span></div>`).join('');
}
function checklistText(P){
  const sameBrand=[P.watch,P.head].filter(x=>x&&P.phone&&x.marca===P.phone.marca).length;
  const extras=[P.charger,P.power,P.hub].filter(Boolean);
  const notes=[
    sameBrand===2?'<div><strong>Integração:</strong> o núcleo inteiro está na mesma marca. Bom sinal para apps, pareamento e recursos cruzados, mas ainda vale confirmar as funções específicas.</div>':sameBrand===1?'<div><strong>Integração:</strong> parte do núcleo está alinhada por marca. Veja se isso realmente agrega algo ao seu uso.</div>':'<div><strong>Integração:</strong> o ecossistema está misto. Isso pode funcionar muito bem quando cada peça foi escolhida pelo que entrega melhor.</div>',
    extras.length?'<div><strong>Expansão:</strong> você adicionou acessórios para completar energia e conexões. Confira potência, número de portas e padrão USB-C/USB-A antes da compra.</div>':'<div><strong>Expansão:</strong> os acessórios ficaram em aberto. Ótimo para não gastar à toa antes de validar o núcleo.</div>',
    '<div><strong>Compra com contexto:</strong> use a análise individual para confirmar ficha técnica e a oferta só quando o produto já fizer sentido no conjunto.</div>'
  ];
  return notes.join('');
}
function heroVisual(P){
  const holder=document.getElementById('ecoHeroVisual');
  if(!holder||!P.phone||!P.watch||!P.head) return;
  holder.innerHTML=`<div class="visual-ring"></div><div class="visual-card a">${imgTag(P.phone)}<span>phone</span></div><div class="visual-card b">${imgTag(P.watch)}<span>watch</span></div><div class="visual-card c">${imgTag(P.head)}<span>áudio</span></div>`;
}
function render(){
  const P={};
  Object.keys(groups).forEach(k=>P[k]=product(k));
  if(!P.phone||!P.watch||!P.head) return;
  state={};
  Object.keys(sels).forEach(k=>state[k]=sels[k].value||'');
  localStorage.setItem(KEY,JSON.stringify(state));
  document.getElementById('phoneCard').innerHTML=card(P.phone,'smartphone');
  document.getElementById('watchCard').innerHTML=card(P.watch,'smartwatch');
  document.getElementById('headCard').innerHTML=card(P.head,'fone');
  document.getElementById('chargerCard').innerHTML=card(P.charger,'carregador');
  document.getElementById('powerCard').innerHTML=card(P.power,'power bank');
  document.getElementById('hubCard').innerHTML=card(P.hub,'hub');
  document.getElementById('ecoVisual').innerHTML=stageStrip([
    {title:'Celular',p:P.phone},
    {title:'Relógio',p:P.watch},
    {title:'Fone',p:P.head}
  ]) + stageStrip([
    {title:'Carregador',p:P.charger},
    {title:'Power bank',p:P.power},
    {title:'Hub',p:P.hub}
  ]);
  document.getElementById('ecoSummary').innerHTML=stageSummary(P);
  document.getElementById('check').innerHTML=checklistText(P);
  heroVisual(P);
}
sels.phone.onchange=()=>{state={phone:sels.phone.value};suggest()};
Object.keys(sels).filter(k=>k!=='phone').forEach(k=>sels[k].onchange=render);
document.getElementById('shareBuild').onclick=async e=>{
  const u=new URL(location.href);
  u.searchParams.set('setup',btoa(JSON.stringify(state)));
  await PNMShare(u.toString(),'Ecossistema móvel — Preço na Mira');
  e.target.textContent='✓ LINK COPIADO';
  setTimeout(()=>e.target.textContent='🔗 COMPARTILHAR SETUP',1600);
};
suggest();
