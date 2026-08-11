(function(){
  function make(KEY,eventName){const MAX=4;function get(){try{return JSON.parse(localStorage.getItem(KEY)||'[]').filter(Boolean).slice(0,MAX)}catch(e){return[]}}function set(ids){localStorage.setItem(KEY,JSON.stringify([...new Set(ids)].slice(0,MAX)));document.dispatchEvent(new CustomEvent(eventName,{detail:get()}));}function add(id){const ids=get();if(ids.includes(id))return true;if(ids.length>=MAX)return false;ids.push(id);set(ids);return true}function remove(id){set(get().filter(x=>x!==id))}function toggle(id){const ids=get();if(ids.includes(id)){remove(id);return 'removed'}return add(id)?'added':'limit'}function clear(){set([])}function has(id){return get().includes(id)}return {get,set,add,remove,toggle,clear,has,MAX,KEY};}
  window.PNMCompare=make('precoNaMiraComparacao','pnm:comparechange');
  window.PNMHeadCompare=make('precoNaMiraComparacaoFones','pnm:headcomparechange');
  window.PNMSoundbarCompare=make('precoNaMiraComparacaoSoundbars','pnm:soundbarcomparechange');
  window.PNMWearCompare=make('precoNaMiraComparacaoSmartwatches','pnm:wearcomparechange');
  window.PNMTVCompare=make('precoNaMiraComparacaoTVs','pnm:tvcomparechange');
  window.PNMSmartphoneCompare=make('precoNaMiraComparacaoSmartphones','pnm:smartphonecomparechange');
  window.PNMNotebookCompare=make('precoNaMiraComparacaoNotebooks','pnm:notebookcomparechange');
  window.PNMMonitorCompare=make('precoNaMiraComparacaoMonitores','pnm:monitorcomparechange');
  window.PNMTabletCompare=make('precoNaMiraComparacaoTablets','pnm:tabletcomparechange');
  window.PNMInternetCompare=make('precoNaMiraComparacaoInternet','pnm:internetcomparechange');
  window.PNMProjectorCompare=make('precoNaMiraComparacaoProjetores','pnm:projectorcomparechange');
  window.PNMHouseManagers={};
  window.PNMGetHouseManager=function(subtipo){const key=String(subtipo||'geral').replace(/[^a-z0-9_-]/gi,'');if(!PNMHouseManagers[key]) PNMHouseManagers[key]=make('precoNaMiraCasa_'+key,'pnm:housecomparechange:'+key);return PNMHouseManagers[key];}
  window.PNMKitchenManagers={};
  window.PNMGetKitchenManager=function(subtipo){const key=String(subtipo||'geral').replace(/[^a-z0-9_-]/gi,'');if(!PNMKitchenManagers[key]) PNMKitchenManagers[key]=make('precoNaMiraCozinha_'+key,'pnm:kitchencomparechange:'+key);return PNMKitchenManagers[key];}
  window.PNMLaundryManagers={};
  window.PNMGetLaundryManager=function(subtipo){const key=String(subtipo||'geral').replace(/[^a-z0-9_-]/gi,'');if(!PNMLaundryManagers[key]) PNMLaundryManagers[key]=make('precoNaMiraLavanderia_'+key,'pnm:laundrycomparechange:'+key);return PNMLaundryManagers[key];}
  window.PNMAccessoryManagers={};
  window.PNMGetAccessoryManager=function(subtipo){const key=String(subtipo||'geral').replace(/[^a-z0-9_-]/gi,'');if(!PNMAccessoryManagers[key]) PNMAccessoryManagers[key]=make('precoNaMiraAcessorios_'+key,'pnm:accessorycomparechange:'+key);return PNMAccessoryManagers[key];}
  window.PNMBuildManagers={};
  window.PNMGetBuildManager=function(subtipo){const key=String(subtipo||'geral').replace(/[^a-z0-9_-]/gi,'');if(!PNMBuildManagers[key]) PNMBuildManagers[key]=make('precoNaMiraObra_'+key,'pnm:buildcomparechange:'+key);return PNMBuildManagers[key];}
  window.PNMFinishManagers={};
  window.PNMGetFinishManager=function(subtipo){const key=String(subtipo||'geral').replace(/[^a-z0-9_-]/gi,'');if(!PNMFinishManagers[key]) PNMFinishManagers[key]=make('precoNaMiraAcabamento_'+key,'pnm:finishcomparechange:'+key);return PNMFinishManagers[key];}
  window.PNMInstallManagers={};
  window.PNMGetInstallManager=function(subtipo){const key=String(subtipo||'geral').replace(/[^a-z0-9_-]/gi,'');if(!PNMInstallManagers[key]) PNMInstallManagers[key]=make('precoNaMiraInstalacao_'+key,'pnm:installcomparechange:'+key);return PNMInstallManagers[key];}
  window.PNMCompactManagers={};
  window.PNMGetCompactManager=function(subtipo){const key=String(subtipo||'geral').replace(/[^a-z0-9_-]/gi,'');if(!PNMCompactManagers[key]) PNMCompactManagers[key]=make('precoNaMiraCompacto_'+key,'pnm:compactcomparechange:'+key);return PNMCompactManagers[key];}
  window.PNMGamerManagers={};
  window.PNMGetGamerManager=function(subtipo){
    const key=String(subtipo||'geral').replace(/[^a-z0-9_-]/gi,'');
    if(!PNMGamerManagers[key]) PNMGamerManagers[key]=make('precoNaMiraGamer_'+key,'pnm:gamercomparechange:'+key);
    return PNMGamerManagers[key];
  };
  window.PNMGetManager=function(tipo,subtipo){return tipo==='fone'?PNMHeadCompare:tipo==='soundbar'?PNMSoundbarCompare:tipo==='smartwatch'?PNMWearCompare:tipo==='tv'?PNMTVCompare:tipo==='smartphone'?PNMSmartphoneCompare:tipo==='notebook'?PNMNotebookCompare:tipo==='monitor'?PNMMonitorCompare:tipo==='tablet'?PNMTabletCompare:tipo==='internet'?PNMInternetCompare:tipo==='projetor'?PNMProjectorCompare:tipo==='casa'?PNMGetHouseManager(subtipo):tipo==='gamer'?PNMGetGamerManager(subtipo):tipo==='cozinha'?PNMGetKitchenManager(subtipo):tipo==='lavanderia'?PNMGetLaundryManager(subtipo):tipo==='acessorio'?PNMGetAccessoryManager(subtipo):tipo==='obra'?PNMGetBuildManager(subtipo):tipo==='instalacao'?PNMGetInstallManager(subtipo):tipo==='acabamento'?PNMGetFinishManager(subtipo):tipo==='compacto'?PNMGetCompactManager(subtipo):PNMCompare};
})();
