import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {extractMercadoItemId,canonicalMercadoItemUrl,mercadoItemMetadata,enrichDraft} from '../assets/catalog-core.mjs';

const root=path.resolve(import.meta.dirname,'..'),fail=[];
const base=spawnSync(process.execPath,[path.join(root,'scripts/validate-v13_4.mjs')],{cwd:root,encoding:'utf8'});
if(base.status!==0){process.stdout.write(base.stdout);process.stderr.write(base.stderr);process.exit(base.status||1)}

const social='https://www.mercadolivre.com.br/social/edsonreiterconcatto?forceInApp=true',image='https://http2.mlstatic.com/D_NQ_NP_822640-MLB98784803827_112025-O.webp',itemId=extractMercadoItemId(social,image);
if(itemId!=='MLB98784803827')fail.push(`Código MLB do caso real não foi extraído: ${itemId}`);
if(canonicalMercadoItemUrl(itemId)!=='https://produto.mercadolivre.com.br/MLB-98784803827-_JM')fail.push('URL canônica não foi reconstruída');

const metadata=mercadoItemMetadata({id:itemId,title:'Lavadora De Louça Industrial Sm500s Inox 220v',permalink:'https://produto.mercadolivre.com.br/MLB-98784803827-_JM',pictures:[{secure_url:image}],attributes:[{id:'BRAND',name:'Marca',value_name:'Service Machine'},{id:'MODEL',name:'Modelo',value_name:'SM500S'}]},{name:'Lava-louças industriais',path_from_root:[{name:'Casa'},{name:'Eletrodomésticos'},{name:'Lava-louças industriais'}]},{resolvedUrl:social,image,itemId}),draft=enrichDraft({heading:'Sem categoria',linkAfiliado:'https://meli.la/2oew8cQ'},{metadata,products:[],brands:[]});
if(draft.linkOriginal!=='https://produto.mercadolivre.com.br/MLB-98784803827-_JM'||draft.marca!=='Service Machine'||draft.tipoProduto!=='cozinha'||draft.subtipo!=='lava-loucas'||draft.errors.length)fail.push(`Caso do print ainda incompleto: ${JSON.stringify({link:draft.linkOriginal,marca:draft.marca,tipo:draft.tipoProduto,subtipo:draft.subtipo,erros:draft.errors})}`);
const fallbackDraft=enrichDraft({heading:'Sem categoria',linkAfiliado:'https://meli.la/2oew8cQ'},{metadata:{resolvedUrl:canonicalMercadoItemUrl(itemId),title:'Lavadora De Louça Industrial Sm500s Inox 220v',image,itemId,status:'capturado'},products:[],brands:[]});if(fallbackDraft.marca!=='Service Machine'||fallbackDraft.tipoProduto!=='cozinha'||fallbackDraft.subtipo!=='lava-loucas'||fallbackDraft.errors.length)fail.push('Fallback sem API não completa o caso do print');

const server=fs.readFileSync(path.join(root,'tools/catalog-server.mjs'),'utf8'),manager=fs.readFileSync(path.join(root,'gerenciador.html'),'utf8');
if(!server.includes('api.mercadolibre.com/items/')||!server.includes('api.mercadolibre.com/categories/'))fail.push('Consulta pública de item/categoria ausente');
if(!server.includes('canonicalMercadoItemUrl'))fail.push('Fallback de URL canônica ausente');
if(!/Central de Catálogo V13\.(?:4\.[12]|5|6)/.test(manager))fail.push('Interface não identifica a correção V13.4.1 ou posterior');
for(const file of ['CHANGELOG-V13.4.1.md','VALIDACAO-V13.4.1.txt'])if(!fs.existsSync(path.join(root,file)))fail.push(`Arquivo da correção ausente: ${file}`);

console.log(`V13.4.1 • link MLB, URL canônica, marca Service Machine e Lava-louças • ${fail.length} falhas`);
if(fail.length){console.error(fail.join('\n'));process.exit(1)}
