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

  return handleCentralRequest(request, env, { ...options, skipAdministrativeBoundary: true, githubIdentity: auth.identity });
}

export default {
  async fetch(request, env) {
    return handleGithubOauthCentralRequest(request, env);
  },
};
