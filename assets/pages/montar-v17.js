(()=>{
  'use strict';
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const order=['casa','cozinha','sala-cinema','banheiro','lavanderia','home-office','setup-gamer','compacto','casa-inteligente'];

  function projectCard(p){
    const env=PNMProjects.environments[p.type]||PNMProjects.environments.cozinha;
    const pct=PNMProjects.completion(p);
    const issues=PNMProjects.diagnostics(p).filter(x=>['critical','warning'].includes(x.level)).length;
    return `<a class="pj-project-card" href="projeto?projeto=${encodeURIComponent(p.id)}">
      <span class="pj-card-no">${esc(env.label).toUpperCase()}</span>
      <h3>${esc(p.name)}</h3>
      <p>${esc(env.description)}</p>
      <div class="pj-card-foot"><span>${issues?issues+' pendência'+(issues===1?'':'s'):'sem pendências críticas'}</span><b>${pct}%</b></div>
      <div class="pj-progress-line"><i style="width:${pct}%"></i></div>
    </a>`;
  }

  function templateCard(key,index){
    const env=PNMProjects.environments[key];
    return `<button type="button" class="pj-template-card" data-new="${key}">
      <span class="pj-card-no">${String(index+1).padStart(2,'0')}</span>
      <h3>${esc(env.label)}</h3>
      <p>${esc(env.description)}</p>
      <span class="pj-card-foot"><span>ESCOLHER</span><b>→</b></span>
    </button>`;
  }

  function render(){
    const list=PNMProjects.list();
    const listBox=$('#projectList');
    const existing=$('#existingProjectsSection');
    const fresh=$('#newProjectSection');
    const templates=$('#templates');

    if(listBox)listBox.innerHTML=list.length?`<div class="pj-project-grid">${list.slice(0,6).map(projectCard).join('')}</div>`:'';
    if(templates)templates.innerHTML=order.slice(0,8).map(templateCard).join('');

    if(existing){
      existing.hidden=!list.length;
      if(list.length&&fresh&&existing.previousElementSibling!==fresh)fresh.before(existing);
    }
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