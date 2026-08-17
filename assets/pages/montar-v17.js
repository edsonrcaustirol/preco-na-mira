(()=>{
  'use strict';
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const order=['casa','cozinha','sala-cinema','banheiro','lavanderia','home-office','setup-gamer','compacto','casa-inteligente'];
  const products=typeof PRODUTOS!=='undefined'&&Array.isArray(PRODUTOS)?PRODUTOS:[];
  const usedImages=new Set();
  const envIcons={casa:'⌂',cozinha:'◫','sala-cinema':'▣',banheiro:'◌',lavanderia:'↻','home-office':'⌨','setup-gamer':'◆',compacto:'↔','casa-inteligente':'◎'};
  const envLabels={casa:'CASA COMPLETA',cozinha:'ROTINA E PREPARO','sala-cinema':'IMAGEM E ÁUDIO',banheiro:'LOUÇAS E METAIS',lavanderia:'LAVAGEM E APOIO','home-office':'TRABALHO E REDE','setup-gamer':'PC E PERIFÉRICOS',compacto:'MEDIDAS PRIMEIRO','casa-inteligente':'AUTOMAÇÃO E REDE'};

  function haystack(p){return norm([p.nome,p.marca,p.categoria,p.categoriaId,p.tipoProduto,p.subtipoCozinha,p.subtipoCasa,p.subtipoAcabamento,p.subtipoInstalacao,p.subtipoGamer,p.subtipoLavanderia].filter(Boolean).join(' '));}
  const matchers={
    casa:p=>['casa','obra','acabamento','instalacao','cozinha'].includes(String(p.tipoProduto||'')),
    cozinha:p=>p.tipoProduto==='cozinha'||/air fryer|cafeteira|micro-ondas|microondas|cooktop|geladeira/.test(haystack(p)),
    'sala-cinema':p=>['tv','soundbar','projetor'].includes(String(p.tipoProduto||''))||/televisao|televisão|soundbar|projetor/.test(haystack(p)),
    banheiro:p=>(p.tipoProduto==='acabamento'&&/banheiro|cuba|torneira|ducha|louca|louça|vaso/.test(haystack(p)))||/chuveiro|ducha|cuba|vaso sanitario|vaso sanitário/.test(haystack(p)),
    lavanderia:p=>p.tipoProduto==='lavanderia'||/lavadora|lava e seca|maquina de lavar|máquina de lavar/.test(haystack(p)),
    'home-office':p=>['notebook','monitor','internet'].includes(String(p.tipoProduto||''))||/notebook|monitor|hub usb|roteador/.test(haystack(p)),
    'setup-gamer':p=>p.tipoProduto==='gamer'||/rtx|geforce|radeon|teclado gamer|mouse gamer|monitor gamer/.test(haystack(p)),
    compacto:p=>(p.tipoProduto==='casa'&&p.subtipoCasa==='robot')||(p.tipoProduto==='cozinha'&&['airfryer','microondas','cooktop','panela-eletrica'].includes(p.subtipoCozinha))||/robo aspirador|robô aspirador/.test(haystack(p)),
    'casa-inteligente':p=>p.tipoProduto==='casa'||p.tipoProduto==='internet'||/smart|camera|câmera|roteador|assistente/.test(haystack(p))
  };

  function productImageFor(type){
    const match=matchers[type]||(()=>true);
    const candidates=products.filter(p=>{
      const image=String(p?.imagem||'');
      return image.startsWith('assets/')&&match(p)&&!usedImages.has(image);
    }).sort((a,b)=>(b.imagemTipo==='oficial'?1:0)-(a.imagemTipo==='oficial'?1:0)||(b.destaque?1:0)-(a.destaque?1:0));
    const selected=candidates[0]||products.find(p=>String(p?.imagem||'').startsWith('assets/')&&match(p));
    if(selected?.imagem)usedImages.add(selected.imagem);
    return selected||null;
  }

  function mediaMarkup(type,index){
    const product=productImageFor(type);
    if(!product)return `<div class="pj-template-media is-empty"><div class="pj-template-badges"><span>${String(index+1).padStart(2,'0')}</span><span>${esc(envLabels[type]||'PROJETO')}</span></div></div>`;
    return `<div class="pj-template-media"><img src="${esc(product.imagem)}" alt="${esc(product.imagemAlt||product.nome||'Referência visual do ambiente')}" width="600" height="420" loading="lazy" decoding="async"><div class="pj-template-badges"><span>${String(index+1).padStart(2,'0')}</span><span>${esc(envLabels[type]||'PROJETO')}</span></div></div>`;
  }

  function projectCard(p){
    const env=PNMProjects.environments[p.type]||PNMProjects.environments.cozinha;
    const pct=PNMProjects.completion(p);
    const issues=PNMProjects.diagnostics(p).filter(x=>['critical','warning'].includes(x.level)).length;
    return `<a class="pj-project-card" href="projeto?projeto=${encodeURIComponent(p.id)}">
      <span class="pj-card-no">${esc(env.label).toUpperCase()}</span>
      <span class="pj-project-icon" aria-hidden="true">${esc(envIcons[p.type]||'◎')}</span>
      <h3>${esc(p.name)}</h3>
      <p>${esc(env.description)}</p>
      <div class="pj-card-foot"><span>${issues?issues+' pendência'+(issues===1?'':'s'):'sem pendências críticas'}</span><b>${pct}%</b></div>
      <div class="pj-progress-line"><i style="width:${Math.max(0,Math.min(100,pct))}%"></i></div>
    </a>`;
  }

  function templateCard(key,index){
    const env=PNMProjects.environments[key];
    return `<button type="button" class="pj-template-card" data-new="${esc(key)}" data-env="${esc(key)}">
      ${mediaMarkup(key,index)}
      <span class="pj-template-copy"><h3>${esc(env.label)}</h3><p>${esc(env.description)}</p><span class="pj-card-foot"><span>COMEÇAR PROJETO</span><b>→</b></span></span>
    </button>`;
  }

  function render(){
    const list=PNMProjects.list();
    const listBox=$('#projectList');
    const existing=$('#existingProjectsSection');
    const templates=$('#templates');
    if(listBox)listBox.innerHTML=list.length?`<div class="pj-project-grid">${list.slice(0,6).map(projectCard).join('')}</div>`:'';
    if(templates){usedImages.clear();templates.innerHTML=order.map(templateCard).join('');}
    if(existing)existing.hidden=!list.length;
  }

  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-new]');
    if(!button)return;
    const typedName=$('#newProjectName')?.value?.trim();
    const seed=typedName?{name:typedName}:{};
    const project=PNMProjects.create(button.dataset.new,seed);
    location.href=`projeto?projeto=${encodeURIComponent(project.id)}`;
  });

  render();
})();