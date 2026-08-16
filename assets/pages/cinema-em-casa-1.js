const KEY='pnmCinemaBuilderV11';
let state={};
try{state=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
const qs=new URLSearchParams(location.search);
if(qs.get('setup')){try{state=JSON.parse(atob(qs.get('setup')))}catch(e){}}
function esc(s=''){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function imgSrc(p){return esc(p.imagemFallback||p.imagem||'')}
function imgTag(p,cls=''){const src=esc(p.imagem||p.imagemFallback||'');const fb=esc(p.imagemFallback||p.imagem||'');return `<img class="${cls}" src="${src}" alt="${esc(p.imagemAlt||p.nome)}" loading="lazy" decoding="async" data-fallback-src="${fb}">`}
const dt=document.getElementById('displayType');
const ds=document.getElementById('display');
const ss=document.getElementById('sound');
const DISPLAY_TYPES=['tv','projetor'];
function visualFirst(arr){return [...arr].sort((a,b)=>Number(Boolean(b.imagem&&!String(b.imagem).endsWith('.svg')))-Number(Boolean(a.imagem&&!String(a.imagem).endsWith('.svg'))))}
const data=(typeof PRODUTOS!=='undefined'?PRODUTOS:[]);
const sounds=visualFirst(data.filter(p=>p.tipoProduto==='soundbar'));
function listD(){return visualFirst(data.filter(p=>p.tipoProduto===dt.value))}
dt.value=DISPLAY_TYPES.includes(state.displayType)?state.displayType:'tv';
function fill(){
  const displays=listD();
  ds.innerHTML=displays.map(p=>`<option value="${p.id}">${esc(p.marca)} — ${esc(p.nome)}</option>`).join('');
  ss.innerHTML=sounds.map(p=>`<option value="${p.id}">${esc(p.marca)} — ${esc(p.nome)}</option>`).join('');
  if(displays.some(p=>p.id===state.display)) ds.value=state.display;
  if(sounds.some(p=>p.id===state.sound)) ss.value=state.sound;
  if(!ds.value&&displays[0]) ds.value=displays[0].id;
  if(!ss.value&&sounds[0]) ss.value=sounds[0].id;
  render();
}
function badgeText(p){return esc(p.selo||p.categoria||p.marca)}
function actionButtons(p){
  const analyze=`<a class="btn btn-dark" href="produto-${encodeURIComponent(p.id)}">ANALISAR</a>`;
  const offer=p.linkAfiliado?`<a class="btn btn-outline" href="${esc(p.linkAfiliado)}" target="_blank" rel="sponsored noopener">VER OFERTA</a>`:`<a class="btn btn-outline" href="produto-${encodeURIComponent(p.id)}">VER DETALHES</a>`;
  return `<div class="builder-actions">${analyze}${offer}</div>`;
}
function metaRow(p){
  const meta=[p.marca,p.categoria,p.paraQuem?'Perfil guiado':null].filter(Boolean).slice(0,3);
  return `<div class="builder-meta-row">${meta.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`;
}
function pills(p){
  const arr=(p.chips||[]).slice(0,4);
  return arr.length?`<div class="builder-pills">${arr.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:'';
}
function productCard(p,stepLabel){
  return `
    <article class="builder-product-card">
      <div class="builder-product-media">
        <span class="builder-product-badge">${esc(stepLabel)} · ${badgeText(p)}</span>
        ${imgTag(p)}
      </div>
      <div class="builder-product-copy">
        <div class="eyeline">${esc(p.marca)} • ${esc(p.categoria||p.tipoProduto)}</div>
        <h3>${esc(p.nome)}</h3>
        <p>${esc(p.chamada||p.resumo||'')}</p>
        ${metaRow(p)}
        ${pills(p)}
        ${actionButtons(p)}
      </div>
    </article>`;
}
function stageVisual(display,sound){
  return `
    <div class="immersive-stage-screen">
      ${imgTag(display)}
    </div>
    <div class="immersive-stage-sound">
      ${imgTag(sound)}
    </div>`;
}
function maybe(msg){return `<div class="immersive-summary-chip"><strong>${msg.title}</strong><span>${msg.text}</span></div>`}
function stageSummary(display,sound){
  const sameBrand=display.marca===sound.marca;
  const immersive=(sound.chips||[]).join(' ').match(/Atmos|5\.1|5\.1\.3|3\.1\.2|DTS/i);
  const displayFit=dt.value==='projetor'?'Escolha voltada a imagem grande e experiência de sala mais escura.':'Escolha mais direta para uso diário, streaming e instalação simples.';
  const brandFit=sameBrand?`Imagem e áudio estão na mesma marca (${display.marca}), o que pode facilitar integração e operação.`:`Você misturou marcas (${display.marca} + ${sound.marca}), o que pode render ótimo custo-benefício se as conexões estiverem certas.`;
  const audioFit=immersive?`A soundbar escolhida tem um perfil mais cinematográfico, com foco em imersão e presença de cena.`:`A soundbar escolhida privilegia simplicidade e melhora clara sobre o áudio nativo da tela.`;
  return [
    {title:dt.value==='projetor'?'Leitura da imagem':'Leitura da TV',text:displayFit},
    {title:'Encaixe do conjunto',text:brandFit},
    {title:'Perfil do áudio',text:audioFit}
  ].map(maybe).join('');
}
function checklist(display,sound){
  const sameBrand=display.marca===sound.marca;
  const hasArc=/ARC|eARC/i.test(JSON.stringify(sound.especificacoes||{})) || /(ARC|eARC)/i.test((sound.chips||[]).join(' '));
  const hasSub=/sub/i.test((sound.resumo||'')+' '+(sound.chamada||'')+' '+JSON.stringify(sound.especificacoes||{}));
  const items=[
    `<div><strong>Conexão principal:</strong> ${hasArc?'há sinal de HDMI ARC/eARC no áudio. Mesmo assim, confirme a ficha da TV ou do projetor.':'confira se o par principal conversa via HDMI ARC/eARC, óptico ou Bluetooth da forma que você precisa.'}</div>`,
    `<div><strong>Espaço físico:</strong> ${hasSub?'a soundbar parece usar subwoofer dedicado. Reserve posição e tomada para esse segundo volume.':'o conjunto aparenta ser mais compacto, bom para quem quer menos peças visíveis.'}</div>`,
    `<div><strong>Integração:</strong> ${sameBrand?'a mesma marca pode simplificar controle e recursos extras, mas o mais importante ainda é conexão e formato suportado.':'marcas diferentes funcionam bem em muitos casos, desde que entradas, formatos e expectativa de uso estejam alinhados.'}</div>`
  ];
  if(dt.value==='projetor') items.push(`<div><strong>Projetor na prática:</strong> confirme brilho do ambiente, distância de projeção e caminho do cabo até o sistema de áudio.</div>`);
  else items.push(`<div><strong>TV na prática:</strong> avalie se o tamanho da tela conversa com o espaço da sala e com o nível de imersão que você quer.</div>`);
  return items.join('');
}
function note(display,sound){
  if(dt.value==='projetor') return `<strong>📽️ Com projetor:</strong> pense no cinema inteiro, não só no projetor. Tela grande pede controle de luz, bom ponto para a soundbar e atenção ao caminho das conexões.`;
  const strongSound=(sound.chips||[]).join(' ').match(/Atmos|5\.1|5\.1\.3|3\.1\.2/i);
  return `<strong>📺 Com TV:</strong> ${strongSound?'a soundbar escolhida já puxa a experiência para algo mais cinematográfico.':'esta combinação favorece praticidade e ganho de áudio sem complicar tanto o ambiente.'} Confira HDMI ARC/eARC e formatos de áudio suportados.`;
}
function heroVisual(display,sound){
  const holder=document.getElementById('cinemaHeroVisual');
  if(!holder) return;
  holder.innerHTML=`
    <div class="visual-ring"></div>
    <div class="visual-card a">${imgTag(display)}<span>${esc(dt.value==='projetor'?'imagem':'tv')}</span></div>
    <div class="visual-card b">${imgTag(sound)}<span>áudio</span></div>
    <div class="visual-card c"><span style="margin-top:0">combo em tempo real</span></div>`;
}
function render(){
  const display=data.find(p=>p.id===ds.value);
  const sound=data.find(p=>p.id===ss.value);
  if(!display||!sound) return;
  state={displayType:dt.value,display:display.id,sound:sound.id};
  localStorage.setItem(KEY,JSON.stringify(state));
  document.getElementById('displayCard').innerHTML=productCard(display,dt.value==='projetor'?'imagem principal':'tela principal');
  document.getElementById('soundCard').innerHTML=productCard(sound,'áudio');
  document.getElementById('cinemaVisual').innerHTML=stageVisual(display,sound);
  document.getElementById('cinemaSummary').innerHTML=stageSummary(display,sound);
  document.getElementById('cinemaChecklist').innerHTML=checklist(display,sound);
  document.getElementById('cinemaNote').innerHTML=note(display,sound);
  heroVisual(display,sound);
}
dt.onchange=()=>{state.displayType=dt.value;delete state.display;fill()};
ds.onchange=render;
ss.onchange=render;
document.getElementById('shareBuild').onclick=async e=>{
  const u=new URL(location.href);
  u.searchParams.set('setup',btoa(JSON.stringify(state)));
  await PNMShare(u.toString(),'Cinema em Casa — Preço na Mira');
  e.target.textContent='✓ LINK COPIADO';
  setTimeout(()=>e.target.textContent='🔗 COMPARTILHAR SETUP',1600);
};
fill();
