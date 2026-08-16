/* Preço na Mira V12 — arquitetura de contexto Universo → Ambiente → Produto / Projeto */
(function(){
  const U=[
    {id:'casa',icon:'🏠',nome:'Minha Casa',status:'ativo',href:'universo-casa',cor:'verde',descricao:'Do projeto e da obra aos ambientes, equipamentos, acabamento e automação da casa.'},
    {id:'gamer',icon:'🎮',nome:'Gamer',status:'ativo',href:'ambiente-gamer',cor:'roxo',descricao:'PC por peças, notebooks, monitores e periféricos em uma experiência conectada.'},
    {id:'tecnologia',icon:'📱',nome:'Tecnologia',status:'ativo',href:'universo-tecnologia',cor:'azul',descricao:'Celulares, wearables, áudio, acessórios, notebooks, conectividade e ecossistemas pessoais.'},
    {id:'pets',icon:'🐾',nome:'Pets',status:'planejado',cor:'laranja',descricao:'Alimentação, passeio, higiene, conforto e tecnologia para cães e gatos.'},
    {id:'beleza',icon:'🧴',nome:'Beleza & Perfumaria',status:'planejado',cor:'rosa',descricao:'Perfumes e cuidados pessoais organizados por objetivo, ocasião e perfil.'},
    {id:'kids',icon:'🧸',nome:'Kids & Bebê',status:'planejado',cor:'amarelo',descricao:'Quarto, passeio, alimentação, segurança, presentes e desenvolvimento por idade.'},
    {id:'fitness',icon:'🏋️',nome:'Fitness & Bem-estar',status:'planejado',cor:'verde',descricao:'Treino, corrida, wearables, recuperação e academia em casa.'},
    {id:'auto',icon:'🚗',nome:'Auto & Moto',status:'planejado',cor:'vermelho',descricao:'Som, limpeza, acessórios, segurança, viagem e manutenção.'},
    {id:'ferramentas',icon:'🛠️',nome:'Ferramentas & Oficina',status:'planejado',cor:'cinza',descricao:'Manutenção doméstica, elétrica, marcenaria e oficina.'},
    {id:'viagem',icon:'🧳',nome:'Viagem & Lazer',status:'planejado',cor:'azul',descricao:'Camping, praia, estrada, energia portátil e tecnologia para levar.'}
  ];
  const A=[
    {id:'sala-cinema',universo:'casa',icon:'🛋️',nome:'Sala & Cinema',status:'ativo',href:'cinema-em-casa',descricao:'TV ou projetor, áudio e equipamentos que transformam a sala.'},
    {id:'casa-inteligente',universo:'casa',icon:'🏠',nome:'Casa Inteligente',status:'ativo',href:'ambiente-casa',descricao:'Assistentes, Wi-Fi, iluminação, energia, segurança, acesso e limpeza.'},
    {id:'home-office',universo:'casa',icon:'💻',nome:'Home Office / Gamer',status:'ativo',href:'ambiente-gamer',descricao:'Computador, monitor, periféricos e conectividade para trabalhar ou jogar.'},
    {id:'cozinha',universo:'casa',icon:'🍳',nome:'Cozinha',status:'ativo',href:'ambiente-cozinha',descricao:'Preparar, cozinhar, servir e montar uma cozinha coerente por função, cor e acabamento.'},
    {id:'pequenos-espacos',universo:'casa',icon:'📐',nome:'Pequenos Espaços',status:'ativo',href:'pequenos-espacos',descricao:'Soluções para studios, kitnets e apartamentos compactos, com atenção a uso, circulação e medidas.'},
    {id:'quarto',universo:'casa',icon:'🛏️',nome:'Quarto',status:'planejado',descricao:'Conforto, entretenimento, iluminação, móveis e tecnologia pessoal.'},
    {id:'lavanderia',universo:'casa',icon:'🧺',nome:'Lavanderia',status:'ativo',href:'lavanderia',descricao:'Lavagem e cuidado com roupas separados entre pouco espaço e maior capacidade.'},
    {id:'banheiro',universo:'casa',icon:'🚿',nome:'Banheiro',status:'ativo',href:'acabamentos?tipo=louca-sanitaria',descricao:'Louças, cubas, metais, duchas, iluminação e acessórios para o banheiro.'},
    {id:'area-externa',universo:'casa',icon:'🌿',nome:'Área externa',status:'planejado',descricao:'Som, segurança, iluminação, jardim, lazer e acabamento externo.'},
    {id:'obra-base',universo:'casa',icon:'🧱',nome:'Obra base',status:'ativo',href:'obra-base',descricao:'Impermeabilização, vedação, cobertura, ferramentas e proteção para o começo da obra.'},
    {id:'instalacoes',universo:'casa',icon:'⚡',nome:'Instalações',status:'ativo',href:'instalacoes',descricao:'Elétrica, iluminação, banho, bombas, pressurização e aquecimento organizados por função.'},
    {id:'acabamentos',universo:'casa',icon:'🎨',nome:'Acabamentos',status:'ativo',href:'acabamentos',descricao:'Rejuntes, tintas, massas, texturas, louças, cubas, metais, fechaduras e iluminação decorativa.'},
    {id:'mobile',universo:'tecnologia',icon:'📱',nome:'Ecossistema móvel',status:'ativo',href:'setup-ecossistema',descricao:'Celular, relógio, fone, energia e acessórios trabalhando como conjunto.'},
    {id:'audio-portatil',universo:'tecnologia',icon:'🎧',nome:'Áudio pessoal',status:'ativo',href:'fones-de-ouvido',descricao:'Fones e caixas para música, chamadas, treino e mobilidade.'},
    {id:'computacao',universo:'tecnologia',icon:'🖥️',nome:'Computação',status:'ativo',href:'notebooks',descricao:'Notebooks, monitores, memória e acessórios para diferentes usos.'},
    {id:'acessorios-tech',universo:'tecnologia',icon:'🔌',nome:'Acessórios Tech',status:'ativo',href:'acessorios-tech',descricao:'Power banks, carregadores GaN, hubs USB-C e upgrades de notebook.'},
    {id:'conectividade',universo:'tecnologia',icon:'🌐',nome:'Conectividade',status:'ativo',href:'internet',descricao:'Internet, Wi-Fi e infraestrutura para manter seus dispositivos conectados.'},
    {id:'pc-gamer',universo:'gamer',icon:'🧩',nome:'PC Gamer',status:'ativo',href:'montar-pc',descricao:'Escolha as peças em sequência e acompanhe compatibilidades importantes.'},
    {id:'setup-gamer',universo:'gamer',icon:'🎮',nome:'Setup Gamer',status:'ativo',href:'ambiente-gamer',descricao:'PC, monitor, teclado, mouse, áudio e acessórios no mesmo espaço.'}
  ];
  const J=[
    {id:'primeira-casa',icon:'🏡',nome:'Minha casa',status:'ativo',href:'minha-casa',descricao:'Transforme ideias em um projeto vivo e avance por ambientes e etapas.'},
    {id:'casa-studio',icon:'✏️',nome:'Meu projeto de casa',status:'ativo',href:'casa-studio',descricao:'Escolha ambiente, estilo, paleta, registre ideias e descubra combinações.'},
    {id:'espaco-compacto',icon:'📐',nome:'Meu espaço compacto',status:'ativo',href:'montar-espaco-compacto',descricao:'Defina perfil, prioridade e restrições para receber uma seleção de categorias adequadas ao pouco espaço.'},
    {id:'cozinha-pratica',icon:'🍳',nome:'Minha cozinha',status:'ativo',href:'montar-cozinha',descricao:'Monte os principais eletroportáteis e acompanhe coerência visual do conjunto.'},
    {id:'cafe',icon:'☕',nome:'Meu cantinho do café',status:'ativo',href:'montar-cozinha?modo=cafe',descricao:'Escolha o tipo de café, cafeteira e complementos para o seu espaço.'},
    {id:'pc-gamer',icon:'🎮',nome:'Meu PC gamer',status:'ativo',href:'montar-pc',descricao:'CPU, placa-mãe, RAM, GPU, fonte, gabinete e periféricos.'},
    {id:'cinema',icon:'🎬',nome:'Meu cinema em casa',status:'ativo',href:'cinema-em-casa',descricao:'Escolha TV ou projetor e complete com áudio.'},
    {id:'casa-smart',icon:'💡',nome:'Minha casa inteligente',status:'ativo',href:'montar-casa',descricao:'Monte automação, rede, segurança, acesso e limpeza conectada.'},
    {id:'mobile',icon:'📱',nome:'Meu ecossistema móvel',status:'ativo',href:'setup-ecossistema',descricao:'Celular, relógio, fone, carregamento e mobilidade em conjunto.'},
    {id:'home-office',icon:'💻',nome:'Meu home office',status:'preparando',href:'ambiente-gamer',descricao:'Notebook ou PC, monitor, hubs e periféricos orientados para produtividade.'},
    {id:'pet',icon:'🐶',nome:'Kit do meu pet',status:'planejado',descricao:'Um futuro projeto guiado do Universo Pets.'},
    {id:'bebe',icon:'👶',nome:'Quarto do bebê',status:'planejado',descricao:'Um futuro projeto guiado do Universo Kids & Bebê.'},
    {id:'viagem',icon:'🚗',nome:'Kit para viagem',status:'planejado',descricao:'Um futuro projeto guiado que cruza Tecnologia, Auto e Viagem.'}
  ];
  function uniq(a){return [...new Set(a.filter(Boolean))]}
  const coffee=['cafeteira-capsula','cafeteira-espresso','cafeteira-filtro'];
  function meta(p){
    const u=[],a=[],n=['comparar']; const t=p?.tipoProduto||'', hc=p?.subtipoCasa||'', g=p?.subtipoGamer||'', k=p?.subtipoCozinha||'', l=p?.subtipoLavanderia||'', ac=p?.subtipoAcessorio||'';
    if(['casa','cozinha','lavanderia','tv','projetor','soundbar','internet','notebook','monitor','gamer','acessorio','obra','instalacao','acabamento'].includes(t))u.push('casa');
    if(['gamer','monitor','notebook','fone','acessorio'].includes(t))u.push('gamer');
    if(['smartphone','smartwatch','fone','tablet','notebook','monitor','internet','tv','projetor','soundbar','caixa','gamer','acessorio'].includes(t))u.push('tecnologia');
    if(['smartwatch','fone','fitness'].includes(t))u.push('fitness'); if(t==='obra' && ['ferramenta','epi'].includes(p?.subtipoObra||''))u.push('ferramentas');
    if(t==='pet')u.push('pets'); if(['perfume','beleza'].includes(t))u.push('beleza'); if(['kids','bebe'].includes(t))u.push('kids'); if(['auto','moto'].includes(t))u.push('auto'); if(['ferramenta','ferramentas'].includes(t))u.push('ferramentas');
    if(['smartphone','fone','tablet','caixa','internet','viagem'].includes(t)||ac==='powerbank')u.push('viagem');
    if(t==='tablet')u.push('kids');
    if(['tv','projetor','soundbar'].includes(t)){a.push('sala-cinema');n.push('entretenimento')}
    if(t==='casa'){a.push('casa-inteligente');n.push('automacao');if(['assistente','iluminacao','robot'].includes(hc))a.push('sala-cinema');if(['camera','acesso'].includes(hc))n.push('seguranca');if(hc==='rede')n.push('conectividade');if(hc==='robot')n.push('limpeza')}
    if(t==='cozinha'){a.push('cozinha');n.push('casa','preparo'); if(coffee.includes(k))n.push('cafe'); if(['cooktop','fogao','forno','microondas','airfryer','panela-eletrica'].includes(k))n.push('cozinhar'); if(['mixer','liquidificador','batedeira'].includes(k))n.push('preparo'); if(['panelas','faqueiro'].includes(k))n.push('servir','compor'); if(['purificador'].includes(k))n.push('agua'); if(k==='geladeira')n.push('refrigeracao','capacidade'); if(k==='lava-loucas')n.push('limpeza','hidraulica','instalacao')}
    if(t==='lavanderia'){a.push('lavanderia');n.push('lavar','hidraulica','instalacao');if(l==='compacta')n.push('espaco-compacto');else n.push('alta-capacidade')}
    if(t==='acessorio'){a.push('acessorios-tech');n.push('acessorios'); if(ac==='ram-notebook'){a.push('computacao','home-office');n.push('upgrade')} else {a.push('mobile','home-office');n.push('mobilidade','energia')}} 
    if(t==='obra'){a.push('obra-base');n.push('obra','construcao');const so=p?.subtipoObra||'';if(['impermeabilizante','manta','aditivo'].includes(so))n.push('impermeabilizacao');if(['espuma','selante'].includes(so))n.push('vedacao');if(so==='cobertura')n.push('cobertura');if(so==='ferramenta')n.push('ferramentas');if(so==='epi')n.push('seguranca')}
    if(t==='instalacao'){a.push('instalacoes');n.push('instalacao');const si=p?.subtipoInstalacao||'';if(['fio-cabo','disjuntor','quadro','dr','iluminacao','chuveiro','torneira-eletrica'].includes(si))n.push('eletrica');if(si==='fio-cabo')n.push('infraestrutura');if(['disjuntor','dr'].includes(si))n.push('protecao');if(si==='quadro')n.push('distribuicao');if(si==='iluminacao')n.push('iluminacao');if(['chuveiro','torneira-eletrica','bomba-agua','pressurizador','aquecedor-agua'].includes(si)){n.push('hidraulica');a.push('banheiro')}if(si==='aquecedor-agua')n.push('gas')}
    if(t==='acabamento'){a.push('acabamentos');n.push('acabamento','casa');const sf=p?.subtipoAcabamento||'';if(['louca-sanitaria','cuba','torneira-banheiro','acessorio-banheiro'].includes(sf))a.push('banheiro');if(sf==='torneira-cozinha')a.push('cozinha');if(sf==='iluminacao-decorativa'){a.push('sala-cinema');n.push('iluminacao')}if(['tinta','massa-selador','textura','rejunte'].includes(sf))n.push('superficie')}
    if(t==='internet'){a.push('casa-inteligente','conectividade','home-office');n.push('conectividade')}
    if(['notebook','monitor'].includes(t)){a.push('home-office','computacao');n.push('produtividade')}
    if(t==='gamer'){a.push('pc-gamer','setup-gamer');n.push('jogos');if(['keyboard','mouse'].includes(g))a.push('home-office')}
    if(['smartphone','smartwatch','fone','tablet'].includes(t))a.push('mobile'); if(['fone','caixa'].includes(t))a.push('audio-portatil'); if(t==='smartwatch')n.push('bem-estar'); if(['smartphone','tablet','fone','caixa'].includes(t))n.push('mobilidade');
    const compactKitchen=['airfryer','microondas','cooktop','panela-eletrica','mixer','liquidificador','grill','purificador','cafeteira-capsula','cafeteira-espresso','cafeteira-filtro'];
    const compactFinish=['louca-sanitaria','cuba','torneira-banheiro','torneira-cozinha','acessorio-banheiro','fechadura-puxador','iluminacao-decorativa'];
    const compactInstall=['iluminacao','chuveiro','torneira-eletrica'];
    const compact=t==='casa'||t==='internet'||['notebook','monitor','projetor','soundbar','tv'].includes(t)||(t==='acessorio'&&ac!=='ram-notebook')||(t==='cozinha'&&(compactKitchen.includes(k)||p?.porteEspaco==='compacto'))||(t==='lavanderia'&&l==='compacta')||(t==='acabamento'&&compactFinish.includes(p?.subtipoAcabamento||''))||(t==='instalacao'&&compactInstall.includes(p?.subtipoInstalacao||''));
    if(compact){a.push('pequenos-espacos');n.push('espaco-compacto','medidas-a-confirmar')}
    return {universos:uniq(u),ambientes:uniq(a),necessidades:uniq(n)};
  }
  window.PNM_UNIVERSOS=U;window.PNM_AMBIENTES=A;window.PNM_JORNADAS=J;window.PNMExperienceMeta=meta;
  window.PNMUniverseById=id=>U.find(x=>x.id===id);window.PNMEnvironmentById=id=>A.find(x=>x.id===id);
  window.PNMProductsForUniverse=id=>(typeof PRODUTOS==='undefined'?[]:PRODUTOS.filter(p=>meta(p).universos.includes(id)));
  window.PNMProductsForEnvironment=id=>(typeof PRODUTOS==='undefined'?[]:PRODUTOS.filter(p=>meta(p).ambientes.includes(id)));
})();
