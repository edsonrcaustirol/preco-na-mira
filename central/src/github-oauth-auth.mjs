const AUTH_MODE = 'github-oauth';
const LOGIN_PATH = '/auth/github/login';
const CALLBACK_PATH = '/auth/github/callback';
const LOGOUT_PATH = '/auth/logout';
const OAUTH_COOKIE = '__Host-pnm_oauth';
const SESSION_COOKIE = '__Host-pnm_central_session';
const SESSION_TTL_SECONDS = 4 * 60 * 60;
const OAUTH_TTL_SECONDS = 10 * 60;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const GITHUB_OAUTH_REQUIRED_RUNTIME = Object.freeze([
  'PNM_CENTRAL_AUTH_MODE',
  'PNM_CENTRAL_EXPECTED_HOST',
  'PNM_GITHUB_OAUTH_CLIENT_ID',
  'PNM_GITHUB_OAUTH_CLIENT_SECRET',
  'PNM_GITHUB_ALLOWED_USER_ID',
  'PNM_GITHUB_ALLOWED_LOGIN',
  'PNM_CENTRAL_SESSION_SECRET',
]);

export const GITHUB_OAUTH_PATHS = Object.freeze({ login: LOGIN_PATH, callback: CALLBACK_PATH, logout: LOGOUT_PATH });
export const GITHUB_OAUTH_COOKIES = Object.freeze({ oauth: OAUTH_COOKIE, session: SESSION_COOKIE });

const text = value => String(value ?? '').trim();

function bytesToBase64Url(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x4000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x4000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value || '')) throw new Error('invalid-base64url');
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function encodeJson(value) {
  return bytesToBase64Url(encoder.encode(JSON.stringify(value)));
}

function decodeJson(value) {
  return JSON.parse(decoder.decode(base64UrlToBytes(value)));
}

function randomBase64Url(byteLength, randomValues = array => crypto.getRandomValues(array)) {
  const bytes = new Uint8Array(byteLength);
  randomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function sha256Base64Url(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function signValue(value, secret) {
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

async function verifyValue(value, signature, secret) {
  const key = await hmacKey(secret);
  return crypto.subtle.verify('HMAC', key, base64UrlToBytes(signature), encoder.encode(value));
}

function cookieValue(request, name) {
  const raw = String(request.headers.get('cookie') || '');
  for (const part of raw.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    if (key === name) return part.slice(index + 1).trim();
  }
  return '';
}

function secureCookie(name, value, maxAge) {
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function clearCookie(name) {
  return `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

function responseHeaders(extra = {}) {
  return {
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    ...extra,
  };
}

function json(payload, status = 200, extra = {}) {
  return new Response(JSON.stringify(payload), { status, headers: responseHeaders({ 'content-type': 'application/json; charset=utf-8', ...extra }) });
}

function redirect(location, status = 302, setCookies = []) {
  const headers = new Headers(responseHeaders({ location }));
  for (const cookie of setCookies) headers.append('set-cookie', cookie);
  return new Response(null, { status, headers });
}

export function githubOauthMissingConfig(env = {}) {
  return GITHUB_OAUTH_REQUIRED_RUNTIME.filter(key => !text(env?.[key]));
}

export function validateGithubOauthConfig(env = {}) {
  const missing = githubOauthMissingConfig(env);
  if (missing.length) return { ok: false, missing };
  const mismatches = [];
  if (text(env.PNM_CENTRAL_AUTH_MODE) !== AUTH_MODE) mismatches.push('PNM_CENTRAL_AUTH_MODE');
  if (text(env.PNM_CENTRAL_EXPECTED_HOST) !== 'central.preconamira.com.br') mismatches.push('PNM_CENTRAL_EXPECTED_HOST');
  if (!/^\d+$/.test(text(env.PNM_GITHUB_ALLOWED_USER_ID)) || Number(env.PNM_GITHUB_ALLOWED_USER_ID) <= 0) mismatches.push('PNM_GITHUB_ALLOWED_USER_ID');
  if (!/^[A-Za-z0-9-]{1,39}$/.test(text(env.PNM_GITHUB_ALLOWED_LOGIN))) mismatches.push('PNM_GITHUB_ALLOWED_LOGIN');
  if (encoder.encode(text(env.PNM_CENTRAL_SESSION_SECRET)).byteLength < 32) mismatches.push('PNM_CENTRAL_SESSION_SECRET');
  return { ok: mismatches.length === 0, missing, mismatches };
}

export function expectedCentralOrigin(env = {}) {
  return `https://${text(env.PNM_CENTRAL_EXPECTED_HOST)}`;
}

export async function beginGithubOauth(request, env, options = {}) {
  const config = validateGithubOauthConfig(env);
  if (!config.ok) return json({ ok: false, code: 'CENTRAL_CONFIG_INCOMPLETE' }, 503);
  const state = randomBase64Url(32, options.randomValues);
  const verifier = randomBase64Url(64, options.randomValues);
  const challenge = await sha256Base64Url(verifier);
  const redirectUri = `${expectedCentralOrigin(env)}${CALLBACK_PATH}`;
  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', text(env.PNM_GITHUB_OAUTH_CLIENT_ID));
  authorize.searchParams.set('redirect_uri', redirectUri);
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('code_challenge', challenge);
  authorize.searchParams.set('code_challenge_method', 'S256');
  authorize.searchParams.set('allow_signup', 'false');
  authorize.searchParams.set('prompt', 'select_account');
  const flow = `${state}.${verifier}`;
  return redirect(authorize.toString(), 302, [secureCookie(OAUTH_COOKIE, flow, OAUTH_TTL_SECONDS)]);
}

async function exchangeCodeForIdentity(code, verifier, env, fetchImpl) {
  const redirectUri = `${expectedCentralOrigin(env)}${CALLBACK_PATH}`;
  const body = new URLSearchParams({
    client_id: text(env.PNM_GITHUB_OAUTH_CLIENT_ID),
    client_secret: text(env.PNM_GITHUB_OAUTH_CLIENT_SECRET),
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });
  const tokenResponse = await fetchImpl('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': 'preco-na-mira-central',
    },
    body: body.toString(),
  });
  if (!tokenResponse?.ok) throw new Error('oauth-token-exchange-failed');
  const tokenPayload = await tokenResponse.json();
  const accessToken = text(tokenPayload?.access_token);
  if (!accessToken || text(tokenPayload?.token_type).toLowerCase() !== 'bearer') throw new Error('oauth-token-invalid');
  if (text(tokenPayload?.scope) !== '') throw new Error('oauth-scope-not-empty');
  const userResponse = await fetchImpl('https://api.github.com/user', {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${accessToken}`,
      'user-agent': 'preco-na-mira-central',
      'x-github-api-version': '2022-11-28',
    },
  });
  if (!userResponse?.ok) throw new Error('oauth-user-fetch-failed');
  const user = await userResponse.json();
  return { id: Number(user?.id), login: text(user?.login) };
}

async function issueSession(identity, env, nowSeconds) {
  const payload = encodeJson({
    v: 1,
    iss: 'pnm-central/github-oauth',
    aud: 'pnm-central',
    uid: identity.id,
    login: identity.login,
    iat: nowSeconds,
    exp: nowSeconds + SESSION_TTL_SECONDS,
  });
  const signature = await signValue(payload, text(env.PNM_CENTRAL_SESSION_SECRET));
  return `${payload}.${signature}`;
}

export async function completeGithubOauth(request, env, options = {}) {
  const config = validateGithubOauthConfig(env);
  if (!config.ok) return json({ ok: false, code: 'CENTRAL_CONFIG_INCOMPLETE' }, 503);
  const url = new URL(request.url);
  const code = text(url.searchParams.get('code'));
  const returnedState = text(url.searchParams.get('state'));
  const flow = cookieValue(request, OAUTH_COOKIE);
  const dot = flow.indexOf('.');
  if (!code || !returnedState || dot <= 0) return json({ ok: false, code: 'OAUTH_CALLBACK_REJECTED' }, 403, { 'set-cookie': clearCookie(OAUTH_COOKIE) });
  const expectedState = flow.slice(0, dot);
  const verifier = flow.slice(dot + 1);
  if (!verifier || expectedState !== returnedState) return json({ ok: false, code: 'OAUTH_CALLBACK_REJECTED' }, 403, { 'set-cookie': clearCookie(OAUTH_COOKIE) });
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') return json({ ok: false, code: 'OAUTH_BACKEND_UNAVAILABLE' }, 502, { 'set-cookie': clearCookie(OAUTH_COOKIE) });
  let identity;
  try { identity = await exchangeCodeForIdentity(code, verifier, env, fetchImpl); }
  catch { return json({ ok: false, code: 'OAUTH_CALLBACK_REJECTED' }, 403, { 'set-cookie': clearCookie(OAUTH_COOKIE) }); }
  const allowedId = Number(text(env.PNM_GITHUB_ALLOWED_USER_ID));
  const allowedLogin = text(env.PNM_GITHUB_ALLOWED_LOGIN).toLowerCase();
  if (identity.id !== allowedId || identity.login.toLowerCase() !== allowedLogin) return json({ ok: false, code: 'ADMIN_IDENTITY_REJECTED' }, 403, { 'set-cookie': clearCookie(OAUTH_COOKIE) });
  const nowSeconds = Number.isFinite(options.nowSeconds) ? options.nowSeconds : Math.floor(Date.now() / 1000);
  const session = await issueSession(identity, env, nowSeconds);
  return redirect('/', 303, [clearCookie(OAUTH_COOKIE), secureCookie(SESSION_COOKIE, session, SESSION_TTL_SECONDS)]);
}

export async function verifyGithubOauthSession(request, env, options = {}) {
  const config = validateGithubOauthConfig(env);
  if (!config.ok) return { ok: false, code: 'CENTRAL_CONFIG_INCOMPLETE' };
  const raw = cookieValue(request, SESSION_COOKIE);
  const dot = raw.lastIndexOf('.');
  if (dot <= 0) return { ok: false, code: 'AUTH_REQUIRED' };
  const payload = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  let valid = false;
  try { valid = await verifyValue(payload, signature, text(env.PNM_CENTRAL_SESSION_SECRET)); }
  catch { valid = false; }
  if (!valid) return { ok: false, code: 'AUTH_INVALID' };
  let claims;
  try { claims = decodeJson(payload); }
  catch { return { ok: false, code: 'AUTH_INVALID' }; }
  const nowSeconds = Number.isFinite(options.nowSeconds) ? options.nowSeconds : Math.floor(Date.now() / 1000);
  if (claims?.v !== 1 || claims?.iss !== 'pnm-central/github-oauth' || claims?.aud !== 'pnm-central') return { ok: false, code: 'AUTH_INVALID' };
  if (!Number.isFinite(claims?.iat) || claims.iat > nowSeconds + 60 || !Number.isFinite(claims?.exp) || claims.exp <= nowSeconds) return { ok: false, code: 'AUTH_INVALID' };
  if (Number(claims.uid) !== Number(text(env.PNM_GITHUB_ALLOWED_USER_ID))) return { ok: false, code: 'AUTH_INVALID' };
  if (text(claims.login).toLowerCase() !== text(env.PNM_GITHUB_ALLOWED_LOGIN).toLowerCase()) return { ok: false, code: 'AUTH_INVALID' };
  return { ok: true, identity: { id: Number(claims.uid), login: text(claims.login) }, claims };
}

export function logoutGithubOauth() {
  return redirect('/', 303, [clearCookie(SESSION_COOKIE), clearCookie(OAUTH_COOKIE)]);
}

export function githubOauthUnauthorizedResponse(request) {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return json({ ok: false, code: 'GITHUB_OAUTH_REQUIRED', message: 'Autenticação administrativa obrigatória.' }, 401);
  return redirect(LOGIN_PATH, 302);
}
