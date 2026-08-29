#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  GITHUB_OAUTH_COOKIES,
  GITHUB_OAUTH_PATHS,
  beginGithubOauth,
  completeGithubOauth,
  githubOauthMissingConfig,
  validateGithubOauthConfig,
  verifyGithubOauthSession,
} from '../central/src/github-oauth-auth.mjs';
import { handleGithubOauthCentralRequest } from '../central/src/github-oauth-worker.mjs';
import { CENTRAL_CONTRACTS, centralCapabilities } from '../central/src/contracts.mjs';
import { publicationGate } from '../central/src/new-product-transaction.mjs';

const CENTRAL_HOST = 'central.preconamira.com.br';
const FIXED_NOW = 2_000_000_000;
const oauthClientSecret = ['fixture', 'oauth', 'credential'].join('-');
const sessionSecret = ['fixture', 'session', 'signing', 'material', '0123456789abcdef'].join('-');
const workflowToken = ['fixture', 'workflow', 'credential'].join('-');
const oauthAccessToken = ['fixture', 'user', 'oauth', 'access'].join('-');

const env = {
  PNM_CENTRAL_AUTH_MODE: 'github-oauth',
  PNM_CENTRAL_EXPECTED_HOST: CENTRAL_HOST,
  PNM_GITHUB_OAUTH_CLIENT_ID: 'fixture-client-id',
  PNM_GITHUB_OAUTH_CLIENT_SECRET: oauthClientSecret,
  PNM_GITHUB_ALLOWED_USER_ID: '315643281',
  PNM_GITHUB_ALLOWED_LOGIN: 'edsonrcaustirol',
  PNM_CENTRAL_SESSION_SECRET: sessionSecret,
  PNM_GITHUB_REPOSITORY: 'edsonrcaustirol/preco-na-mira',
  PNM_GITHUB_BASE_BRANCH: 'main',
  PNM_GITHUB_WORKFLOW: 'o3-new-product-transaction.yml',
  PNM_GITHUB_TOKEN: workflowToken,
};

function cookieFromResponse(response, name) {
  const raw = response.headers.get('set-cookie') || '';
  const match = raw.match(new RegExp(`${name}=([^;,]+)`));
  return match?.[1] || '';
}

function deterministicRandom() {
  let seed = 1;
  return array => {
    for (let index = 0; index < array.length; index += 1) array[index] = (seed + index) % 256;
    seed = (seed + array.length) % 256;
    return array;
  };
}

assert.deepEqual(githubOauthMissingConfig({}), [
  'PNM_CENTRAL_AUTH_MODE',
  'PNM_CENTRAL_EXPECTED_HOST',
  'PNM_GITHUB_OAUTH_CLIENT_ID',
  'PNM_GITHUB_OAUTH_CLIENT_SECRET',
  'PNM_GITHUB_ALLOWED_USER_ID',
  'PNM_GITHUB_ALLOWED_LOGIN',
  'PNM_CENTRAL_SESSION_SECRET',
]);
assert.equal(validateGithubOauthConfig(env).ok, true);
assert.equal(CENTRAL_CONTRACTS.authentication.provider, 'github-oauth');
assert.equal(CENTRAL_CONTRACTS.authentication.githubOAuth.pkce, true);
assert.deepEqual(CENTRAL_CONTRACTS.authentication.githubOAuth.requestedScopes, []);
assert.equal(CENTRAL_CONTRACTS.authentication.githubOAuth.oauthTokenStored, false);
assert.equal(CENTRAL_CONTRACTS.authentication.githubOAuth.oauthTokenSentToBrowser, false);
assert.equal(centralCapabilities().authentication, 'github-oauth');

const randomValues = deterministicRandom();
const loginResponse = await beginGithubOauth(new Request(`https://${CENTRAL_HOST}${GITHUB_OAUTH_PATHS.login}`), env, { randomValues });
assert.equal(loginResponse.status, 302);
const authorizeUrl = new URL(loginResponse.headers.get('location'));
assert.equal(authorizeUrl.origin, 'https://github.com');
assert.equal(authorizeUrl.pathname, '/login/oauth/authorize');
assert.equal(authorizeUrl.searchParams.get('client_id'), env.PNM_GITHUB_OAUTH_CLIENT_ID);
assert.equal(authorizeUrl.searchParams.get('redirect_uri'), `https://${CENTRAL_HOST}${GITHUB_OAUTH_PATHS.callback}`);
assert.equal(authorizeUrl.searchParams.get('code_challenge_method'), 'S256');
assert.equal(authorizeUrl.searchParams.get('allow_signup'), 'false');
assert.equal(authorizeUrl.searchParams.get('prompt'), 'select_account');
assert.equal(authorizeUrl.searchParams.has('scope'), false, 'login de identidade não deve pedir escopo GitHub');
assert.ok(authorizeUrl.searchParams.get('state'));
assert.ok(authorizeUrl.searchParams.get('code_challenge'));
const oauthCookie = cookieFromResponse(loginResponse, GITHUB_OAUTH_COOKIES.oauth);
assert.ok(oauthCookie);
assert.match(loginResponse.headers.get('set-cookie') || '', /HttpOnly/);
assert.match(loginResponse.headers.get('set-cookie') || '', /Secure/);
assert.match(loginResponse.headers.get('set-cookie') || '', /SameSite=Lax/);

const state = authorizeUrl.searchParams.get('state');
let tokenExchangeSeen = false;
let identityFetchSeen = false;
const authFetch = async (url, init = {}) => {
  if (String(url) === 'https://github.com/login/oauth/access_token') {
    tokenExchangeSeen = true;
    assert.equal(init.method, 'POST');
    assert.match(String(init.body), /client_id=fixture-client-id/);
    assert.ok(String(init.body).includes('client_secret='));
    assert.ok(String(init.body).includes('code_verifier='));
    return new Response(JSON.stringify({ access_token: oauthAccessToken, scope: '', token_type: 'bearer' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (String(url) === 'https://api.github.com/user') {
    identityFetchSeen = true;
    assert.equal(init.headers.authorization, `Bearer ${oauthAccessToken}`);
    return new Response(JSON.stringify({ id: 315643281, login: 'edsonrcaustirol' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  throw new Error(`unexpected-url:${url}`);
};

const callbackRequest = new Request(`https://${CENTRAL_HOST}${GITHUB_OAUTH_PATHS.callback}?code=fixture-code&state=${encodeURIComponent(state)}`, {
  headers: { cookie: `${GITHUB_OAUTH_COOKIES.oauth}=${oauthCookie}` },
});
const callbackResponse = await completeGithubOauth(callbackRequest, env, { fetchImpl: authFetch, nowSeconds: FIXED_NOW });
assert.equal(callbackResponse.status, 303);
assert.equal(callbackResponse.headers.get('location'), '/');
assert.equal(tokenExchangeSeen, true);
assert.equal(identityFetchSeen, true);
const sessionCookie = cookieFromResponse(callbackResponse, GITHUB_OAUTH_COOKIES.session);
assert.ok(sessionCookie);
assert.equal((callbackResponse.headers.get('set-cookie') || '').includes(oauthAccessToken), false);
assert.equal((callbackResponse.headers.get('set-cookie') || '').includes(oauthClientSecret), false);
assert.equal((callbackResponse.headers.get('set-cookie') || '').includes(workflowToken), false);

const authenticatedRequest = new Request(`https://${CENTRAL_HOST}/api/capabilities`, {
  headers: { cookie: `${GITHUB_OAUTH_COOKIES.session}=${sessionCookie}` },
});
const verified = await verifyGithubOauthSession(authenticatedRequest, env, { nowSeconds: FIXED_NOW + 60 });
assert.equal(verified.ok, true);
assert.equal(verified.identity.id, 315643281);
assert.equal(verified.identity.login, 'edsonrcaustirol');

const tamperedCookie = `${sessionCookie.slice(0, -1)}${sessionCookie.endsWith('A') ? 'B' : 'A'}`;
const tampered = await verifyGithubOauthSession(new Request(`https://${CENTRAL_HOST}/`, {
  headers: { cookie: `${GITHUB_OAUTH_COOKIES.session}=${tamperedCookie}` },
}), env, { nowSeconds: FIXED_NOW + 60 });
assert.equal(tampered.ok, false);

const noAuthApi = await handleGithubOauthCentralRequest(new Request(`https://${CENTRAL_HOST}/api/capabilities`), env, { nowSeconds: FIXED_NOW + 60 });
assert.equal(noAuthApi.status, 401);
assert.equal((await noAuthApi.json()).code, 'GITHUB_OAUTH_REQUIRED');

const noAuthPage = await handleGithubOauthCentralRequest(new Request(`https://${CENTRAL_HOST}/`), env, { nowSeconds: FIXED_NOW + 60 });
assert.equal(noAuthPage.status, 302);
assert.equal(noAuthPage.headers.get('location'), GITHUB_OAUTH_PATHS.login);

const wrongHost = await handleGithubOauthCentralRequest(new Request('https://preconamira.com.br/'), env, { nowSeconds: FIXED_NOW + 60 });
assert.equal(wrongHost.status, 421);

const incomplete = await handleGithubOauthCentralRequest(new Request(`https://${CENTRAL_HOST}/`), { PNM_CENTRAL_AUTH_MODE: 'github-oauth' });
assert.equal(incomplete.status, 503);

const capabilitiesResponse = await handleGithubOauthCentralRequest(authenticatedRequest, env, { nowSeconds: FIXED_NOW + 60 });
assert.equal(capabilitiesResponse.status, 200);
const capabilities = await capabilitiesResponse.json();
assert.equal(capabilities.authentication, 'github-oauth');
assert.equal(capabilities.githubMutationEnabled, false);
assert.equal(capabilities.productMutationEnabled, false);

const wrongUserFetch = async url => {
  if (String(url).includes('/login/oauth/access_token')) return new Response(JSON.stringify({ access_token: oauthAccessToken, scope: '', token_type: 'bearer' }), { status: 200, headers: { 'content-type': 'application/json' } });
  if (String(url) === 'https://api.github.com/user') return new Response(JSON.stringify({ id: 1, login: 'other-user' }), { status: 200, headers: { 'content-type': 'application/json' } });
  throw new Error(`unexpected-url:${url}`);
};
const wrongUserResponse = await completeGithubOauth(callbackRequest, env, { fetchImpl: wrongUserFetch, nowSeconds: FIXED_NOW });
assert.equal(wrongUserResponse.status, 403);
assert.equal((await wrongUserResponse.json()).code, 'ADMIN_IDENTITY_REJECTED');

const broadScopeFetch = async url => {
  if (String(url).includes('/login/oauth/access_token')) return new Response(JSON.stringify({ access_token: oauthAccessToken, scope: 'repo', token_type: 'bearer' }), { status: 200, headers: { 'content-type': 'application/json' } });
  throw new Error('identity-fetch-must-not-run');
};
const broadScopeResponse = await completeGithubOauth(callbackRequest, env, { fetchImpl: broadScopeFetch, nowSeconds: FIXED_NOW });
assert.equal(broadScopeResponse.status, 403, 'token com escopo GitHub não vazio deve ser rejeitado');

const gate = publicationGate(env);
assert.equal(gate.enabled, true);
assert.equal(gate.authenticationMode, 'github-oauth');
assert.equal(gate.directMainPushAllowed, false);
assert.equal(gate.automaticMergeAllowed, false);

assert.equal(crypto.webcrypto !== undefined || globalThis.crypto !== undefined, true);

console.log(JSON.stringify({
  o4GithubOauthAuth: 'PASS',
  contract: CENTRAL_CONTRACTS.authentication.githubOAuth.contract,
  provider: CENTRAL_CONTRACTS.authentication.provider,
  pkce: true,
  oauthState: true,
  requestedScopes: [],
  allowedIdentity: 'github-user-id-plus-login',
  tamperedSessionRejected: true,
  wrongUserRejected: true,
  broadScopeRejected: true,
  oauthTokenStored: false,
  oauthTokenSentToBrowser: false,
  workflowCredentialSeparate: true,
  publicCatalogMutation: false,
  directMainPushAllowed: false,
  automaticMergeAllowed: false,
}, null, 2));
