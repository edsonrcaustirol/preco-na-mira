#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CENTRAL_CONTRACTS } from '../central/src/contracts.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const centralConfig = JSON.parse(read('central/wrangler.jsonc'));
const workflow = read('.github/workflows/deploy-central-free.yml');
const docs = read('docs/CENTRAL-OPERACIONAL.md');
const runtime = read('central/src/runtime-worker.mjs');
const oauth = read('central/src/github-oauth-auth.mjs');

assert.equal(centralConfig.name, 'preco-na-mira-central');
assert.equal(centralConfig.main, 'src/runtime-worker.mjs');
assert.equal(centralConfig.workers_dev, false);
assert.equal(centralConfig.preview_urls, false);
assert.equal(centralConfig.vars?.PNM_CENTRAL_AUTH_MODE, 'github-oauth');
assert.equal(centralConfig.vars?.PNM_CENTRAL_EXPECTED_HOST, 'central.preconamira.com.br');
assert.equal(centralConfig.vars?.PNM_GITHUB_ALLOWED_USER_ID, '315643281');
assert.equal(centralConfig.vars?.PNM_GITHUB_ALLOWED_LOGIN, 'edsonrcaustirol');
assert.equal(Array.isArray(centralConfig.routes), true);
assert.equal(centralConfig.routes.length, 1);
assert.deepEqual(centralConfig.routes[0], {
  pattern: 'central.preconamira.com.br',
  custom_domain: true,
});
assert.equal('d1_databases' in centralConfig, false, 'primeiro deploy gratuito não deve exigir D1');
assert.equal('PNM_CENTRAL_ACCESS_AUD' in centralConfig.vars, false);
assert.equal('PNM_CENTRAL_ACCESS_ISSUER' in centralConfig.vars, false);

assert.equal(CENTRAL_CONTRACTS.authentication.provider, 'github-oauth');
assert.equal(CENTRAL_CONTRACTS.authentication.githubOAuth.pkce, true);
assert.equal(CENTRAL_CONTRACTS.authentication.githubOAuth.stateRequired, true);
assert.deepEqual(CENTRAL_CONTRACTS.authentication.githubOAuth.requestedScopes, []);
assert.equal(CENTRAL_CONTRACTS.authentication.githubOAuth.oauthTokenStored, false);
assert.equal(CENTRAL_CONTRACTS.authentication.githubOAuth.oauthTokenSentToBrowser, false);

assert.match(runtime, /handleGithubOauthCentralRequest/);
assert.match(oauth, /code_challenge_method/);
assert.match(oauth, /PNM_GITHUB_ALLOWED_USER_ID/);
assert.match(oauth, /__Host-pnm_central_session/);
assert.match(oauth, /HttpOnly; Secure; SameSite=Lax/);

assert.match(workflow, /workflow_dispatch:/);
assert.match(workflow, /CLOUDFLARE_API_TOKEN/);
assert.match(workflow, /PNM_GITHUB_OAUTH_CLIENT_SECRET/);
assert.match(workflow, /PNM_GITHUB_TOKEN/);
assert.match(workflow, /wrangler deploy --config central\/wrangler\.jsonc/);
assert.match(workflow, /wrangler secret put PNM_CENTRAL_SESSION_SECRET/);
assert.equal(/schedule:|push:\s*\n/m.test(workflow), false, 'deploy administrativo deve continuar manual');

assert.match(docs, /GitHub OAuth \+ PKCE/);
assert.match(docs, /Zero Trust \/ Access \*\*não é requisito de produção\*\*/);
assert.match(docs, /sem cadastrar cartão de crédito/);
assert.match(docs, /central\.preconamira\.com\.br\/auth\/github\/callback/);
assert.match(docs, /PNM_GITHUB_OAUTH_CLIENT_SECRET/);
assert.match(docs, /PNM_GITHUB_TOKEN/);

console.log(JSON.stringify({
  p2CentralFree: 'PASS',
  worker: centralConfig.name,
  customDomain: centralConfig.routes[0].pattern,
  auth: CENTRAL_CONTRACTS.authentication.provider,
  pkce: true,
  d1RequiredForFirstDeploy: false,
  zeroTrustRequired: false,
  creditCardDependency: false,
  deployMode: 'manual-fail-closed',
}, null, 2));
