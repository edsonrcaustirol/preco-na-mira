#!/usr/bin/env node
import assert from 'node:assert/strict';
import { dispatchProductMutation, getProductMutationStatus, productMutationBranch } from '../central/src/product-mutation-transaction.mjs';
import { renderOperationalProductsPage } from '../central/src/products-operational-page.mjs';

const product={id:'fixture-produto',nome:'Produto Fixture',marca:'Fixture',categoria:'Tecnologia',imagem:'https://example.com/p.webp',imagemAlt:'Produto Fixture',linkAfiliado:'https://meli.la/fixture',loja:'Mercado Livre',resumo:'Resumo factual.',oferta:false,destaque:false};
const env={PNM_GITHUB_REPOSITORY:'edsonrcaustirol/preco-na-mira',PNM_GITHUB_BASE_BRANCH:'main',PNM_GITHUB_TOKEN:'fixture'};

const noConfirm=await dispatchProductMutation({env,products:[product],productId:product.id,action:'delete',confirmId:'errado',fetchImpl:async()=>{throw new Error('não deve chamar rede')}});
assert.equal(noConfirm.ok,false);
assert.equal(noConfirm.code,'DELETE_CONFIRMATION_REQUIRED');

let dispatchSeen=false;
const edit=await dispatchProductMutation({env,products:[product],productId:product.id,action:'edit',input:{resumo:'Resumo factual atualizado.'},fetchImpl:async(url,init)=>{dispatchSeen=true;assert.match(String(url),/actions\/workflows\/o8-product-mutation\.yml\/dispatches$/);assert.equal(init.method,'POST');const body=JSON.parse(init.body);assert.equal(body.ref,'main');assert.equal(body.inputs.action,'edit');assert.equal(body.inputs.product_id,product.id);return new Response(null,{status:204})}});
assert.equal(dispatchSeen,true);
assert.equal(edit.ok,true);
assert.equal(edit.state,'PUBLICANDO');
assert.match(edit.transactionId,/^pm-[a-f0-9]{24}$/);
assert.equal(edit.branch,productMutationBranch(edit.transactionId));
assert.equal(edit.statusPath,`/api/product-transactions/${edit.transactionId}`);

const merged=await getProductMutationStatus({env,transactionId:edit.transactionId,fetchImpl:async url=>{assert.match(String(url),/\/pulls\?/);return new Response(JSON.stringify([{number:321,state:'closed',merged_at:'2026-08-31T00:00:00Z',html_url:'https://github.com/edsonrcaustirol/preco-na-mira/pull/321',head:{sha:'a'.repeat(40)}}]),{status:200,headers:{'content-type':'application/json'}})}});
assert.equal(merged.ok,true);
assert.equal(merged.state,'PUBLICADO');

const projection={products:[product]};
const html=renderOperationalProductsPage(projection,{historyStatus:'unbound',byProduct:{}},'fixtureNonce');
for(const expected of ['Ver detalhes','SALVAR ALTERAÇÕES','EXCLUIR PRODUTO','delete-confirm','/api/products/','Digite exatamente o ID do produto para confirmar','Resultado atual compatível com o link atual']) assert.match(html,new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assert.match(html,/poll\(p\.statusPath\)/);
assert.match(html,/script nonce="fixtureNonce"/);
assert.match(html,/overflow-x:hidden/);
assert.doesNotMatch(html,/PNM_GITHUB_TOKEN|Bearer /);

console.log(JSON.stringify({o8ProductManagement:'PASS',editGoverned:true,deleteExactConfirmation:true,statusPolling:true,directMainPush:false,frontendSecrets:0},null,2));
