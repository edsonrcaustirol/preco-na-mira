import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
function replace(file, before, after) {
  const path = resolve(ROOT, file);
  const source = readFileSync(path, 'utf8');
  if (!source.includes(before)) {
    if (source.includes(after)) return;
    throw new Error(`Trecho não encontrado em ${file}: ${before.slice(0, 80)}`);
  }
  writeFileSync(path, source.replace(before, after));
}

replace('cozinha.html',
  "const S={airfryer:['🍟','Air fryers'], 'cafeteira-capsula'",
  "const S={geladeira:['❄️','Geladeiras'],'lava-loucas':['🍽️','Lava-louças'],airfryer:['🍟','Air fryers'], 'cafeteira-capsula'");
replace('cozinha.html',
  "if(!S[tipo])tipo='airfryer'",
  "if(!S[tipo])tipo='geladeira'");

replace('ambiente-cozinha.html',
  "const S={airfryer:['🍟','Air fryers'],'cafeteira-capsula'",
  "const S={geladeira:['❄️','Geladeiras'],'lava-loucas':['🍽️','Lava-louças'],airfryer:['🍟','Air fryers'],'cafeteira-capsula'");
replace('ambiente-cozinha.html',
  '101 produtos conectam a Cozinha: do preparo rápido ao café, cocção e água.',
  '<span id="kitchenCount">—</span> produtos conectam a Cozinha: refrigeração, lava-louças, preparo, café, cocção e água.');
replace('ambiente-cozinha.html',
  'Dezesseis réguas de comparação para não misturar produtos que resolvem problemas diferentes.',
  'Dezoito réguas de comparação para não misturar produtos que resolvem problemas diferentes.');
replace('ambiente-cozinha.html',
  "document.getElementById('cats').innerHTML=",
  "document.getElementById('kitchenCount').textContent=PRODUTOS.filter(p=>p.tipoProduto==='cozinha').length;document.getElementById('cats').innerHTML=");

replace('comparativo-cozinha.html',
  "const S={airfryer:'Air fryers','cafeteira-capsula'",
  "const S={geladeira:'Geladeiras','lava-loucas':'Lava-louças',airfryer:'Air fryers','cafeteira-capsula'");
replace('comparativo-cozinha.html',
  "const CR={airfryer:['Capacidade'",
  "const CR={geladeira:['Capacidade','Tipo','Tecnologia','Voltagem','Perfil de espaço'],'lava-loucas':['Capacidade','Modelo','Tipo','Voltagem','Instalação','Perfil de espaço'],airfryer:['Capacidade'");
replace('comparativo-cozinha.html',
  "if(!S[tipo])tipo='airfryer'",
  "if(!S[tipo])tipo='geladeira'");

replace('montar-cozinha.html',
  "const ALL=[['airfryer','🍟','Air fryer']",
  "const ALL=[['geladeira','❄️','Geladeira'],['lava-loucas','🍽️','Lava-louças'],['airfryer','🍟','Air fryer']");

replace('minha-casa.html',
  '🏡 MINHA CASA • V13.3',
  '🏡 MINHA CASA • V13.6');
replace('minha-casa.html',
  "{ic:'🍳',n:'Cozinha',k:'pnmKitchenBuilderV12',h:'montar-cozinha.html',t:12,d:'Preparo, cocção, mesa, café e água.'},{ic:'📐'",
  "{ic:'🍳',n:'Cozinha',k:'pnmKitchenBuilderV12',h:'montar-cozinha.html',t:14,d:'Refrigeração, lava-louças, preparo, cocção, café e água.'},{ic:'🧺',n:'Lavanderia',k:'pnmLaundryV13_6',h:'lavanderia.html',t:1,d:'Pouco espaço ou maior capacidade, sem misturar as réguas.'},{ic:'📐'");

replace('busca.html',
  "internet:'Internet',cozinha:'Cozinha',acessorio",
  "internet:'Internet',cozinha:'Cozinha',lavanderia:'Lavanderia',acessorio");

console.log('Páginas da Cozinha conectadas às novas categorias da V13.6.');
