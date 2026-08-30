import { handleCentralRequest } from './worker.mjs';
import { enrichMercadoLivreProduct } from './mercado-livre-enrichment.mjs';
import {
  GITHUB_OAUTH_PATHS,
  beginGithubOauth,
  completeGithubOauth,
  githubOauthUnauthorizedResponse,
  logoutGithubOauth,
  validateGithubOauthConfig,
  verifyGithubOauthSession,
} from './github-oauth-auth.mjs';

const O5_FIRST_PUBLICATION_PATH = '/__pnm/o5-first-publication';
const O5_FIRST_PRODUCT_ID = 'elgin-futura-plus-jx-2052';
const O5_FIRST_PRODUCT = Object.freeze({
  linkAfiliado: 'https://www.mercadolivre.com.br/maquina-de-costura-elgin-futura-plus-jx-2052-portatil-12-pontos-domestica-acabamento-profissional/p/MLB41008824?matt_event_ts=1788056922631&matt_d2id=f60b0cb5-26ad-4312-9bf1-1e84218d3bee&matt_tracing_id=cfb23e33-453d-45ab-b257-d38f0a9d1b74&pdp_filters=item_id%3AMLB6136925732',
  id: O5_FIRST_PRODUCT_ID,
  nome: 'Elgin Futura Plus JX-2052',
  marca: 'Elgin',
  categoria: 'Máquina de costura',
  imagem: 'https://http2.mlstatic.com/D_Q_NP_2X_746362-MLA112696405576_062026-R.webp',
  imagemAlt: 'Máquina de costura Elgin Futura Plus JX-2052 branca com detalhes azuis',
  resumo: 'Máquina de costura doméstica portátil com 12 pontos, braço livre, passa-linha automático, iluminação integrada e potência de 71 W.',
  selo: '12 pontos',
  oferta: false,
  destaque: false,
});
const NEW_PRODUCT_ENRICH_PATH = '/api/new-product/enrich';
const NEW_PRODUCT_CLIENT_PATH = '/__pnm/new-product-client.js';
const MAX_ENRICH_BODY_BYTES = 8192;

function securityHeaders(extra = {}) {
  return {
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    ...extra,
  };
}

function json(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: securityHeaders({ 'content-type': 'application/json; charset=utf-8' }),
  });
}

function expectedHost(env = {}) {
  return String(env?.PNM_CENTRAL_EXPECTED_HOST || '').trim();
}

function originAllowed(request, env) {
  return String(request.headers.get('origin') || '').trim() === `https://${expectedHost(env)}`;
}

function repairNewProductClientSource(source) {
  return String(source || '').replace(
    "if(payload.prUrl&&/^https://github.com//.test(payload.prUrl))",
    "if(payload.prUrl&&String(payload.prUrl).startsWith('https://github.com/'))",
  );
}

function linkAutofillClient() {
  return `\n;(function(){'use strict';
if(location.pathname!=='/novo-produto')return;
const form=document.getElementById('new-product-form');if(!form)return;
const link=form.elements.namedItem('linkAfiliado'),status=document.getElementById('analysis-status'),publish=document.getElementById('publish-product'),advance=document.getElementById('advance-state');if(!link||!status)return;
const params=new URLSearchParams(location.search),queryLink=params.get('link'),autoPrepare=params.get('autoprepare')==='1';
const categories=[...document.querySelectorAll('#category-list option')].map(x=>x.value).filter(Boolean);
const norm=v=>String(v||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const slug=v=>norm(v).replace(/\\s+/g,'-').slice(0,96).replace(/^-+|-+$/g,'');
function chooseCategory(name,hint){const direct=categories.find(c=>norm(c)===norm(hint));if(direct)return direct;const hay=norm(name+' '+hint);if(/costur/.test(hay))return hint||'Máquina de costura';const aliases=[[/air fryer|fritadeira|cafeteira|liquidificador|micro ondas|forno|cooktop|geladeira/,'Cozinha'],[/furadeira|parafusadeira|serra|martelete|esmerilhadeira|ferrament/,'Ferramentas'],[/celular|smartphone|iphone|galaxy/,'Celulares'],[/notebook|monitor|teclado|mouse|placa de video|processador|ssd|memoria/,'Tecnologia']];for(const [re,target] of aliases){if(re.test(hay)){const hit=categories.find(c=>norm(c)===norm(target));if(hit)return hit;}}let best='',score=0;for(const c of categories){const words=norm(c).split(' ').filter(w=>w.length>2);const s=words.filter(w=>hay.includes(w)).length;if(s>score){score=s;best=c;}}return best||hint||'';}
function put(name,value){const el=form.elements.namedItem(name);if(!el||!value)return;el.value=value;el.dataset.autoFilled='1';}
let timer=0,sequence=0,last='';
async function enrich(){const value=String(link.value||'').trim();if(!value||value===last)return;last=value;const current=++sequence;status.textContent='Analisando produto no Mercado Livre…';try{const response=await fetch('${NEW_PRODUCT_ENRICH_PATH}',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({linkAfiliado:value})});const payload=await response.json();if(current!==sequence)return;if(!response.ok||!payload.ok){status.textContent='Link reconhecido, mas não foi possível preencher todos os dados automaticamente · '+(payload.code||'erro');return;}const d=payload.data||{};put('nome',d.nome);put('id',slug(d.nome));put('marca',d.marca);put('categoria',chooseCategory(d.nome,d.categoriaHint));put('imagem',d.imagem);put('imagemAlt',d.imagemAlt||d.nome);put('resumo',d.resumo);form.dispatchEvent(new Event('input',{bubbles:true}));status.textContent='Dados preenchidos automaticamente pelo Mercado Livre · revise e publique';if(autoPrepare&&publish&&advance&&/^PODE AVANÇAR\\? SIM · PRONTO/.test(String(advance.textContent||''))&&!publish.disabled){status.textContent='Dados preenchidos automaticamente · preparando publicação governada';setTimeout(()=>publish.click(),50);}}catch{if(current===sequence)status.textContent='Falha temporária ao analisar o Mercado Livre; tente colar o link novamente.';}}
link.addEventListener('input',()=>{clearTimeout(timer);last='';timer=setTimeout(enrich,450)});link.addEventListener('change',()=>{clearTimeout(timer);last='';enrich()});
if(queryLink&&!String(link.value||'').trim()){link.value=queryLink;form.dispatchEvent(new Event('input',{bubbles:true}));history.replaceState({},'', '/novo-produto');}
if(String(link.value||'').trim())enrich();
})();`;
}

async function enrichNewProduct(request, env, options = {}) {
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: securityHeaders({ allow: 'POST' }) });
  if (!originAllowed(request, env)) return json({ ok: false, code: 'ORIGIN_REJECTED' }, 403);
  const contentType = String(request.headers.get('content-type') || '').toLowerCase();
  if (!contentType.startsWith('application/json')) return json({ ok: false, code: 'JSON_REQUIRED' }, 415);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_ENRICH_BODY_BYTES) return json({ ok: false, code: 'PAYLOAD_TOO_LARGE' }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ ok: false, code: 'INVALID_JSON' }, 400); }
  const link = String(body?.linkAfiliado || body?.link || '').trim();
  if (!link) return json({ ok: false, code: 'LINK_REQUIRED' }, 422);
  try {
    const result = await enrichMercadoLivreProduct(link, { fetchImpl: options.mercadoLivreFetchImpl || globalThis.fetch });
    return json(result, result.ok ? 200 : 422);
  } catch (error) {
    return json({ ok: false, code: String(error?.message || 'ENRICH_FAILED') }, 422);
  }
}

async function runO5FirstPublication(env, options = {}) {
  try {
    const [{ CENTRAL_PRODUCTS_PROJECTION }, { dispatchNewProductTransaction }] = await Promise.all([
      import('./generated/products.mjs'),
      import('./new-product-transaction.mjs'),
    ]);
    const result = await dispatchNewProductTransaction({
      env,
      input: O5_FIRST_PRODUCT,
      products: CENTRAL_PRODUCTS_PROJECTION.products || [],
      fetchImpl: options.githubFetchImpl || globalThis.fetch,
    });
    if (result.ok) return json({ ...result, o5: 'FIRST_REAL_PUBLICATION' }, 202);
    if (result.code === 'PUBLICATION_GATE_CLOSED') return json(result, 503);
    if (result.code === 'DUPLICATE_PRODUCT') return json(result, 409);
    if (result.code === 'GITHUB_BACKEND_UNAVAILABLE' || result.code === 'GITHUB_DISPATCH_FAILED') return json(result, 502);
    return json(result, 422);
  } catch {
    return json({ ok: false, code: 'O5_FIRST_PUBLICATION_FAILED', state: 'FALHOU' }, 500);
  }
}

export async function handleGithubOauthCentralRequest(request, env, options = {}) {
  const url = new URL(request.url);
  const config = validateGithubOauthConfig(env);
  if (!config.ok) return json({ ok: false, code: 'CENTRAL_CONFIG_INCOMPLETE', message: 'Configuração administrativa obrigatória ausente ou inválida.' }, 503);
  if (url.hostname !== expectedHost(env)) return json({ ok: false, code: 'CENTRAL_HOST_REJECTED' }, 421);

  if (url.pathname === GITHUB_OAUTH_PATHS.login) {
    if (request.method !== 'GET') return new Response(null, { status: 405, headers: securityHeaders({ allow: 'GET' }) });
    return beginGithubOauth(request, env, options);
  }
  if (url.pathname === GITHUB_OAUTH_PATHS.callback) {
    if (request.method !== 'GET') return new Response(null, { status: 405, headers: securityHeaders({ allow: 'GET' }) });
    return completeGithubOauth(request, env, options);
  }
  if (url.pathname === GITHUB_OAUTH_PATHS.logout) {
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: securityHeaders({ allow: 'POST' }) });
    if (!originAllowed(request, env)) return json({ ok: false, code: 'ORIGIN_REJECTED' }, 403);
    return logoutGithubOauth();
  }

  const auth = await verifyGithubOauthSession(request, env, options);
  if (!auth.ok) return githubOauthUnauthorizedResponse(request);

  if (url.pathname === NEW_PRODUCT_ENRICH_PATH) return enrichNewProduct(request, env, options);

  if (url.pathname === NEW_PRODUCT_CLIENT_PATH && request.method === 'GET') {
    const base = await handleCentralRequest(request, env, { ...options, skipAdministrativeBoundary: true, githubIdentity: auth.identity });
    if (!base.ok) return base;
    const source = repairNewProductClientSource(await base.text());
    return new Response(`${source}${linkAutofillClient()}`, { status: 200, headers: { 'cache-control': 'no-store', 'content-type': 'text/javascript; charset=utf-8', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff' } });
  }

  if (url.pathname === O5_FIRST_PUBLICATION_PATH) {
    if (request.method !== 'GET') return new Response(null, { status: 405, headers: securityHeaders({ allow: 'GET' }) });
    if (url.searchParams.get('confirm') !== O5_FIRST_PRODUCT_ID) return json({ ok: false, code: 'O5_CONFIRMATION_REQUIRED' }, 400);
    return runO5FirstPublication(env, options);
  }

  return handleCentralRequest(request, env, { ...options, skipAdministrativeBoundary: true, githubIdentity: auth.identity });
}

export default {
  async fetch(request, env) {
    return handleGithubOauthCentralRequest(request, env);
  },
};
