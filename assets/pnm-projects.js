(()=>{
 const KEY='pnmProjectsV17';
 const ACTIVE='pnmProjectsActiveV17';
 const VERSION=1;
 const now=()=>new Date().toISOString();
 const uid=()=>`p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
 const clone=o=>JSON.parse(JSON.stringify(o));
 const environments={
  casa:{label:'Casa inteira',short:'Casa',description:'Planeje a casa por etapas, ambientes e decisões críticas.',defaultName:'Projeto da casa'},
  cozinha:{label:'Cozinha',short:'Cozinha',description:'Medidas, infraestrutura, equipamentos e acabamento no mesmo plano.',defaultName:'Minha cozinha'},
  'sala-cinema':{label:'Sala & Cinema',short:'Sala',description:'Tela, áudio, rede, layout e pontos elétricos antes da compra.',defaultName:'Sala & cinema'},
  banheiro:{label:'Banheiro',short:'Banheiro',description:'Louças, metais, ducha, elétrica e hidráulica com contexto.',defaultName:'Meu banheiro'},
  lavanderia:{label:'Lavanderia',short:'Lavanderia',description:'Capacidade, medidas, água, esgoto e tensão organizados antes da escolha.',defaultName:'Minha lavanderia'},
  'home-office':{label:'Home Office',short:'Home office',description:'Computação, rede, energia, ergonomia e periféricos.',defaultName:'Meu home office'},
  'setup-gamer':{label:'Setup Gamer',short:'Setup gamer',description:'PC ou notebook, monitor, periféricos, rede e energia no mesmo projeto.',defaultName:'Meu setup gamer'},
  compacto:{label:'Pequeno espaço',short:'Compacto',description:'Medidas e circulação passam a ser restrições reais do projeto.',defaultName:'Meu espaço compacto'},
  'casa-inteligente':{label:'Casa Inteligente',short:'Casa smart',description:'Rede, automação, segurança, acesso e energia conectados.',defaultName:'Minha casa inteligente'}
 };
 const definitions={
  cozinha:{
   requirements:[['geladeira','Geladeira'],['cooktop','Cooktop / fogão'],['forno','Forno'],['microondas','Micro-ondas'],['lava-loucas','Lava-louças'],['purificador','Purificador'],['airfryer','Air fryer'],['cafeteira','Cafeteira']],
   infra:['voltage','water','drain','gas'],
   rules:{
    geladeira:p=>p.tipoProduto==='cozinha'&&p.subtipoCozinha==='geladeira',
    cooktop:p=>p.tipoProduto==='cozinha'&&['cooktop','fogao'].includes(p.subtipoCozinha),
    forno:p=>p.tipoProduto==='cozinha'&&p.subtipoCozinha==='forno',
    microondas:p=>p.tipoProduto==='cozinha'&&p.subtipoCozinha==='microondas',
    'lava-loucas':p=>p.tipoProduto==='cozinha'&&p.subtipoCozinha==='lava-loucas',
    purificador:p=>p.tipoProduto==='cozinha'&&p.subtipoCozinha==='purificador',
    airfryer:p=>p.tipoProduto==='cozinha'&&p.subtipoCozinha==='airfryer',
    cafeteira:p=>p.tipoProduto==='cozinha'&&String(p.subtipoCozinha||'').startsWith('cafeteira')
   }
  },
  'sala-cinema':{
   requirements:[['tv','TV'],['projetor','Projetor'],['soundbar','Soundbar'],['internet','Rede / Wi-Fi']], infra:['voltage','network'],
   rules:{tv:p=>p.tipoProduto==='tv',projetor:p=>p.tipoProduto==='projetor',soundbar:p=>p.tipoProduto==='soundbar',internet:p=>p.tipoProduto==='internet'}
  },
  banheiro:{
   requirements:[['vaso','Vaso sanitário'],['cuba','Cuba'],['torneira','Torneira / misturador'],['ducha','Ducha / chuveiro'],['iluminacao','Iluminação']], infra:['voltage','water','drain'],
   rules:{
    vaso:p=>p.tipoProduto==='acabamento'&&p.subtipoAcabamento==='louca-sanitaria',
    cuba:p=>p.tipoProduto==='acabamento'&&p.subtipoAcabamento==='cuba',
    torneira:p=>p.tipoProduto==='acabamento'&&p.subtipoAcabamento==='torneira-banheiro',
    ducha:p=>(p.tipoProduto==='acabamento'&&p.subtipoAcabamento==='ducha')||(p.tipoProduto==='instalacao'&&p.subtipoInstalacao==='chuveiro'),
    iluminacao:p=>(p.tipoProduto==='instalacao'&&p.subtipoInstalacao==='iluminacao')||(p.tipoProduto==='acabamento'&&p.subtipoAcabamento==='iluminacao-decorativa')
   }
  },
  lavanderia:{
   requirements:[['lavadora','Lavadora / lava e seca'],['organizacao','Apoio e organização']], infra:['voltage','water','drain'],
   rules:{lavadora:p=>p.tipoProduto==='lavanderia',organizacao:p=>p.tipoProduto==='lavanderia'||(p.tipoProduto==='casa'&&p.subtipoCasa==='energia')}
  },
  'home-office':{
   requirements:[['notebook','Notebook'],['monitor','Monitor'],['internet','Rede / Wi-Fi'],['hub','Hub / dock'],['energia','Carregamento']], infra:['voltage','network'],
   rules:{notebook:p=>p.tipoProduto==='notebook',monitor:p=>p.tipoProduto==='monitor',internet:p=>p.tipoProduto==='internet',hub:p=>p.tipoProduto==='acessorio'&&p.subtipoAcessorio==='hub',energia:p=>p.tipoProduto==='acessorio'&&['carregador','powerbank'].includes(p.subtipoAcessorio)}
  },
  'setup-gamer':{
   requirements:[['cpu','Processador'],['gpu','Placa de vídeo'],['monitor','Monitor'],['teclado','Teclado'],['mouse','Mouse'],['internet','Rede / Wi-Fi']], infra:['voltage','network'],
   rules:{cpu:p=>p.tipoProduto==='gamer'&&p.subtipoGamer==='cpu',gpu:p=>p.tipoProduto==='gamer'&&p.subtipoGamer==='gpu',monitor:p=>p.tipoProduto==='monitor',teclado:p=>p.tipoProduto==='gamer'&&p.subtipoGamer==='keyboard',mouse:p=>p.tipoProduto==='gamer'&&p.subtipoGamer==='mouse',internet:p=>p.tipoProduto==='internet'}
  },
  'casa-inteligente':{
   requirements:[['rede','Rede'],['assistente','Assistente'],['iluminacao','Iluminação'],['seguranca','Segurança'],['acesso','Acesso'],['limpeza','Limpeza']], infra:['voltage','network'],
   rules:{rede:p=>p.tipoProduto==='casa'&&p.subtipoCasa==='rede'||p.tipoProduto==='internet',assistente:p=>p.tipoProduto==='casa'&&p.subtipoCasa==='assistente',iluminacao:p=>p.tipoProduto==='casa'&&p.subtipoCasa==='iluminacao',seguranca:p=>p.tipoProduto==='casa'&&p.subtipoCasa==='camera',acesso:p=>p.tipoProduto==='casa'&&p.subtipoCasa==='acesso',limpeza:p=>p.tipoProduto==='casa'&&p.subtipoCasa==='robot'}
  },
  compacto:{
   requirements:[['cozinha','Cozinha compacta'],['lavanderia','Lavanderia compacta'],['trabalho','Trabalho / estudo'],['limpeza','Limpeza e piso livre'],['banheiro','Banheiro compacto'],['iluminacao','Iluminação'],['conectividade','Rede e conectividade'],['entretenimento','Entretenimento']], infra:['voltage','water','drain','network'],
   rules:{
    cozinha:p=>p.tipoProduto==='cozinha'&&['airfryer','microondas','cooktop','panela-eletrica','mixer','liquidificador','grill','purificador'].includes(p.subtipoCozinha),
    lavanderia:p=>p.tipoProduto==='lavanderia'&&p.subtipoLavanderia==='compacta',
    trabalho:p=>['notebook','monitor'].includes(p.tipoProduto)||(p.tipoProduto==='acessorio'&&p.subtipoAcessorio==='hub'),
    limpeza:p=>p.tipoProduto==='casa'&&p.subtipoCasa==='robot',
    banheiro:p=>(p.tipoProduto==='acabamento'&&['louca-sanitaria','cuba','torneira-banheiro','acessorio-banheiro'].includes(p.subtipoAcabamento))||(p.tipoProduto==='instalacao'&&['chuveiro','torneira-eletrica'].includes(p.subtipoInstalacao)),
    iluminacao:p=>(p.tipoProduto==='casa'&&p.subtipoCasa==='iluminacao')||(p.tipoProduto==='instalacao'&&p.subtipoInstalacao==='iluminacao')||(p.tipoProduto==='acabamento'&&p.subtipoAcabamento==='iluminacao-decorativa'),
    conectividade:p=>p.tipoProduto==='internet'||(p.tipoProduto==='casa'&&['rede','assistente','energia'].includes(p.subtipoCasa)),
    entretenimento:p=>['tv','projetor','soundbar'].includes(p.tipoProduto)
   }
  },
  casa:{requirements:[['obra','Obra base'],['instalacoes','Instalações'],['acabamentos','Acabamentos'],['cozinha','Cozinha'],['banheiro','Banheiro'],['sala','Sala'],['automacao','Automação']],infra:['voltage','water','drain','gas','network'],rules:{obra:p=>p.tipoProduto==='obra',instalacoes:p=>p.tipoProduto==='instalacao',acabamentos:p=>p.tipoProduto==='acabamento',cozinha:p=>p.tipoProduto==='cozinha',banheiro:p=>p.tipoProduto==='acabamento'&&['louca-sanitaria','cuba','torneira-banheiro','acessorio-banheiro'].includes(p.subtipoAcabamento),sala:p=>['tv','projetor','soundbar'].includes(p.tipoProduto),automacao:p=>p.tipoProduto==='casa'}}
 };
 function blank(type='cozinha'){
  const env=environments[type]||environments.cozinha, def=definitions[type]||definitions.cozinha;
  return {id:uid(),version:VERSION,name:env.defaultName,type,createdAt:now(),updatedAt:now(),stage:'planejamento',budget:'',priority:'equilibrio',dimensions:{length:'',width:'',height:''},infra:{voltage:'',water:'',drain:'',gas:'',network:''},requirements:Object.fromEntries(def.requirements.map(([k])=>[k,'unknown'])),style:{direction:'',palette:'',materials:[],composition:'',finish:'',notes:''},selection:[],pinned:[]};
 }
 function read(){try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v:[]}catch(e){return[]}}
 function write(items){localStorage.setItem(KEY,JSON.stringify(items));document.dispatchEvent(new CustomEvent('pnm:projects',{detail:{items}}));return items}
 function normalize(p){const base=blank(p?.type||'cozinha');return {...base,...p,dimensions:{...base.dimensions,...(p?.dimensions||{})},infra:{...base.infra,...(p?.infra||{})},requirements:{...base.requirements,...(p?.requirements||{})},style:{...base.style,...(p?.style||{})},selection:Array.isArray(p?.selection)?p.selection:[],pinned:Array.isArray(p?.pinned)?p.pinned:[]}}
 function list(){return read().map(normalize).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)))}
 function get(id){return list().find(p=>p.id===id)||null}
 function active(){return get(localStorage.getItem(ACTIVE))||list()[0]||null}
 function setActive(id){if(id)localStorage.setItem(ACTIVE,id);return get(id)}
 function create(type='cozinha',seed={}){const p=normalize({...blank(type),...seed,type});const items=list();items.unshift(p);write(items);setActive(p.id);return p}
 function update(id,patch){const items=list();let out=null;const next=items.map(p=>{if(p.id!==id)return p;out=normalize({...p,...patch,updatedAt:now(),dimensions:{...p.dimensions,...(patch.dimensions||{})},infra:{...p.infra,...(patch.infra||{})},requirements:{...p.requirements,...(patch.requirements||{})},style:{...p.style,...(patch.style||{})}});return out});write(next);return out}
 function remove(id){write(list().filter(p=>p.id!==id));if(localStorage.getItem(ACTIVE)===id)localStorage.removeItem(ACTIVE)}
 function duplicate(id){const p=get(id);if(!p)return null;return create(p.type,{...clone(p),id:uid(),name:p.name+' — cópia',createdAt:now(),updatedAt:now()})}
 function completion(p){p=normalize(p);let score=0,total=0;const add=(ok,w=1)=>{total+=w;if(ok)score+=w};add(Boolean(p.name),.5);add(Boolean(p.stage),.5);add(Boolean(p.budget),1);add(Boolean(p.dimensions.length&&p.dimensions.width),2);const def=definitions[p.type]||definitions.cozinha;def.infra.forEach(k=>add(Boolean(p.infra[k]),.65));const req=Object.values(p.requirements);add(req.some(v=>v==='need'||v==='have'),1);add(p.selection.length>0,1.5);add(Boolean(p.style.direction||p.style.palette||p.style.materials.length||p.style.composition||p.style.finish||p.style.notes),1);return Math.round(score/total*100)}
 function diagnostics(p){p=normalize(p);const d=[];const push=(level,title,text,action='Planejamento')=>d.push({level,title,text,action});
  if(!p.dimensions.length||!p.dimensions.width)push('warning','Medidas do ambiente ainda não informadas','Sem comprimento e largura, não é possível tratar encaixe e circulação como restrições reais.');
  if(!p.budget)push('info','Faixa de investimento não definida','Definir uma faixa ajuda a organizar prioridades, mesmo sem usar preço em tempo real.');
  const needs=Object.entries(p.requirements).filter(([,v])=>v==='need').map(([k])=>k);
  if(!needs.length)push('info','Nenhuma necessidade marcada','Marque o que ainda precisa entrar no projeto para receber uma seleção mais objetiva.');
  if(p.type==='cozinha'){
   if(needs.some(x=>['cooktop','forno','microondas','lava-loucas'].includes(x))&&!p.infra.voltage)push('critical','Tensão elétrica pendente','Há equipamentos elétricos no projeto, mas a tensão disponível ainda não foi informada.');
   if(needs.includes('lava-loucas')&&p.infra.water!=='sim')push('critical','Ponto de água para lava-louças não confirmado','Confirme alimentação de água antes de definir o equipamento.');
   if(needs.includes('lava-loucas')&&p.infra.drain!=='sim')push('critical','Esgoto para lava-louças não confirmado','Confirme o ponto de drenagem e o espaço de instalação.');
   if(needs.includes('cooktop')&&!p.infra.gas&&!p.infra.voltage)push('warning','Fonte de energia do cooktop indefinida','Informe gás ou tensão elétrica para evitar uma escolha incompatível com a infraestrutura.');
  }
  if(['home-office','setup-gamer','sala-cinema','casa-inteligente'].includes(p.type)&&!p.infra.network)push('warning','Rede ainda não definida','Conectividade pode mudar a escolha de roteador, posição dos equipamentos e necessidade de cabeamento.');
  if(p.type==='lavanderia'){
   if(p.infra.water!=='sim')push('critical','Ponto de água não confirmado','Lavadora e lava e seca exigem alimentação de água adequada.');
   if(p.infra.drain!=='sim')push('critical','Drenagem não confirmada','Confirme esgoto e altura/posição do ponto antes da compra.');
  }
  if(p.type==='banheiro'&&needs.includes('ducha')&&!p.infra.voltage)push('critical','Tensão da ducha não definida','A potência e a instalação dependem da rede elétrica disponível.');
  if(p.type==='compacto'){
   if(!p.dimensions.length||!p.dimensions.width)push('critical','Medidas são obrigatórias em espaço compacto','Aqui, poucos centímetros podem eliminar uma opção. Informe comprimento e largura antes de fechar a seleção.');
   if(needs.includes('lavanderia')&&p.infra.water!=='sim')push('critical','Ponto de água da lavanderia não confirmado','Confirme alimentação de água antes de escolher lavadora ou lava e seca.');
   if(needs.includes('lavanderia')&&p.infra.drain!=='sim')push('critical','Drenagem da lavanderia não confirmada','Confirme o ponto de esgoto e a posição da mangueira antes da compra.');
   if(needs.includes('cozinha')&&!p.infra.voltage)push('warning','Tensão da cozinha ainda não informada','Eletros compactos continuam dependendo da tensão disponível e da potência do circuito.');
   if(needs.includes('banheiro')&&p.infra.water!=='sim')push('warning','Ponto de água do banheiro não confirmado','Cubas, metais e banho exigem conferir alimentação, posição e espaço de instalação.');
   if(needs.includes('conectividade')&&!p.infra.network)push('warning','Rede do espaço ainda não definida','Em poucos metros, a posição do roteador e dos dispositivos influencia cobertura, cabos e tomadas.');
  }
  if(p.selection.length)push('ok','Seleção em andamento',`${p.selection.length} ${p.selection.length===1?'produto já faz':'produtos já fazem'} parte do projeto.`,'Produtos');
  if(!d.some(x=>x.level==='critical')&&completion(p)>=70)push('ok','Projeto bem encaminhado','As principais decisões já estão registradas. Revise os avisos antes de levar itens ao carrinho.','Visão geral');
  return d;
 }
 function recommendations(p,products,limitPerNeed=3){p=normalize(p);const def=definitions[p.type]||definitions.cozinha;const needs=Object.entries(p.requirements).filter(([,v])=>v==='need');const selected=new Set(p.selection);const quality=x=>(x.fonteTecnica?2:0)+(x.imagemTipo==='oficial'?1:0)+(x.destaque?1:0)+(x.linkAfiliado?1:0);
  return needs.map(([key])=>{const rule=def.rules[key];if(!rule)return null;const items=(products||[]).filter(x=>x.linkAfiliado&&rule(x)).sort((a,b)=>{const sa=selected.has(a.id)?-5:0,sb=selected.has(b.id)?-5:0;return (sb+quality(b))-(sa+quality(a))||String(a.nome).localeCompare(String(b.nome),'pt-BR')}).slice(0,limitPerNeed);const label=def.requirements.find(x=>x[0]===key)?.[1]||key;return {key,label,items}}).filter(x=>x&&x.items.length)
 }
 function encode(p){const safe={name:p.name,type:p.type,stage:p.stage,budget:p.budget,priority:p.priority,dimensions:p.dimensions,infra:p.infra,requirements:p.requirements,style:p.style,selection:p.selection,pinned:p.pinned};return btoa(unescape(encodeURIComponent(JSON.stringify(safe))))}
 function decode(s){try{return JSON.parse(decodeURIComponent(escape(atob(s))))}catch(e){return null}}
 function importShared(s){const x=decode(s);return x?create(x.type,{...x,name:(x.name||'Projeto compartilhado')+' — importado'}):null}
 function migrateLegacy(){if(list().length)return;try{const old=JSON.parse(localStorage.getItem('pnmCasaStudioV12')||'null');if(old&&typeof old==='object'&&(old.room||old.style||old.notes)){const map={'Cozinha':'cozinha','Sala':'sala-cinema','Banheiro':'banheiro','Home office':'home-office','Quarto':'casa'};create(map[old.room]||'cozinha',{name:old.room?`Projeto — ${old.room}`:'Meu projeto',style:{direction:old.style||'',palette:old.palette||'',materials:[],notes:old.notes||''},pinned:Array.isArray(old.pinned)?old.pinned:[]})}}catch(e){}
 }
 migrateLegacy();
 window.PNMProjects={environments,definitions,list,get,active,setActive,create,update,remove,duplicate,completion,diagnostics,recommendations,encode,decode,importShared,normalize};
})();