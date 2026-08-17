(()=>{
  'use strict';
  const esc=s=>String(s??'');
  const getProject=()=>{
    const id=new URLSearchParams(location.search).get('projeto');
    return id?window.PNMProjects?.get(id):window.PNMProjects?.active?.();
  };
  function summary(project){
    const env=window.PNMProjects?.environments?.[project.type];
    const progress=window.PNMProjects?.completion?.(project)??0;
    const issues=(window.PNMProjects?.diagnostics?.(project)||[]).filter(item=>['critical','warning'].includes(item.level)).length;
    const products=Array.isArray(project.selection)?project.selection.length:0;
    return [
      `🎯 ${project.name} — Preço na Mira`,
      `Ambiente: ${env?.label||project.type||'Projeto'}`,
      `Planejamento: ${progress}%`,
      `Produtos selecionados: ${products}`,
      `Pendências para revisar: ${issues}`,
      '',
      'Monte e compare em: https://preconamira.com.br/montar'
    ].join('\n');
  }
  async function shareText(text){
    try{if(navigator.share){await navigator.share({title:'Projeto — Preço na Mira',text});return true}}catch(error){if(error?.name==='AbortError')return false}
    try{await navigator.clipboard.writeText(text);return true}catch(_){const area=document.createElement('textarea');area.value=text;document.body.appendChild(area);area.select();const ok=document.execCommand('copy');area.remove();return ok}
  }
  function enhance(){
    const actions=document.querySelector('.pjw-actions');
    if(!actions||actions.querySelector('[data-pnm-share-summary]'))return;
    const shareButton=actions.querySelector('[data-action="share"]');
    if(shareButton){shareButton.textContent='COMPARTILHAR LINK';shareButton.title='Gera um link importável para abrir o projeto em outro dispositivo.'}
    const button=document.createElement('button');
    button.type='button';
    button.dataset.pnmShareSummary='1';
    button.textContent='COMPARTILHAR RESUMO';
    button.title='Compartilha um resumo curto do projeto por WhatsApp ou outros apps.';
    button.addEventListener('click',async()=>{
      const project=getProject();
      if(!project)return;
      const ok=await shareText(summary(project));
      if(ok&&typeof window.PNMCartToast==='function')window.PNMCartToast('Resumo do projeto pronto para compartilhar.');
    });
    shareButton?.after(button);
  }
  const observer=new MutationObserver(enhance);
  const app=document.getElementById('projectApp');
  if(app)observer.observe(app,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance,{once:true});else enhance();
})();
