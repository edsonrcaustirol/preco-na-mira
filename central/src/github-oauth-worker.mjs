import { handleCentralRequest } from './worker.mjs';
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
