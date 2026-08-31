(()=>{
 const body=document.body,id=body.dataset.productId,type=body.dataset.productType,sub=body.dataset.productSubtype,compareUrl=body.dataset.compareUrl||'comparativo-geral';
 if(window.PNMRegisterView)PNMRegisterView(id);
 const fav=document.getElementById('fav'),list=document.getElementById('list'),utility=document.querySelector('.product-utility-row');let cart=document.getElementById('cart');if(!cart&&utility){cart=document.createElement('button');cart.id='cart';cart.className='pnm-product-cart';cart.type='button';utility.prepend(cart)}function sync(){if(fav&&window.PNMFavorites){const on=PNMFavorites.has(id);fav.classList.toggle('active',on);fav.textContent=on?'♥ NOS FAVORITOS':'♡ FAVORITAR'}if(list&&window.PNMList){const on=PNMList.has(id);list.classList.toggle('active',on);list.textContent=on?'✓ NA MINHA LISTA':'＋ MINHA LISTA'}if(cart&&window.PNMCart){const on=PNMCart.has(id);cart.classList.toggle('active',on);cart.textContent=on?'✓ NO CARRINHO — VER':'🛒 ADICIONAR AO CARRINHO'}}sync();if(fav)fav.onclick=()=>{PNMFavorites.toggle(id);sync()};if(list)list.onclick=()=>{PNMList.toggle(id);sync()};if(cart)cart.onclick=()=>{if(PNMCart.has(id)){location.href='carrinho';return}PNMCart.add(id);PNMCartToast('Produto adicionado ao carrinho.','VER CARRINHO');sync()};
 const share=document.getElementById('share');if(share)share.onclick=async()=>{await PNMShare(location.href,document.title);share.textContent='✓ LINK COPIADO';setTimeout(()=>share.textContent='🔗 COMPARTILHAR',1800)};
 const cb=document.getElementById('productCompare');if(cb&&window.PNMGetManager){const man=PNMGetManager(type,sub);const syncC=()=>{const on=man.has(id);cb.classList.toggle('selected',on);cb.textContent=on?'✓ ADICIONADO — ABRIR COMPARADOR':'ADICIONAR AO COMPARATIVO'};syncC();cb.onclick=()=>{if(man.has(id)){location.href=compareUrl;return}if(!man.add(id)){alert('Você já escolheu 4 produtos.');location.href=compareUrl;return}syncC()}}

 function addRichProductInfo(){
  if(document.querySelector('[data-pnm-rich-product]'))return;
  const main=document.querySelector('main'),h1=document.querySelector('h1'),lead=document.querySelector('.product-detail-copy .lead'),summary=document.querySelector('.content-card p'),sideItems=[...document.querySelectorAll('.side-item')];
  if(!main||!h1)return;
  const name=(h1.textContent||'').trim(),base=(summary?.textContent||lead?.textContent||'').trim();
  const side={};sideItems.forEach(item=>{const strong=item.querySelector('strong');if(!strong)return;const key=(strong.textContent||'').trim().toLowerCase();const clone=item.cloneNode(true);clone.querySelector('strong')?.remove();side[key]=(clone.textContent||'').trim()});
  const brand=side.marca||'',category=side.categoria||'';
  const hay=`${name} ${base}`.replace(/\s+/g,' ');
  const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const cleanedBase=normalize(base).startsWith(normalize(name))?base.slice(name.length).replace(/^\s*[.·:;—-]*\s*/,'').trim():base;
  const specs=[];const seen=new Set();
  const add=(label,value)=>{label=String(label||'').trim();value=String(value||'').trim();if(!label||!value)return;const key=(label+'|'+value).toLowerCase();if(seen.has(key))return;seen.add(key);specs.push([label,value])};
  add('Marca',brand);add('Categoria',category);
  const mainsContext=/(air\s*fryer|cafeteira|forno|micro-?ondas|geladeira|refrigerador|freezer|lavadora|secadora|lava-?lou[cç]as|m[aá]quina de costura|furadeira|parafusadeira|serra|esmerilhadeira|aspirador|chuveiro|ducha|aquecedor|bomba|cooktop|fog[aã]o|liquidificador|batedeira|secador|ferro|instala[cç][aã]o|tomada|carregador)/i.test(`${category} ${type} ${name}`);
  const rules=[
   ['Potência',/\b(\d{2,5})\s*W\b/i,m=>`${m[1]} W`],['Capacidade',/\b(\d+(?:[.,]\d+)?)\s*(L|litros?|kg)\b/i,m=>`${m[1]} ${m[2]}`],['Armazenamento / memória',/\b(\d+)\s*(GB|TB)\b/i,m=>`${m[1]} ${m[2].toUpperCase()}`],['Tamanho',/\b(\d+(?:[.,]\d+)?)\s*(?:pol(?:egadas?)?|\")\b/i,m=>`${m[1]} polegadas`],['Proteção',/\bIP\d{2}\b/i,m=>m[0].toUpperCase()],['Pontos',/\b(\d{1,3})\s*pontos?\b/i,m=>`${m[1]} pontos`],['Bluetooth',/\bBluetooth\s*([0-9.]+)\b/i,m=>`Bluetooth ${m[1]}`],['Autonomia',/\b(?:até\s*)?(\d+(?:[.,]\d+)?)\s*(?:h|horas?)\b/i,m=>`Até ${m[1]} h`],['Resolução',/\b(4K|8K|1080p|1440p|2K)\b/i,m=>m[1].toUpperCase()]
  ];
  rules.forEach(([label,re,fmt])=>{const m=hay.match(re);if(m)add(label,fmt(m))});
  if(mainsContext){const voltage=hay.match(/\b(110|127|220|240)\s*V\b/i);if(voltage)add('Voltagem',`${voltage[1]} V`)}
  if(/port[aá]til/i.test(hay))add('Formato','Portátil');
  if(/uso dom[eé]stico|dom[eé]stica/i.test(hay))add('Uso','Doméstico');
  if(/bra[cç]o livre/i.test(hay))add('Recurso','Braço livre');
  if(specs.length<3&&!base)return;
  const section=document.createElement('section');section.className='section';section.dataset.pnmRichProduct='1';
  const container=document.createElement('div');container.className='container';
  const grid=document.createElement('div');grid.className='detail-grid';
  const about=document.createElement('article');about.className='content-card';
  const aboutTitle=document.createElement('h2');aboutTitle.textContent='Sobre o produto';about.append(aboutTitle);
  const intro=brand&&category?`${name} é um produto da ${brand} na categoria ${category}.`:brand?`${name} é um produto da ${brand}.`:'';
  const aboutText=document.createElement('p');aboutText.textContent=[intro,cleanedBase].filter(Boolean).join(' ');about.append(aboutText);
  if(specs.length){const specTitle=document.createElement('h3');specTitle.textContent='Especificações principais';about.append(specTitle);const list=document.createElement('div');list.className='side-list';specs.slice(0,10).forEach(([label,value])=>{const item=document.createElement('div');item.className='side-item';const strong=document.createElement('strong');strong.textContent=label;item.append(strong,document.createTextNode(value));list.append(item)});about.append(list)}
  const highlights=document.createElement('aside');highlights.className='side-card';const hiTitle=document.createElement('h3');hiTitle.textContent='Pontos principais';highlights.append(hiTitle);const hiList=document.createElement('div');hiList.className='side-list';specs.filter(([label])=>!['Marca','Categoria'].includes(label)).slice(0,5).forEach(([label,value])=>{const item=document.createElement('div');item.className='side-item';const strong=document.createElement('strong');strong.textContent=label;item.append(strong,document.createTextNode(value));hiList.append(item)});highlights.append(hiList);const note=document.createElement('div');note.className='notice';const voltageNote=specs.some(([label])=>label==='Voltagem')?', voltagem':'';note.innerHTML=`<strong>Antes de comprar:</strong> confirme a variante${voltageNote}, medidas, acessórios inclusos, garantia e condições do anúncio.`;highlights.append(note);
  grid.append(about,highlights);container.append(grid);section.append(container);main.append(section);
 }
 addRichProductInfo();
})();