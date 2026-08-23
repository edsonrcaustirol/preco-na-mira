import { centralCapabilities } from './contracts.mjs';
import { renderCentralShell } from './ui.mjs';

const REQUIRED_RUNTIME = Object.freeze(['PNM_CENTRAL_ACCESS_AUD', 'PNM_CENTRAL_EXPECTED_HOST']);
const READ_METHODS = new Set(['GET', 'HEAD']);
const PAGE_PATHS = new Set(['/', '/painel', '/produtos', '/novo-produto', '/saude-links', '/historico']);

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

function enforceAdministrativeBoundary(request, env, url) {
  const missing = missingAdminConfig(env);
  if (missing.length) {
    return json({
      ok: false,
      code: 'CENTRAL_CONFIG_INCOMPLETE',
      message: 'Configuração administrativa obrigatória ausente.',
      missing,
    }, 503);
  }

  if (url.hostname !== String(env.PNM_CENTRAL_EXPECTED_HOST).trim()) {
    return json({ ok: false, code: 'CENTRAL_HOST_REJECTED' }, 421);
  }

  if (!String(request.headers.get('cf-access-jwt-assertion') || '').trim()) {
    return json({
      ok: false,
      code: 'CLOUDFLARE_ACCESS_REQUIRED',
      message: 'A Central exige a barreira externa do Cloudflare Access.',
    }, 403);
  }

  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const boundaryFailure = enforceAdministrativeBoundary(request, env, url);
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
  },
};
