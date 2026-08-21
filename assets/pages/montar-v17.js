(()=>{
  'use strict';
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const primaryOrder=['cozinha','sala-cinema','banheiro','home-office'];
  const moreOrder=['casa','lavanderia','setup-gamer','casa-inteligente'];
  const envIcons={casa:'⌂',cozinha:'◫','sala-cinema':'▣',banheiro:'◌',lavanderia:'↻','home-office':'⌨','setup-gamer':'◆','casa-inteligente':'◎'};
  let selectedType='';
  let selectedButton=null;

  function issueCount(project){
    return PNMProjects.diagnostics(project).filter(item=>['critical','warning'].includes(item.level)).length;
  }

  function projectCard(project){
    const env=PNMProjects.environments[project.type]||PNMProjects.environments.cozinha;
    const issues=issueCount(project);
    const products=Array.isArray(project.selection)?project.selection.length:0;
    return `<a class="p4-project-card" href="projeto?projeto=${encodeURIComponent(project.id)}">
      <span class="p4-project-icon" aria-hidden="true">${esc(envIcons[project.type]||'◎')}</span>
      <span class="p4-project-type">${esc(env.label)}</span>
      <h3>${esc(project.name)}</h3>
      <p>${products?`${products} ${products===1?'produto selecionado':'produtos selecionados'}`:'Nenhum produto selecionado ainda'}</p>
      <span class="p4-project-meta">${issues?`${issues} ${issues===1?'pendência para revisar':'pendências para revisar'}`:'Sem pendências críticas'} <b>ABRIR →</b></span>
    </a>`;
  }

  function templateCard(type){
    const env=PNMProjects.environments[type];
    if(!env)return '';
    return `<button type="button" class="p4-choice-card" data-new="${esc(type)}" aria-pressed="${selectedType===type?'true':'false'}">
      <span class="p4-choice-icon" aria-hidden="true">${esc(envIcons[type]||'◎')}</span>
      <span><strong>${esc(env.label)}</strong><small>${esc(env.description)}</small></span>
      <b aria-hidden="true">→</b>
    </button>`;
  }

  function render(){
    const projects=PNMProjects.list();
    const existing=$('#existingProjectsSection');
    const projectList=$('#projectList');
    const continueLink=$('#continueProjectLink');
    const primary=$('#templatesPrimary');
    const more=$('#templatesMore');

    if(primary)primary.innerHTML=primaryOrder.map(templateCard).join('');
    if(more)more.innerHTML=moreOrder.map(templateCard).join('');

    if(existing&&projectList){
      existing.hidden=!projects.length;
      projectList.innerHTML=projects.length?`<div class="p4-project-grid">${projects.map(projectCard).join('')}</div>`:'';
    }
    if(continueLink){
      continueLink.hidden=!projects.length;
      if(projects.length)continueLink.href=`projeto?projeto=${encodeURIComponent(projects[0].id)}`;
    }
  }

  function choose(type,button){
    const env=PNMProjects.environments[type];
    if(!env)return;
    selectedType=type;
    selectedButton=button||null;
    document.querySelectorAll('[data-new]').forEach(el=>el.setAttribute('aria-pressed',el.dataset.new===type?'true':'false'));
    const panel=$('#projectStartPanel');
    $('#selectedProjectLabel').textContent=env.label;
    $('#selectedProjectDescription').textContent=env.description;
    panel.hidden=false;
    panel.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});
    setTimeout(()=>$('#newProjectName')?.focus({preventScroll:true}),0);
  }

  document.addEventListener('click',event=>{
    const choice=event.target.closest('[data-new]');
    if(choice){choose(choice.dataset.new,choice);return;}
    if(event.target.closest('#changeProjectButton')){
      selectedType='';
      document.querySelectorAll('[data-new]').forEach(el=>el.setAttribute('aria-pressed','false'));
      $('#projectStartPanel').hidden=true;
      selectedButton?.focus();
      return;
    }
    if(event.target.closest('#createProjectButton')){
      if(!selectedType)return;
      const typedName=$('#newProjectName')?.value?.trim();
      const project=PNMProjects.create(selectedType,typedName?{name:typedName}:{});
      location.href=`projeto?projeto=${encodeURIComponent(project.id)}`;
    }
  });

  document.addEventListener('pnm:projects',render);
  render();
})();
