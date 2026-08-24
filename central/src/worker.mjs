import { CENTRAL_CONTRACTS, centralCapabilities } from './contracts.mjs';
import { renderCentralShell } from './ui.mjs';

const REQUIRED_RUNTIME = CENTRAL_CONTRACTS.authentication.requiredRuntime;
const READ_METHODS = new Set(['GET', 'HEAD']);
const PAGE_PATHS = new Set(['/', '/painel', '/produtos', '/novo-produto', '/saude-links', '/historico']);
const ACCESS_ALGORITHM = CENTRAL_CONTRACTS.authentication.algorithm;
const ACCESS_JWKS_PATH = CENTRAL_CONTRACTS.authentication.jwksPath;

function headers(extra = {}) {
  return {
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
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
  ) {
    throw new Error('invalid-access-issuer');
  }
  return url.origin;
}

function audienceMatches(actual, expected) {
  if (typeof actual === 'string') return actual === expected;
  if (!Array.isArray(actual)) return false;
  return actual.some(value => typeof value === 'string' && value === expected);
}

async function fetchAccessJwks(issuer, fetchImpl) {
  const response = await fetchImpl(`${issuer}${ACCESS_JWKS_PATH}`, {
    headers: { accept: 'application/json' },
  });
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
  if (header?.alg !== ACCESS_ALGORITHM || typeof header?.kid !== 'string' || !header.kid) {
    throw new Error('invalid-jwt-header');
  }

  const issuer = normalizeAccessIssuer(env.PNM_CENTRAL_ACCESS_ISSUER);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('jwks-unavailable');
  const keys = await fetchAccessJwks(issuer, fetchImpl);
  const jwk = keys.find(candidate => candidate?.kid === header.kid);
  if (!jwk || jwk.kty !== 'RSA' || (jwk.alg && jwk.alg !== ACCESS_ALGORITHM) || (jwk.use && jwk.use !== 'sig')) {
    throw new Error('signing-key-not-found');
  }

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
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
  if (missing.length) {
    return json({
      ok: false,
      code: 'CENTRAL_CONFIG_INCOMPLETE',
      message: 'Configuração administrativa obrigatória ausente.',
    }, 503);
  }

  try {
    normalizeAccessIssuer(env.PNM_CENTRAL_ACCESS_ISSUER);
  } catch {
    return json({
      ok: false,
      code: 'CENTRAL_CONFIG_INCOMPLETE',
      message: 'Configuração administrativa obrigatória ausente ou inválida.',
    }, 503);
  }

  if (url.hostname !== String(env.PNM_CENTRAL_EXPECTED_HOST).trim()) {
    return json({ ok: false, code: 'CENTRAL_HOST_REJECTED' }, 421);
  }

  const assertion = String(request.headers.get(CENTRAL_CONTRACTS.authentication.accessAssertionHeader) || '').trim();
  if (!assertion) {
    return json({
      ok: false,
      code: 'CLOUDFLARE_ACCESS_REQUIRED',
      message: 'Autenticação administrativa obrigatória.',
    }, 403);
  }

  try {
    await verifyCloudflareAccessAssertion(assertion, env, options);
  } catch {
    return json({
      ok: false,
      code: 'CLOUDFLARE_ACCESS_INVALID',
      message: 'Autenticação administrativa inválida.',
    }, 403);
  }

  return null;
}

export async function handleCentralRequest(request, env, options = {}) {
  const url = new URL(request.url);
  const boundaryFailure = await enforceAdministrativeBoundary(request, env, url, options);
  if (boundaryFailure) return boundaryFailure;

  if (!READ_METHODS.has(request.method)) {
    return new Response(null, { status: 405, headers: headers({ allow: 'GET, HEAD' }) });
  }

  if (url.pathname === '/api/capabilities') {
    if (request.method === 'HEAD') return new Response(null, { status: 200, headers: headers() });
    return json({ ok: true, ...centralCapabilities() });
  }

  if (PAGE_PATHS.has(url.pathname)) {
    if (request.method === 'HEAD') return new Response(null, { status: 200, headers: headers() });
    return new Response(renderCentralShell(), {
      status: 200,
      headers: headers({ 'content-type': 'text/html; charset=utf-8' }),
    });
  }

  return json({ ok: false, code: 'NOT_FOUND' }, 404);
}

export default {
  async fetch(request, env) {
    return handleCentralRequest(request, env);
  },
};
