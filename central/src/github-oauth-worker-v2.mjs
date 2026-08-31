import { handleGithubOauthCentralRequest } from './github-oauth-worker.mjs';
import { githubOauthUnauthorizedResponse, validateGithubOauthConfig, verifyGithubOauthSession } from './github-oauth-auth.mjs';
import { dispatchProductMutation, getProductMutationStatus } from './product-mutation-transaction.mjs';
const MAX=32768;
function sec(extra={}){return{'cache-control':'no-store','content-security-policy':"default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",'referrer-policy':'no-referrer','x-content-type-options':'nosniff',...extra}}
function json(v,s=200){return new Response(JSON.stringify(v),{status:s,headers:sec({'content-type':'application/json; charset=utf-8'})})}
function host(env){return String(env?.PNM_CENTRAL_EXPECTED_HOST||'').trim()}
function originOk(req,env){return String(req.headers.get('origin')||'').trim()===`https://${host(env)}`}
async function auth(req,env,options){const cfg=validateGithubOauthConfig(env);if(!cfg.ok)return{response:json({ok:false,code:'CENTRAL_CONFIG_INCOMPLETE'},503)};if(new URL(req.url).hostname!==host(env))return{response:json({ok:false,code:'CENTRAL_HOST_REJECTED'},421)};const a=await verifyGithubOauthSession(req,env,options);return a.ok?{identity:a.identity}:{response:githubOauthUnauthorizedResponse(req)}}
async function body(req){const raw=await req.text();if(new TextEncoder().encode(raw).byteLength>MAX)throw Object.assign(new Error('PAYLOAD_TOO_LARGE'),{status:413});try{return JSON.parse(raw)}catch{throw Object.assign(new Error('INVALID_JSON'),{status:400})}}
export async function handleGithubOauthCentralRequestV2(request,env,options={}){
 const url=new URL(request.url),mutation=url.pathname.match(/^\/api\/products\/([a-z0-9][a-z0-9-]*)\/transactions$/),status=url.pathname.match(/^\/api\/product-transactions\/(pm-[a-f0-9]{24})$/);
 if(mutation||status){const a=await auth(request,env,options);if(a.response)return a.response;if(mutation){if(request.method!=='POST')return new Response(null,{status:405,headers:sec({allow:'POST'})});if(!originOk(request,env))return json({ok:false,code:'ORIGIN_REJECTED'},403);if(!String(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))return json({ok:false,code:'JSON_REQUIRED'},415);let input;try{input=await body(request)}catch(e){return json({ok:false,code:e.message},e.status||400)};const {CENTRAL_PRODUCTS_PROJECTION}=await import('./generated/products.mjs');const result=await dispatchProductMutation({env,products:CENTRAL_PRODUCTS_PROJECTION.products||[],productId:decodeURIComponent(mutation[1]),action:String(input?.action||''),input:input?.product||{},confirmId:input?.confirmId||'',fetchImpl:options.githubFetchImpl||globalThis.fetch});return json(result,result.ok?202:result.code==='PRODUCT_NOT_FOUND'?404:422)}if(request.method!=='GET')return new Response(null,{status:405,headers:sec({allow:'GET'})});const result=await getProductMutationStatus({env,transactionId:status[1],fetchImpl:options.githubFetchImpl||globalThis.fetch});return json(result,result.ok?200:422)}
 const response=await handleGithubOauthCentralRequest(request,env,options);
 if(url.pathname==='/produtos'&&request.method==='GET'&&response.ok){const text=await response.text(),h=new Headers(response.headers),csp=String(h.get('content-security-policy')||'').replace("connect-src 'none'","connect-src 'self'");h.set('content-security-policy',csp);return new Response(text,{status:response.status,headers:h})}
 return response;
}
export default{async fetch(request,env){return handleGithubOauthCentralRequestV2(request,env)}};
