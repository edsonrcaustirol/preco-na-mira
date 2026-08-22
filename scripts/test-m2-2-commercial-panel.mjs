import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';
import { M31_START_UTC, PANEL_PATH, handleCommercialPanel, loadCommercialDashboard } from '../src/commercial-panel.mjs';
import { getQuery as getM2Query } from './m2-1-analytics-lib.mjs';
import { getQuery as getM3Query } from './m3-1-analytics-lib.mjs';

const accountId = '0123456789abcdef0123456789abcdef';
const auth = `Basic ${Buffer.from('pnm:x').toString('base64')}`;
const environment = {
  PNM_PANEL_PASSWORD: 'x',
  PNM_CF_ACCOUNT_ID: accountId,
  PNM_CF_ANALYTICS_TOKEN: 'x',
};

assert.equal(M31_START_UTC, '2026-08-22T05:24:34Z');
assert.equal(PANEL_PATH, '/__pnm/commercial');

const fixtures = new Map([
  [getM2Query('total_page_views').sql, { data: [{ page_views: 120 }] }],
  [getM2Query('total_affiliate_clicks').sql, { data: [{ affiliate_clicks: 20 }] }],
  [getM3Query('total_commercial_impressions').sql, { data: [{ commercial_impressions: 80 }] }],
  [getM2Query('affiliate_clicks_by_page').sql, { data: [{ page: 'home', affiliate_clicks: 9 }, { page: 'ofertas', affiliate_clicks: 6 }] }],
  [getM2Query('affiliate_clicks_by_product').sql, { data: [{ product_id: 'produto-a', affiliate_clicks: 7 }] }],
  [getM2Query('affiliate_clicks_by_placement').sql, { data: [{ placement: 'card', affiliate_clicks: 15 }, { placement: 'primary', affiliate_clicks: 5 }] }],
  [getM3Query('impressions_by_placement').sql, { data: [{ placement: 'card', commercial_impressions: 60 }, { placement: 'related', commercial_impressions: 20 }] }],
  [getM3Query('affiliate_click_rate_by_placement', { m31StartUtc: M31_START_UTC }).sql, { data: [{ placement: 'card', commercial_impressions: 60, affiliate_clicks: 15, affiliate_click_rate_pct: 25 }, { placement: 'related', commercial_impressions: 20, affiliate_clicks: 4, affiliate_click_rate_pct: 20 }] }],
]);

const capturedSql = [];
const fakeFetch = async (url, options) => {
  assert.equal(url, `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`);
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.Authorization, 'Bearer x');
  capturedSql.push(options.body);
  const payload = fixtures.get(options.body);
  if (!payload) return new Response('unexpected query', { status: 400 });
  return new Response(JSON.stringify(payload), { status: 200 });
};

{
  const data = await loadCommercialDashboard({ accountId, apiToken: 'x', fetchImpl: fakeFetch });
  assert.equal(data.totals.pageViews, 120);
  assert.equal(data.totals.affiliateClicks, 20);
  assert.equal(data.totals.commercialImpressions, 80);
  assert.equal(data.clicksByProduct[0].product_id, 'produto-a');
  assert.equal(data.impressionsByPlacement[0].placement, 'card');
  assert.equal(data.ctrByPlacement[0].affiliate_click_rate_pct, 25);
  assert.equal(capturedSql.length, 8);
  const ctrSql = getM3Query('affiliate_click_rate_by_placement', { m31StartUtc: M31_START_UTC }).sql;
  assert.ok(capturedSql.includes(ctrSql));
  assert.match(ctrSql, /timestamp >= toDateTime\('2026-08-22 05:24:34', 'Etc\/UTC'\)/);
  assert.match(ctrSql, /blob7 IN \('card', 'related'\)/);
}

{
  const response = await handleCommercialPanel(new Request(`https://preconamira.com.br${PANEL_PATH}`), {}, { fetchImpl: fakeFetch });
  assert.equal(response.status, 503, 'sem senha configurada deve falhar fechado');
}

{
  const response = await handleCommercialPanel(new Request(`https://preconamira.com.br${PANEL_PATH}`), environment, { fetchImpl: fakeFetch });
  assert.equal(response.status, 401);
  assert.match(response.headers.get('www-authenticate') || '', /^Basic /);
}

{
  const response = await handleCommercialPanel(new Request(`https://preconamira.com.br${PANEL_PATH}`, { headers: { authorization: auth } }), { PNM_PANEL_PASSWORD: 'x' }, { fetchImpl: fakeFetch });
  assert.equal(response.status, 503, 'sem credenciais de leitura deve falhar fechado após autenticação');
}

{
  capturedSql.length = 0;
  const request = new Request(`https://preconamira.com.br${PANEL_PATH}`, { headers: { authorization: auth } });
  const response = await handleCommercialPanel(request, environment, { fetchImpl: fakeFetch });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control') || '', /no-store/);
  assert.match(response.headers.get('content-security-policy') || '', /default-src 'none'/);
  const html = await response.text();
  assert.match(html, /Painel Comercial/);
  assert.match(html, />120</);
  assert.match(html, />20</);
  assert.match(html, />80</);
  assert.match(html, /produto-a/);
  assert.match(html, /card/);
  assert.match(html, /related/);
  assert.match(html, /25,00%/);
  assert.match(html, /2026-08-22 05:24:34 UTC/);
  assert.match(html, /Não representa venda, pedido ou comissão/);
  assert.doesNotMatch(html, /convers[aã]o|conversion/i);
  assert.doesNotMatch(html, /Bearer x|SELECT\s|PNM_CF_ANALYTICS_TOKEN/);
  assert.equal(capturedSql.length, 8);
}

{
  const originalFetch = globalThis.fetch;
  let runtimeFetchCalls = 0;
  globalThis.fetch = async function receiverSensitiveFetch(url, options) {
    assert.equal(this, undefined, 'fetch runtime não deve receber options como receiver');
    runtimeFetchCalls += 1;
    assert.equal(url, `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`);
    const payload = fixtures.get(options.body);
    assert.ok(payload, 'consulta não prevista no fixture de receiver');
    return new Response(JSON.stringify(payload), { status: 200 });
  };
  try {
    const request = new Request(`https://preconamira.com.br${PANEL_PATH}`, { headers: { authorization: auth } });
    const response = await handleCommercialPanel(request, environment);
    assert.equal(response.status, 200);
    assert.equal(runtimeFetchCalls, 8);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const diagnosticPanelPassword = ['panel', 'password', 'do-not-log'].join('-');
const diagnosticToken = ['analytics', 'token', 'do-not-log'].join('-');
const diagnosticAuth = `Basic ${Buffer.from(`pnm:${diagnosticPanelPassword}`).toString('base64')}`;
const diagnosticEnvironment = {
  PNM_PANEL_PASSWORD: diagnosticPanelPassword,
  PNM_CF_ACCOUNT_ID: accountId,
  PNM_CF_ANALYTICS_TOKEN: diagnosticToken,
};
const unsafeDiagnosticBody = [
  'cloudflare-raw-secret',
  'Authorization: Bearer SECRET',
  `token=${diagnosticToken}`,
  `password=${diagnosticPanelPassword}`,
  `PNM_CF_ANALYTICS_TOKEN=${diagnosticToken}`,
  `PNM_PANEL_PASSWORD=${diagnosticPanelPassword}`,
  `account=${accountId}`,
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`,
  'SELECT * FROM pnm_commercial_m1',
].join('; ');

async function assertApiFailure({ status, category, failSql = null, expectedDiagnostic = '', responseBody = unsafeDiagnosticBody, expectedDetail = '', expectedDetailCount = null }) {
  const diagnosticFetch = async (url, options) => {
    assert.equal(url, `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`);
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, `Bearer ${diagnosticToken}`);
    if (!failSql || options.body === failSql) return new Response(responseBody, { status });
    const payload = fixtures.get(options.body);
    assert.ok(payload, 'consulta não prevista no fixture de diagnóstico');
    return new Response(JSON.stringify(payload), { status: 200 });
  };

  const logs = [];
  const originalConsoleError = console.error;
  console.error = (...args) => logs.push(args.map(value => typeof value === 'string' ? value : JSON.stringify(value)).join(' '));
  let response;
  try {
    const request = new Request(`https://preconamira.com.br${PANEL_PATH}`, { headers: { authorization: diagnosticAuth } });
    response = await handleCommercialPanel(request, diagnosticEnvironment, { fetchImpl: diagnosticFetch });
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(response.status, 502);
  const body = await response.text();
  const combined = `${body}\n${logs.join('\n')}`;
  assert.match(body, new RegExp(`HTTP ${status}`));
  assert.match(body, new RegExp(category));
  if (expectedDiagnostic) assert.match(body, new RegExp(expectedDiagnostic.replaceAll('.', '\\.')));
  if (expectedDetail) assert.match(body, new RegExp(expectedDetail.replaceAll('.', '\\.')));
  if (expectedDetailCount !== null) assert.equal((body.match(/— detalhe:/g) || []).length, expectedDetailCount);
  assert.doesNotMatch(combined, new RegExp(diagnosticToken));
  assert.doesNotMatch(combined, new RegExp(diagnosticPanelPassword));
  assert.doesNotMatch(combined, new RegExp(accountId));
  assert.doesNotMatch(combined, /cloudflare-raw-secret/);
  assert.doesNotMatch(combined, /Bearer SECRET/);
  assert.doesNotMatch(combined, /PNM_CF_ANALYTICS_TOKEN|PNM_PANEL_PASSWORD/);
  assert.doesNotMatch(combined, /https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\//);
  assert.doesNotMatch(combined, /SELECT\s+\*/i);
  assert.ok(logs.some(line => line.includes('PNM commercial panel diagnostics')));
}

await assertApiFailure({ status: 401, category: 'authentication' });
await assertApiFailure({ status: 403, category: 'authorization' });
await assertApiFailure({
  status: 400,
  category: 'query_rejected',
  failSql: getM3Query('affiliate_click_rate_by_placement', { m31StartUtc: M31_START_UTC }).sql,
  expectedDiagnostic: 'M3.1:affiliate_click_rate_by_placement',
  expectedDetailCount: 1,
});
await assertApiFailure({
  status: 400,
  category: 'query_rejected',
  responseBody: 'Table does not exist',
  expectedDiagnostic: 'M2.1:total_page_views',
  expectedDetail: 'Table does not exist',
  expectedDetailCount: 1,
});
await assertApiFailure({ status: 503, category: 'cloudflare_5xx' });

{
  const request = new Request(`https://preconamira.com.br${PANEL_PATH}`, { method: 'POST', headers: { authorization: auth } });
  const response = await handleCommercialPanel(request, environment, { fetchImpl: fakeFetch });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET');
}

{
  const response = await worker.fetch(new Request(`https://preconamira.com.br${PANEL_PATH}`), { PNM_PANEL_PASSWORD: 'x' });
  assert.equal(response.status, 401, 'Worker deve rotear painel antes de ASSETS');
}

console.log('M2.2 commercial panel tests: OK');