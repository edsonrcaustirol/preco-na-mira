import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';

const root=path.resolve(import.meta.dirname,'..'),fail=[];
const base=spawnSync(process.execPath,[path.join(root,'scripts/validate-v13_1.mjs')],{cwd:root,encoding:'utf8'});
if(base.status!==0){process.stdout.write(base.stdout);process.stderr.write(base.stderr);process.exit(base.status||1)}

const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const sandbox={};vm.createContext(sandbox);vm.runInContext(`${read('data/produtos.js')}\nthis.P=PRODUTOS`,sandbox);
const products=sandbox.P,manifest=JSON.parse(read('data/importacao-v13_6-links.json'));
const ids=new Set(products.map(p=>p.id));

if(products.length!==556)fail.push(`Catálogo deveria ter 556 produtos, encontrou ${products.length}`);
if(manifest.totalRecebido!==24||manifest.duplicadosIgnorados!==1||manifest.adicionados.length!==23)fail.push('Resumo da importação deveria registrar 24 recebidos, 1 duplicado e 23 adicionados');

for(const item of manifest.adicionados){
  const p=products.find(x=>x.id===item.id);
  if(!p){fail.push(`Produto importado ausente: ${item.id}`);continue}
  if(p.linkAfiliado!==item.linkAfiliado)fail.push(`${item.id}: link afiliado divergente`);
  if(!/^assets\/produtos\/.+\.(?:webp|png|jpe?g)$/i.test(p.imagem||''))fail.push(`${item.id}: imagem não é local`);
  else if(!fs.existsSync(path.join(root,p.imagem))||fs.statSync(path.join(root,p.imagem)).size<2_000)fail.push(`${item.id}: arquivo de imagem ausente ou inválido`);
  if(!['oficial','anuncio'].includes(p.imagemTipo))fail.push(`${item.id}: origem visual não informada`);
}

const affiliates=manifest.adicionados.map(x=>x.linkAfiliado);
if(new Set(affiliates).size!==affiliates.length)fail.push('Links afiliados repetidos dentro do novo lote');
if(products.filter(p=>p.linkAfiliado==='https://meli.la/2YEJxCq').length!==1)fail.push('Duplicata da Midea 401 L permaneceu no catálogo');

const laundry=products.filter(p=>p.tipoProduto==='lavanderia');
if(laundry.length!==7)fail.push(`Lavanderia deveria ter 7 produtos, encontrou ${laundry.length}`);
if(laundry.filter(p=>p.subtipoLavanderia==='compacta').length!==2)fail.push('Lavanderia compacta deveria ter 2 produtos');
if(laundry.filter(p=>p.subtipoLavanderia==='alta-capacidade').length!==5)fail.push('Lavanderia de alta capacidade deveria ter 5 produtos');
if(products.filter(p=>p.tipoProduto==='cozinha'&&p.subtipoCozinha==='geladeira').length!==9)fail.push('Cozinha deveria ter 9 geladeiras importadas');
if(products.filter(p=>p.tipoProduto==='cozinha'&&p.subtipoCozinha==='lava-loucas').length!==6)fail.push('Cozinha deveria ter 6 lava-louças importadas');
if(!ids.has('kit-2-cameras-lampada-yoosee-casenn'))fail.push('Kit de câmeras não foi integrado ao ambiente Casa');

const catalogCore=read('assets/catalog-core.mjs'),css=read('assets/site.css'),workflow=read('.github/workflows/publicar-site.yml');
for(const marker of ["lavanderia:{label:'Lavanderia'","geladeira:{label:'Geladeiras'","'lava-loucas':{label:'Lava-louças'"])if(!catalogCore.includes(marker))fail.push(`Taxonomia V13.6 ausente: ${marker}`);
for(const marker of ['V13.6 — IMERSÃO VISUAL','.gamer-hero-v136','.house-hero-v136','.laundry-hero'])if(!css.includes(marker))fail.push(`Camada visual V13.6 ausente: ${marker}`);
for(const [file,markers] of Object.entries({
  'ambiente-gamer.html':['CATÁLOGO V13.6','gamer-hero-v136'],
  'ambiente-casa.html':['EXPERIÊNCIA V13.6','house-hero-v136'],
  'lavanderia.html':['MINHA CASA • LAVANDERIA','alta-capacidade'],
  'cozinha.html':['Geladeiras','Lava-louças']
})){
  const html=read(file);for(const marker of markers)if(!html.includes(marker))fail.push(`${file}: marcador ausente — ${marker}`);
}
for(const marker of ['cp data/experiencias.js','produtos.part-','rsync -a assets/'])if(!workflow.includes(marker))fail.push(`Workflow V13.6 incompleto: ${marker}`);
const pkg=JSON.parse(read('package.json'));
if(pkg.version!=='13.6.0'||pkg.scripts?.validate!=='node scripts/validate-v13_6.mjs')fail.push('package.json não aponta para a V13.6');
const server=read('tools/catalog-server.mjs');
if(!server.includes("version:'13.6.0'")||!server.includes('validate-v13_6.mjs')||!server.includes('preco_na_mira_v13_6-atualizado.zip'))fail.push('Central local não foi promovida integralmente para V13.6');

console.log(`V13.6 • ${products.length} produtos • 23 importados • ${laundry.length} em lavanderia • ${fail.length} falhas`);
if(fail.length){console.error(fail.join('\n'));process.exit(1)}
