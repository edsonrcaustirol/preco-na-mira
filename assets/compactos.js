/* Preço na Mira V17.1 — curadoria funcional para espaços compactos */
(function(){
  const kitchen=['airfryer','microondas','cooktop','panela-eletrica','mixer','liquidificador','grill','purificador','cafeteira-capsula','cafeteira-espresso','cafeteira-filtro'];
  const bathroom=['louca-sanitaria','cuba','torneira-banheiro','acessorio-banheiro'];
  const INTENTS=[
    {id:'cozinhar',icon:'🍳',nome:'Cozinhar com pouca bancada',descricao:'Eletros de bancada e cocção organizados por função.',match:p=>p.tipoProduto==='cozinha'&&kitchen.includes(p.subtipoCozinha)},
    {id:'lavar',icon:'🧺',nome:'Lavar em lavanderia pequena',descricao:'Lavadoras compactas e lava-louças de menor porte, sempre com medidas e instalação a confirmar.',match:p=>(p.tipoProduto==='lavanderia'&&p.subtipoLavanderia==='compacta')||(p.tipoProduto==='cozinha'&&p.subtipoCozinha==='lava-loucas'&&p.porteEspaco==='compacto')},
    {id:'trabalhar',icon:'💻',nome:'Trabalhar sem ocupar a casa',descricao:'Notebook, monitor, hub e energia para um posto flexível.',match:p=>['notebook','monitor'].includes(p.tipoProduto)||(p.tipoProduto==='acessorio'&&p.subtipoAcessorio!=='ram-notebook')},
    {id:'limpar',icon:'🧹',nome:'Limpar sem guardar trambolho',descricao:'Robôs e automação de limpeza para manter o piso livre.',match:p=>p.tipoProduto==='casa'&&p.subtipoCasa==='robot'},
    {id:'banheiro',icon:'🚿',nome:'Resolver um banheiro compacto',descricao:'Cubas, louças, metais, acessórios e banho.',match:p=>(p.tipoProduto==='acabamento'&&bathroom.includes(p.subtipoAcabamento))||(p.tipoProduto==='instalacao'&&['chuveiro','torneira-eletrica'].includes(p.subtipoInstalacao))},
    {id:'iluminar',icon:'💡',nome:'Ganhar conforto com luz',descricao:'Iluminação funcional, decorativa e conectada.',match:p=>(p.tipoProduto==='casa'&&p.subtipoCasa==='iluminacao')||(p.tipoProduto==='instalacao'&&p.subtipoInstalacao==='iluminacao')||(p.tipoProduto==='acabamento'&&p.subtipoAcabamento==='iluminacao-decorativa')},
    {id:'conectar',icon:'📶',nome:'Conectar sem espalhar aparelhos',descricao:'Rede, assistentes, energia e internet para a casa compacta.',match:p=>p.tipoProduto==='internet'||(p.tipoProduto==='casa'&&['rede','assistente','energia'].includes(p.subtipoCasa))},
    {id:'relaxar',icon:'🎬',nome:'Relaxar sem uma sala enorme',descricao:'TV, projetor e áudio pensados para entretenimento.',match:p=>['tv','projetor','soundbar'].includes(p.tipoProduto)}
  ];
  const COMPARE=[
    ['cozinha-airfryer','Air fryers','cozinha','subtipoCozinha','airfryer'],
    ['cozinha-microondas','Micro-ondas','cozinha','subtipoCozinha','microondas'],
    ['cozinha-cooktop','Cooktops','cozinha','subtipoCozinha','cooktop'],
    ['cozinha-panela','Panelas elétricas','cozinha','subtipoCozinha','panela-eletrica'],
    ['cozinha-purificador','Purificadores','cozinha','subtipoCozinha','purificador'],
    ['cozinha-cafe','Cafeteiras de cápsula','cozinha','subtipoCozinha','cafeteira-capsula'],
    ['cozinha-lava-loucas','Lava-louças compactas','cozinha','subtipoCozinha','lava-loucas'],
    ['lavanderia-compacta','Lavadoras para pouco espaço','lavanderia','subtipoLavanderia','compacta'],
    ['trabalho-notebook','Notebooks','notebook',null,null],
    ['trabalho-monitor','Monitores','monitor',null,null],
    ['trabalho-hub','Hubs USB-C','acessorio','subtipoAcessorio','hub'],
    ['limpeza-robot','Robôs aspiradores','casa','subtipoCasa','robot'],
    ['banheiro-cuba','Cubas','acabamento','subtipoAcabamento','cuba'],
    ['banheiro-louca','Louças sanitárias','acabamento','subtipoAcabamento','louca-sanitaria'],
    ['banheiro-torneira','Torneiras para banheiro','acabamento','subtipoAcabamento','torneira-banheiro'],
    ['banheiro-chuveiro','Chuveiros','instalacao','subtipoInstalacao','chuveiro'],
    ['luz-conectada','Iluminação conectada','casa','subtipoCasa','iluminacao'],
    ['luz-decorativa','Iluminação decorativa','acabamento','subtipoAcabamento','iluminacao-decorativa'],
    ['rede-roteador','Rede doméstica','casa','subtipoCasa','rede'],
    ['entretenimento-tv','TVs','tv',null,null],
    ['entretenimento-projetor','Projetores','projetor',null,null],
    ['entretenimento-soundbar','Soundbars','soundbar',null,null]
  ].map(([id,nome,tipo,chave,subtipo])=>({id,nome,tipo,chave,subtipo}));
  function products(){return typeof PRODUTOS==='undefined'?[]:PRODUTOS}
  function forIntent(id){const x=INTENTS.find(i=>i.id===id);return x?products().filter(x.match):[]}
  function compareGroup(id){return COMPARE.find(x=>x.id===id)}
  function forCompare(id){const g=compareGroup(id);return g?products().filter(p=>p.tipoProduto===g.tipo&&(!g.chave||p[g.chave]===g.subtipo)&&(id!=='cozinha-lava-loucas'||p.porteEspaco==='compacto')):[]}
  function tags(p){
    const t=['CONFIRME AS MEDIDAS'];
    if(['notebook','monitor'].includes(p.tipoProduto)||(p.tipoProduto==='acessorio'&&['hub','carregador','powerbank'].includes(p.subtipoAcessorio)))t.push('FLEXÍVEL');
    if(p.tipoProduto==='cozinha')t.push('USO DE BANCADA');
    if(p.tipoProduto==='lavanderia')t.push(p.subtipoLavanderia==='compacta'?'PORTE COMPACTO':'MAIOR CAPACIDADE');
    if(p.tipoProduto==='cozinha'&&['lava-loucas','geladeira'].includes(p.subtipoCozinha))t.push('INSTALAÇÃO A CONFERIR');
    if(p.tipoProduto==='tv')t.push('SUPORTE DE PAREDE POSSÍVEL');
    if(p.tipoProduto==='projetor')t.push('PROJEÇÃO ADAPTÁVEL');
    if(p.tipoProduto==='casa'&&p.subtipoCasa==='robot')t.push('EXIGE PISO LIVRE');
    if(p.tipoProduto==='instalacao'||(p.tipoProduto==='acabamento'&&['cuba','louca-sanitaria','torneira-banheiro'].includes(p.subtipoAcabamento)))t.push('INSTALAÇÃO A CONFERIR');
    return t.slice(0,3);
  }
  function best(list,limit=6){return [...list].sort((a,b)=>(b.imagemTipo==='oficial')-(a.imagemTipo==='oficial')||String(a.nome).localeCompare(String(b.nome),'pt-BR')).slice(0,limit)}
  window.PNM_COMPACT_INTENTS=INTENTS;
  window.PNM_COMPACT_COMPARE=COMPARE;
  window.PNMCompactProducts=forIntent;
  window.PNMCompactCompareGroup=compareGroup;
  window.PNMCompactCompareProducts=forCompare;
  window.PNMCompactTags=tags;
  window.PNMCompactBest=best;
})();
