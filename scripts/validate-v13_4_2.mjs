import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {enrichDraft,extractMercadoUserProductId,titleFromUrl,unwrapMercadoVerificationUrl,validateDraft} from '../assets/catalog-core.mjs';

const root=path.resolve(import.meta.dirname,'..'),fail=[];
const base=spawnSync(process.execPath,[path.join(root,'scripts/validate-v13_4_1.mjs')],{cwd:root,encoding:'utf8'});
if(base.status!==0){process.stdout.write(base.stdout);process.stderr.write(base.stderr);process.exit(base.status||1)}

const recovered='https://www.mercadolivre.com.br/lavadora-de-louca-industrial-sm500s/up/MLBU3567752485';
const blocked=`https://www.mercadolivre.com.br/gz/account-verification?go=${encodeURIComponent(recovered)}`;
const decoded=unwrapMercadoVerificationUrl(blocked);
if(decoded!==recovered)fail.push(`Endereço escondido em go= não foi recuperado: ${decoded}`);
const userProductId=extractMercadoUserProductId(decoded);
if(userProductId!=='MLBU3567752485')fail.push(`Código MLBU não foi extraído: ${userProductId}`);
const inferredTitle=titleFromUrl(decoded);
const draft=enrichDraft({heading:'Sem categoria',linkAfiliado:'https://meli.la/2oew8cQ'},{metadata:{resolvedUrl:decoded,title:inferredTitle,userProductId,status:'url-recuperada'},products:[],brands:[]});
if(!/Lavadora De Louca Industrial Sm500s/i.test(draft.nome)||draft.linkOriginal!==recovered||draft.marca!=='Service Machine'||draft.tipoProduto!=='cozinha'||draft.subtipo!=='lava-loucas'||draft.mercadoUserProductId!==userProductId||draft.errors.length)fail.push(`Contingência do print ficou incompleta: ${JSON.stringify({nome:draft.nome,link:draft.linkOriginal,marca:draft.marca,tipo:draft.tipoProduto,subtipo:draft.subtipo,mlbu:draft.mercadoUserProductId,erros:draft.errors})}`);
const incomplete=validateDraft({...draft,linkAfiliado:'https://meli.la/'});
if(!incomplete.includes('link afiliado completo'))fail.push('Link meli.la sem token não foi recusado');

const server=fs.readFileSync(path.join(root,'tools/catalog-server.mjs'),'utf8'),manager=fs.readFileSync(path.join(root,'gerenciador.html'),'utf8'),admin=fs.readFileSync(path.join(root,'assets/catalog-admin.js'),'utf8');
if(!server.includes('verificationBlocked')||!server.includes('unwrapMercadoVerificationUrl'))fail.push('Contingência da verificação não está conectada ao servidor');
if(!server.includes("error.code==='EADDRINUSE'")||!server.includes('port+=1'))fail.push('Troca automática de porta ausente');
if(!/Central de Catálogo V13\.(?:4\.2|5|6)/.test(manager))fail.push('Interface não identifica a V13.4.2 ou posterior');
if(!admin.includes("${location.origin}/gerenciador.html"))fail.push('Atalho de captura não usa a porta atual');
for(const file of ['CHANGELOG-V13.4.2.md','VALIDACAO-V13.4.2.txt'])if(!fs.existsSync(path.join(root,file)))fail.push(`Arquivo V13.4.2 ausente: ${file}`);

console.log(`V13.4.2 • verificação go=, MLBU, contingência do slug, afiliado completo e porta automática • ${fail.length} falhas`);
if(fail.length){console.error(fail.join('\n'));process.exit(1)}
