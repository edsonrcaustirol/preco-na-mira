import { analyzeNewProductInput } from './new-product.mjs';

export const CENTRAL_NEW_PRODUCT_TRANSACTION_CONTRACT = 'pnm.central-new-product-transaction/v1';
export const O3_EXPECTED_REPOSITORY = 'edsonrcaustirol/preco-na-mira';
export const O3_EXPECTED_BASE_BRANCH = 'main';
export const O3_EXPECTED_WORKFLOW = 'o3-new-product-transaction.yml';

const REQUIRED_GITHUB_SERVER_CONFIG = Object.freeze([
  'PNM_GITHUB_REPOSITORY',
  'PNM_GITHUB_BASE_BRANCH',
  'PNM_GITHUB_WORKFLOW',
  'PNM_GITHUB_TOKEN',
]);

const CLOUDFLARE_ACCESS_SERVER_CONFIG = Object.freeze([
  'PNM_CENTRAL_ACCESS_AUD',
  'PNM_CENTRAL_ACCESS_ISSUER',
  'PNM_CENTRAL_EXPECTED_HOST',
]);

const GITHUB_OAUTH_SERVER_CONFIG = Object.freeze([
  'PNM_CENTRAL_AUTH_MODE',
  'PNM_CENTRAL_EXPECTED_HOST',
  'PNM_GITHUB_OAUTH_CLIENT_ID',
  'PNM_GITHUB_OAUTH_CLIENT_SECRET',
  'PNM_GITHUB_ALLOWED_USER_ID',
  'PNM_GITHUB_ALLOWED_LOGIN',
  'PNM_CENTRAL_SESSION_SECRET',
]);

const text = value => String(value ?? '').trim();

function repoParts(repository) {
  const [owner, repo, ...rest] = text(repository).split('/');
  if (!owner || !repo || rest.length) throw new Error('invalid-github-repository');
  return { owner, repo };
}

function githubHeaders(token) {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'content-type': 'application/json; charset=utf-8',
    'user-agent': 'preco-na-mira-central',
    'x-github-api-version': '2022-11-28',
  };
}

function githubPublicReadHeaders() {
  return {
    accept: 'application/vnd.github+json',
    'user-agent': 'preco-na-mira-central',
    'x-github-api-version': '2022-11-28',
  };
}

function utf8Base64(value) {
  const bytes = new TextEncoder().encode(String(value));
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x4000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x4000));
  return btoa(binary);
}

export function mercadoLivreListingId(raw) {
  const value = text(raw);
  if (!value) return null;
  let url;
  try { url = new URL(value); } catch { return null; }
  const host = url.hostname.toLowerCase();
  if (!(host === 'mercadolivre.com.br' || host.endsWith('.mercadolivre.com.br'))) return null;
  const match = `${url.pathname}${url.search}`.match(/\bMLB-?(\d{6,})\b/i);
  return match ? `MLB${match[1]}` : null;
}

export function findIdentityConflict(input = {}, products = []) {
  const id = text(input.id);
  if (id && !/^[a-z0-9][a-z0-9-]*$/.test(id)) return { type: 'UNSAFE_ID', id };
  const listingId = mercadoLivreListingId(input.linkAfiliado ?? input.link);
  if (!listingId) return null;
  const product = (Array.isArray(products) ? products : []).find(candidate => mercadoLivreListingId(candidate?.linkAfiliado) === listingId);
  return product ? { type: 'DUPLICATE_LISTING', listingId, product: { id: text(product.id), nome: text(product.nome) } } : null;
}

function authenticationMode(env = {}) {
  return text(env.PNM_CENTRAL_AUTH_MODE || env.PNM_CENTRAL_ACCESS_MODE);
}

export function publicationGate(env = {}) {
  const mode = authenticationMode(env);
  const authRequired = mode === 'github-oauth'
    ? GITHUB_OAUTH_SERVER_CONFIG
    : mode === 'cloudflare-access'
      ? CLOUDFLARE_ACCESS_SERVER_CONFIG
      : [];
  const missing = [...authRequired, ...REQUIRED_GITHUB_SERVER_CONFIG].filter(key => !text(env[key]));
  const mismatches = [];
  if (!['github-oauth', 'cloudflare-access'].includes(mode)) mismatches.push('PNM_CENTRAL_AUTH_MODE');
  if (text(env.PNM_CENTRAL_EXPECTED_HOST) && text(env.PNM_CENTRAL_EXPECTED_HOST) !== 'central.preconamira.com.br') mismatches.push('PNM_CENTRAL_EXPECTED_HOST');
  if (mode === 'github-oauth') {
    if (!/^\d+$/.test(text(env.PNM_GITHUB_ALLOWED_USER_ID)) || Number(env.PNM_GITHUB_ALLOWED_USER_ID) <= 0) mismatches.push('PNM_GITHUB_ALLOWED_USER_ID');
    if (!/^[A-Za-z0-9-]{1,39}$/.test(text(env.PNM_GITHUB_ALLOWED_LOGIN))) mismatches.push('PNM_GITHUB_ALLOWED_LOGIN');
    if (new TextEncoder().encode(text(env.PNM_CENTRAL_SESSION_SECRET)).byteLength < 32) mismatches.push('PNM_CENTRAL_SESSION_SECRET');
  }
  if (text(env.PNM_GITHUB_REPOSITORY) && text(env.PNM_GITHUB_REPOSITORY) !== O3_EXPECTED_REPOSITORY) mismatches.push('PNM_GITHUB_REPOSITORY');
  if (text(env.PNM_GITHUB_BASE_BRANCH) && text(env.PNM_GITHUB_BASE_BRANCH) !== O3_EXPECTED_BASE_BRANCH) mismatches.push('PNM_GITHUB_BASE_BRANCH');
  if (text(env.PNM_GITHUB_WORKFLOW) && text(env.PNM_GITHUB_WORKFLOW) !== O3_EXPECTED_WORKFLOW) mismatches.push('PNM_GITHUB_WORKFLOW');
  return {
    contract: CENTRAL_NEW_PRODUCT_TRANSACTION_CONTRACT,
    authenticationMode: mode || null,
    enabled: missing.length === 0 && mismatches.length === 0,
    missing,
    mismatches,
    directMainPushAllowed: false,
    automaticMergeAllowed: false,
  };
}

export function createTransactionId(randomUUID = () => crypto.randomUUID()) {
  const compact = text(randomUUID()).toLowerCase().replace(/[^a-f0-9]/g, '');
  if (compact.length < 24) throw new Error('transaction-id-source-invalid');
  return `np-${compact.slice(0, 24)}`;
}

export function transactionBranch(transactionId) {
  const id = text(transactionId);
  if (!/^np-[a-f0-9]{24}$/.test(id)) throw new Error('invalid-transaction-id');
  return `central/new-product-${id}`;
}

function safeInputFromAnalysis(analysis) {
  const allowed = ['id', 'nome', 'marca', 'categoria', 'imagem', 'imagemAlt', 'linkAfiliado', 'loja', 'resumo', 'selo', 'oferta', 'destaque'];
  return Object.fromEntries(allowed.filter(key => analysis.previewRecord[key] !== undefined).map(key => [key, analysis.previewRecord[key]]));
}

export async function dispatchNewProductTransaction({ env = {}, input = {}, products = [], fetchImpl = globalThis.fetch, transactionId = null } = {}) {
  const identityConflict = findIdentityConflict(input, products);
  if (identityConflict?.type === 'UNSAFE_ID') return { ok: false, contract: CENTRAL_NEW_PRODUCT_TRANSACTION_CONTRACT, code: 'UNSAFE_ID', state: 'DADOS PENDENTES' };
  if (identityConflict?.type === 'DUPLICATE_LISTING') return { ok: false, contract: CENTRAL_NEW_PRODUCT_TRANSACTION_CONTRACT, code: 'DUPLICATE_PRODUCT', state: 'DUPLICADO', conflict: identityConflict };

  const analysis = analyzeNewProductInput(input, products);
  if (!analysis.canAdvance) {
    return {
      ok: false,
      contract: CENTRAL_NEW_PRODUCT_TRANSACTION_CONTRACT,
      code: analysis.state === 'DUPLICADO' ? 'DUPLICATE_PRODUCT' : analysis.pending.length ? 'BLOQUEADO_POR_DADO' : 'NEW_PRODUCT_BLOCKED',
      state: analysis.state === 'DUPLICADO' ? 'DUPLICADO' : 'DADOS PENDENTES',
      analysis: { state: analysis.state, why: analysis.why, blocking: analysis.blocking, pending: analysis.pending },
    };
  }

  const gate = publicationGate(env);
  if (!gate.enabled) {
    return {
      ok: false,
      contract: CENTRAL_NEW_PRODUCT_TRANSACTION_CONTRACT,
      code: 'PUBLICATION_GATE_CLOSED',
      state: 'DADOS PENDENTES',
      gate: { enabled: false, missing: gate.missing, mismatches: gate.mismatches },
      message: 'Publicação permanece bloqueada até autenticação administrativa e configuração GitHub server-side estarem completas.',
    };
  }
  if (typeof fetchImpl !== 'function') return { ok: false, contract: CENTRAL_NEW_PRODUCT_TRANSACTION_CONTRACT, code: 'GITHUB_BACKEND_UNAVAILABLE', state: 'FALHOU' };

  const id = transactionId || createTransactionId();
  const branch = transactionBranch(id);
  const { owner, repo } = repoParts(env.PNM_GITHUB_REPOSITORY);
  const workflow = encodeURIComponent(env.PNM_GITHUB_WORKFLOW);
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${workflow}/dispatches`;
  const payload = safeInputFromAnalysis(analysis);
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: githubHeaders(env.PNM_GITHUB_TOKEN),
      body: JSON.stringify({ ref: env.PNM_GITHUB_BASE_BRANCH, inputs: { transaction_id: id, payload_b64: utf8Base64(JSON.stringify(payload)) } }),
    });
  } catch {
    return { ok: false, contract: CENTRAL_NEW_PRODUCT_TRANSACTION_CONTRACT, code: 'GITHUB_BACKEND_UNAVAILABLE', state: 'FALHOU' };
  }
  if (response?.status !== 204) return { ok: false, contract: CENTRAL_NEW_PRODUCT_TRANSACTION_CONTRACT, code: 'GITHUB_DISPATCH_FAILED', state: 'FALHOU', githubStatus: Number(response?.status) || null };
  return {
    ok: true,
    contract: CENTRAL_NEW_PRODUCT_TRANSACTION_CONTRACT,
    state: 'PREPARANDO PUBLICAÇÃO',
    transactionId: id,
    branch,
    baseBranch: O3_EXPECTED_BASE_BRANCH,
    statusPath: `/api/new-product/transactions/${id}`,
    directMainPushAllowed: false,
    automaticMergeAllowed: false,
  };
}

export async function getNewProductTransactionStatus({ env = {}, transactionId, fetchImpl = globalThis.fetch } = {}) {
  const gate = publicationGate(env);
  if (!gate.enabled) return { ok: false, contract: CENTRAL_NEW_PRODUCT_TRANSACTION_CONTRACT, code: 'PUBLICATION_GATE_CLOSED', state: 'DADOS PENDENTES' };
  const branch = transactionBranch(transactionId);
  if (typeof fetchImpl !== 'function') return { ok: false, contract: CENTRAL_NEW_PRODUCT_TRANSACTION_CONTRACT, code: 'GITHUB_BACKEND_UNAVAILABLE', state: 'FALHOU' };
  const { owner, repo } = repoParts(env.PNM_GITHUB_REPOSITORY);
  const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const headers = githubHeaders(env.PNM_GITHUB_TOKEN);
  const head = `${owner}:${branch}`;
  let pullResponse;
  try { pullResponse = await fetchImpl(`${base}/pulls?state=all&head=${encodeURIComponent(head)}&per_page=1`, { headers }); }
  catch { return { ok: false, contract: CENTRAL_NEW_PRODUCT_TRANSACTION_CONTRACT, code: 'GITHUB_BACKEND_UNAVAILABLE', state: 'FALHOU' }; }
  if (!pullResponse?.ok) return { ok: false, contract: CENTRAL_NEW_PRODUCT_TRANSACTION_CONTRACT, code: 'GITHUB_STATUS_FAILED', state: 'FALHOU', githubStatus: Number(pullResponse?.status) || null };
  const pulls = await pullResponse.json();
  const pr = Array.isArray(pulls) ? pulls[0] : null;
  if (!pr) return { ok: true, contract: CENTRAL_NEW_PRODUCT_TRANSACTION_CONTRACT, state: 'PREPARANDO PUBLICAÇÃO', transactionId, branch };
  if (pr.merged_at) return { ok: true, contract: CENTRAL_NEW_PRODUCT_TRANSACTION_CONTRACT, state: 'PUBLICADO', transactionId, branch, prNumber: pr.number, prUrl: pr.html_url };
  if (pr.state === 'closed') return { ok: false, contract: CENTRAL_NEW_PRODUCT_TRANSACTION_CONTRACT, state: 'FALHOU', code: 'PR_CLOSED_WITHOUT_MERGE', transactionId, branch, prNumber: pr.number, prUrl: pr.html_url };
  const headSha = text(pr?.head?.sha);
  if (!headSha) return { ok: true, contract: CENTRAL_NEW_PRODUCT_TRANSACTION_CONTRACT, state: 'PR CRIADA', transactionId, branch, prNumber: pr.number, prUrl: pr.html_url };
  let checksResponse;
  try { checksResponse = await fetchImpl(`${base}/commits/${encodeURIComponent(headSha)}/check-runs?per_page=100`, { headers: githubPublicReadHeaders() }); }
  catch { return { ok: true, contract: CENTRAL_NEW_PRODUCT_TRANSACTION_CONTRACT, state: 'PR CRIADA', transactionId, branch, prNumber: pr.number, prUrl: pr.html_url }; }
  if (!checksResponse?.ok) return { ok: true, contract: CENTRAL_NEW_PRODUCT_TRANSACTION_CONTRACT, state: 'PR CRIADA', transactionId, branch, prNumber: pr.number, prUrl: pr.html_url };
  const checksPayload = await checksResponse.json();
  const checks = Array.isArray(checksPayload?.check_runs) ? checksPayload.check_runs : [];
  const failed = checks.some(check => check.status === 'completed' && !['success', 'neutral', 'skipped'].includes(check.conclusion));
  if (failed) return { ok: false, contract: CENTRAL_NEW_PRODUCT_TRANSACTION_CONTRACT, state: 'FALHOU', code: 'CI_FAILED', transactionId, branch, prNumber: pr.number, prUrl: pr.html_url };
  const running = checks.some(check => check.status !== 'completed');
  return { ok: true, contract: CENTRAL_NEW_PRODUCT_TRANSACTION_CONTRACT, state: running ? 'CI EM ANDAMENTO' : 'PR CRIADA', transactionId, branch, prNumber: pr.number, prUrl: pr.html_url };
}
