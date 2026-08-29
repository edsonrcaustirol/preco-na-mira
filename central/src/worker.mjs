import { CENTRAL_CONTRACTS, centralCapabilities } from './contracts.mjs';
import { renderCentralShell } from './ui.mjs';

const REQUIRED_RUNTIME = CENTRAL_CONTRACTS.authentication.requiredRuntime;
const READ_METHODS = new Set(['GET', 'HEAD']);
const PAGE_PATHS = new Set(['/', '/painel', '/produtos', '/novo-produto', '/saude-links', '/historico']);
const NEW_PRODUCT_TRANSACTION_PATH = '/api/new-product/transactions';
const MAX_TRANSACTION_BODY_BYTES = 32768;
const ACCESS_ALGORITHM = CENTRAL_CONTRACTS.authentication.algorithm;
const ACCESS_JWKS_PATH = CENTRAL_CONTRACTS.authentication.jwksPath;

function headers(extra = {}, scriptNonce = '', connectSelf = false) {
  const scriptSource = scriptNonce ? `script-src 'nonce-${scriptNonce}';` : "script-src 'none';";
  const connectSource = connectSelf ? "connect-src 'self';" : "connect-src 'none';";
  return {
    'cache-control': 'no-store',
    'content-security-policy': `default-src 'none'; ${scriptSource} style-src 'unsafe-inline'; img-src https: data:; ${connectSource} base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    ...extra,
  };
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: headers({ 'content-type': 'application/json; charset=utf-8' }),
  });
}

export function missingAdminConfig(env = {}) {
  return REQUIRED_RUNTIME.filter(key => !String(env?.[key] || '').trim());
}

function decodeBase64Url(value) {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('invalid-jwt');
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function decodeJwtJson(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

export function normalizeAccessIssuer(value) {
  const url = new URL(String(value || '').trim());
  if (
    url.protocol !== 'https:' ||
    !url.hostname.endsWith('.cloudflareaccess.com') ||
    url.hostname === 'cloudflareaccess.com' ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) throw new Error('invalid-access-issuer');
  return url.origin;
}

function audienceMatches(actual, expected) {
  if (typeof actual === 'string') return actual === expected;
  if (!Array.isArray(actual)) return false;
  return actual.some(value => typeof value === 'string' && value === expected);
}

async function fetchAccessJwks(issuer, fetchImpl) {
  const response = await fetchImpl(`${issuer}${ACCESS_JWKS_PATH}`, { headers: { accept: 'application/json' } });
  if (!response?.ok) throw new Error('jwks-unavailable');
  const jwks = await response.json();
  if (!jwks || !Array.isArray(jwks.keys)) throw new Error('jwks-invalid');
  return jwks.keys;
}

export async function verifyCloudflareAccessAssertion(assertion, env, options = {}) {
  const token = String(assertion || '').trim();
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some(part => !part)) throw new Error('invalid-jwt');
  const header = decodeJwtJson(parts[0]);
  if (header?.alg !== ACCESS_ALGORITHM || typeof header?.kid !== 'string' || !header.kid) throw new Error('invalid-jwt-header');
  const issuer = normalizeAccessIssuer(env.PNM_CENTRAL_ACCESS_ISSUER);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('jwks-unavailable');
  const keys = await fetchAccessJwks(issuer, fetchImpl);
  const jwk = keys.find(candidate => candidate?.kid === header.kid);
  if (!jwk || jwk.kty !== 'RSA' || (jwk.alg && jwk.alg !== ACCESS_ALGORITHM) || (jwk.use && jwk.use !== 'sig')) throw new Error('signing-key-not-found');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = decodeBase64Url(parts[2]);
  const signatureValid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signingInput);
  if (!signatureValid) throw new Error('invalid-signature');
  const payload = decodeJwtJson(parts[1]);
  if (payload?.iss !== issuer) throw new Error('invalid-issuer');
  const expectedAudience = String(env.PNM_CENTRAL_ACCESS_AUD || '').trim();
  if (!audienceMatches(payload?.aud, expectedAudience)) throw new Error('invalid-audience');
  const now = Number.isFinite(options.nowSeconds) ? options.nowSeconds : Math.floor(Date.now() / 1000);
  if (!Number.isFinite(payload?.exp) || payload.exp <= now) throw new Error('token-expired');
  if (payload.nbf !== undefined && (!Number.isFinite(payload.nbf) || payload.nbf > now)) throw new Error('token-not-active');
  if (payload.iat !== undefined && (!Number.isFinite(payload.iat) || payload.iat > now + 60)) throw new Error('token-issued-in-future');
  return payload;
}

async function enforceAdministrativeBoundary(request, env, url, options = {}) {
  const missing = missingAdminConfig(env);
  if (missing.length) return json({ ok: false, code: 'CENTRAL_CONFIG_INCOMPLETE', message: 'Configuração administrativa obrigatória ausente.' }, 503);
  try { normalizeAccessIssuer(env.PNM_CENTRAL_ACCESS_ISSUER); }
  catch { return json({ ok: false, code: 'CENTRAL_CONFIG_INCOMPLETE', message: 'Configuração administrativa obrigatória ausente ou inválida.' }, 503); }
  if (url.hostname !== String(env.PNM_CENTRAL_EXPECTED_HOST).trim()) return json({ ok: false, code: 'CENTRAL_HOST_REJECTED' }, 421);
  const assertion = String(request.headers.get(CENTRAL_CONTRACTS.authentication.accessAssertionHeader) || '').trim();
  if (!assertion) return json({ ok: false, code: 'CLOUDFLARE_ACCESS_REQUIRED', message: 'Autenticação administrativa obrigatória.' }, 403);
  try { await verifyCloudflareAccessAssertion(assertion, env, options); }
  catch { return json({ ok: false, code: 'CLOUDFLARE_ACCESS_INVALID', message: 'Autenticação administrativa inválida.' }, 403); }
  return null;
}

async function loadOperationalState(env) {
  let modules;
  try {
    modules = await Promise.all([
      import('./generated/products.mjs'),
      import('./link-health.mjs'),
      import('./history-store.mjs'),
      import('./link-health-history.mjs'),
      import('./operational-read-model.mjs'),
    ]);
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND' && String(error?.url || '').includes('/generated/products.mjs')) return null;
    throw error;
  }
  const [
    { CENTRAL_PRODUCTS_PROJECTION },
    { createEmptyCentralLinkHealthReadModel },
    { readCentralOperationalHistory },
    { buildCentralLinkHealthReadModelFromHistory },
    { buildCentralOperationalReadModel },
  ] = modules;
  const products = CENTRAL_PRODUCTS_PROJECTION.products || [];
  let history = null;
  let historyStatus = 'unbound';
  let linkHealth;
  if (!env?.PNM_HISTORY_DB) {
    linkHealth = createEmptyCentralLinkHealthReadModel({ historyStatus: 'unbound', coverage: { productsTotal: products.length, currentResults: 0, staleResults: 0, notAudited: products.length } });
  } else {
    try {
      history = await readCentralOperationalHistory(env.PNM_HISTORY_DB);
      historyStatus = 'available';
      linkHealth = await buildCentralLinkHealthReadModelFromHistory({ products, history });
    } catch {
      historyStatus = 'unavailable';
      linkHealth = createEmptyCentralLinkHealthReadModel({ historyStatus: 'unavailable', coverage: { productsTotal: products.length, currentResults: 0, staleResults: 0, notAudited: products.length } });
    }
  }
  const operational = buildCentralOperationalReadModel({ projection: CENTRAL_PRODUCTS_PROJECTION, history, historyStatus, linkHealth });
  return { projection: CENTRAL_PRODUCTS_PROJECTION, history, historyStatus, linkHealth, operational };
}

async function renderProtectedPage(url, env) {
  const state = await loadOperationalState(env);
  if (!state) return { html: renderCentralShell({ pathname: url.pathname }), scriptNonce: '', connectSelf: false };
  if (url.pathname === '/' || url.pathname === '/painel') {
    const { renderOperationalDashboard } = await import('./operational-pages.mjs');
    return { html: renderOperationalDashboard(state.operational), scriptNonce: '', connectSelf: false };
  }
  if (url.pathname === '/produtos') {
    const { renderOperationalProductsPage } = await import('./products-operational-page.mjs');
    const scriptNonce = crypto.randomUUID().replaceAll('-', '');
    return { html: renderOperationalProductsPage(state.projection, state.linkHealth, scriptNonce), scriptNonce, connectSelf: false };
  }
  if (url.pathname === '/novo-produto') {
    const { renderNewProductPage } = await import('./new-product-page.mjs');
    const scriptNonce = crypto.randomUUID().replaceAll('-', '');
    return { html: renderNewProductPage(state.projection, scriptNonce), scriptNonce, connectSelf: true };
  }
  if (url.pathname === '/saude-links') {
    const { renderLinkHealthPage } = await import('./link-health-page.mjs');
    const scriptNonce = crypto.randomUUID().replaceAll('-', '');
    return { html: renderLinkHealthPage(state.linkHealth, scriptNonce), scriptNonce, connectSelf: false };
  }
  if (url.pathname === '/historico') {
    const { renderOperationalHistory } = await import('./operational-pages.mjs');
    return { html: renderOperationalHistory({ historyStatus: state.historyStatus, history: state.history }), scriptNonce: '', connectSelf: false };
  }
  return { html: renderCentralShell({ pathname: url.pathname }), scriptNonce: '', connectSelf: false };
}

function postOriginAllowed(request, env) {
  const expected = `https://${String(env.PNM_CENTRAL_EXPECTED_HOST || '').trim()}`;
  return String(request.headers.get('origin') || '').trim() === expected;
}

async function createNewProductTransaction(request, env, options = {}) {
  if (!postOriginAllowed(request, env)) return json({ ok: false, code: 'ORIGIN_REJECTED' }, 403);
  const contentType = String(request.headers.get('content-type') || '').toLowerCase();
  if (!contentType.startsWith('application/json')) return json({ ok: false, code: 'JSON_REQUIRED' }, 415);
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_TRANSACTION_BODY_BYTES) return json({ ok: false, code: 'PAYLOAD_TOO_LARGE' }, 413);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_TRANSACTION_BODY_BYTES) return json({ ok: false, code: 'PAYLOAD_TOO_LARGE' }, 413);
  let input;
  try { input = JSON.parse(raw); }
  catch { return json({ ok: false, code: 'INVALID_JSON' }, 400); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return json({ ok: false, code: 'INVALID_PAYLOAD' }, 400);
  const state = await loadOperationalState(env);
  if (!state) return json({ ok: false, code: 'CENTRAL_PRODUCTS_UNAVAILABLE' }, 503);
  const { dispatchNewProductTransaction } = await import('./new-product-transaction.mjs');
  const result = await dispatchNewProductTransaction({ env, input, products: state.projection.products || [], fetchImpl: options.githubFetchImpl || globalThis.fetch });
  if (result.ok) return json(result, 202);
  if (result.code === 'PUBLICATION_GATE_CLOSED') return json(result, 503);
  if (result.code === 'DUPLICATE_PRODUCT') return json(result, 409);
  if (result.code === 'GITHUB_BACKEND_UNAVAILABLE' || result.code === 'GITHUB_DISPATCH_FAILED') return json(result, 502);
  return json(result, 422);
}

async function readNewProductTransactionStatus(request, env, transactionId, options = {}) {
  const { getNewProductTransactionStatus } = await import('./new-product-transaction.mjs');
  let result;
  try { result = await getNewProductTransactionStatus({ env, transactionId, fetchImpl: options.githubFetchImpl || globalThis.fetch }); }
  catch { result = { ok: false, code: 'INVALID_TRANSACTION_ID', state: 'FALHOU' }; }
  const status = result.ok ? 200 : result.code === 'PUBLICATION_GATE_CLOSED' ? 503 : result.code === 'INVALID_TRANSACTION_ID' ? 400 : 502;
  if (request.method === 'HEAD') return new Response(null, { status, headers: headers() });
  return json(result, status);
}

export async function handleCentralRequest(request, env, options = {}) {
  const url = new URL(request.url);
  const boundaryFailure = await enforceAdministrativeBoundary(request, env, url, options);
  if (boundaryFailure) return boundaryFailure;

  if (url.pathname === NEW_PRODUCT_TRANSACTION_PATH && request.method === 'POST') return createNewProductTransaction(request, env, options);
  const transactionMatch = url.pathname.match(/^\/api\/new-product\/transactions\/(np-[a-f0-9]{24})$/);
  if (transactionMatch && READ_METHODS.has(request.method)) return readNewProductTransactionStatus(request, env, transactionMatch[1], options);

  if (!READ_METHODS.has(request.method)) return new Response(null, { status: 405, headers: headers({ allow: 'GET, HEAD' }) });

  if (url.pathname === '/api/capabilities') {
    if (request.method === 'HEAD') return new Response(null, { status: 200, headers: headers() });
    return json({ ok: true, ...centralCapabilities() });
  }

  if (PAGE_PATHS.has(url.pathname)) {
    if (request.method === 'HEAD') return new Response(null, { status: 200, headers: headers() });
    const page = await renderProtectedPage(url, env);
    return new Response(page.html, { status: 200, headers: headers({ 'content-type': 'text/html; charset=utf-8' }, page.scriptNonce, page.connectSelf) });
  }

  return json({ ok: false, code: 'NOT_FOUND' }, 404);
}

export default {
  async fetch(request, env) {
    return handleCentralRequest(request, env);
  },
};
