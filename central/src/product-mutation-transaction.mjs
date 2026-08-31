export const CENTRAL_PRODUCT_MUTATION_CONTRACT='pnm.central-product-mutation/v1';
const WORKFLOW='o8-product-mutation.yml';
const text=v=>String(v??'').trim();
function repoParts(v){const [owner,repo,...rest]=text(v).split('/');if(!owner||!repo||rest.length)throw new Error('invalid-repository');return{owner,repo}}
function headers(token,write=false){return{accept:'application/vnd.github+json','user-agent':'preco-na-mira-central','x-github-api-version':'2022-11-28',...(write?{'content-type':'application/json; charset=utf-8',authorization:`Bearer ${token}`}:{})}}
function b64(v){const bytes=new TextEncoder().encode(v);let s='';for(let i=0;i<bytes.length;i+=0x4000)s+=String.fromCharCode(...bytes.subarray(i,i+0x4000));return btoa(s)}
function txId(){return `pm-${crypto.randomUUID().replaceAll('-','').slice(0,24)}`}
export function productMutationBranch(id){if(!/^pm-[a-f0-9]{24}$/.test(text(id)))throw new Error('invalid-transaction-id');return `central/product-mutation-${id}`}
function validProductId(id){return /^[a-z0-9][a-z0-9-]*$/.test(text(id))}
function sanitizeEdit(input,current){const allowed=['nome','marca','categoria','imagem','imagemAlt','linkAfiliado','loja','resumo','selo','oferta','destaque'];const next={...current};for(const k of allowed)if(input[k]!==undefined)next[k]=input[k];next.id=current.id;for(const k of ['nome','marca','categoria','imagem','imagemAlt','linkAfiliado','loja','resumo'])if(!text(next[k]))throw new Error(`missing-${k}`);if(!/^https:\/\//i.test(text(next.linkAfiliado)))throw new Error('invalid-affiliate-link');return Object.fromEntries(Object.entries(next).filter(([,v])=>v!==undefined))}
export async function dispatchProductMutation({env={},products=[],productId,action,input={},confirmId='',fetchImpl=globalThis.fetch}={}){
  const id=text(productId);if(!validProductId(id))return{ok:false,code:'INVALID_PRODUCT_ID',state:'PRECISA DE ATENÇÃO'};
  const current=(Array.isArray(products)?products:[]).find(p=>text(p?.id)===id);if(!current)return{ok:false,code:'PRODUCT_NOT_FOUND',state:'PRECISA DE ATENÇÃO'};
  if(!['edit','delete'].includes(action))return{ok:false,code:'INVALID_ACTION',state:'PRECISA DE ATENÇÃO'};
  let payload={action,productId:id};
  try{if(action==='edit')payload.product=sanitizeEdit(input,current);else{if(text(confirmId)!==id)throw new Error('delete-confirmation-required');payload.confirmId=id}}catch(e){return{ok:false,code:String(e?.message||'INVALID_PAYLOAD').toUpperCase().replaceAll('-','_'),state:'PRECISA DE ATENÇÃO'}}
  for(const key of ['PNM_GITHUB_REPOSITORY','PNM_GITHUB_BASE_BRANCH','PNM_GITHUB_TOKEN'])if(!text(env[key]))return{ok:false,code:'PUBLICATION_GATE_CLOSED',state:'PRECISA DE ATENÇÃO'};
  const transactionId=txId(),branch=productMutationBranch(transactionId),{owner,repo}=repoParts(env.PNM_GITHUB_REPOSITORY);
  const url=`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${WORKFLOW}/dispatches`;
  let response;try{response=await fetchImpl(url,{method:'POST',headers:headers(env.PNM_GITHUB_TOKEN,true),body:JSON.stringify({ref:env.PNM_GITHUB_BASE_BRANCH,inputs:{transaction_id:transactionId,action,product_id:id,payload_b64:b64(JSON.stringify(payload))}})})}catch{return{ok:false,code:'GITHUB_BACKEND_UNAVAILABLE',state:'PRECISA DE ATENÇÃO'}}
  if(response?.status!==204)return{ok:false,code:'GITHUB_DISPATCH_FAILED',githubStatus:Number(response?.status)||null,state:'PRECISA DE ATENÇÃO'};
  return{ok:true,contract:CENTRAL_PRODUCT_MUTATION_CONTRACT,state:'PUBLICANDO',transactionId,branch,statusPath:`/api/product-transactions/${transactionId}`};
}
export async function getProductMutationStatus({env={},transactionId,fetchImpl=globalThis.fetch}={}){
  let branch;try{branch=productMutationBranch(transactionId)}catch{return{ok:false,state:'PRECISA DE ATENÇÃO',code:'INVALID_TRANSACTION_ID'}}
  const {owner,repo}=repoParts(env.PNM_GITHUB_REPOSITORY),base=`https://api.github.com/repos/${owner}/${repo}`,h=headers('',false),head=`${owner}:${branch}`;
  let r;try{r=await fetchImpl(`${base}/pulls?state=all&head=${encodeURIComponent(head)}&per_page=1`,{headers:h})}catch{return{ok:true,state:'PUBLICANDO',transactionId,branch}}
  if(!r?.ok)return{ok:true,state:'PUBLICANDO',transactionId,branch};const pulls=await r.json(),pr=Array.isArray(pulls)?pulls[0]:null;if(!pr)return{ok:true,state:'PUBLICANDO',transactionId,branch};
  if(pr.merged_at)return{ok:true,state:'PUBLICADO',transactionId,branch,prNumber:pr.number,prUrl:pr.html_url};if(pr.state==='closed')return{ok:false,state:'PRECISA DE ATENÇÃO',code:'PR_CLOSED_WITHOUT_MERGE',prNumber:pr.number,prUrl:pr.html_url};
  const sha=text(pr?.head?.sha);if(!sha)return{ok:true,state:'PUBLICANDO',prNumber:pr.number,prUrl:pr.html_url};
  try{const c=await fetchImpl(`${base}/commits/${sha}/check-runs?per_page=100`,{headers:h});if(c?.ok){const data=await c.json(),runs=Array.isArray(data?.check_runs)?data.check_runs:[],failed=runs.some(x=>x.status==='completed'&&!['success','neutral','skipped'].includes(x.conclusion));if(failed)return{ok:false,state:'PRECISA DE ATENÇÃO',code:'CI_FAILED',prNumber:pr.number,prUrl:pr.html_url};}}catch{}
  return{ok:true,state:'PUBLICANDO',transactionId,branch,prNumber:pr.number,prUrl:pr.html_url};
}
