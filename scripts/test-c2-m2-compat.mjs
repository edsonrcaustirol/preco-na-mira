import assert from 'node:assert/strict';
import { M31_START_UTC, PANEL_PATH, handleCommercialPanel } from '../src/commercial-panel.mjs';
import { getQuery as getM2Query } from './m2-1-analytics-lib.mjs';
import { getQuery as getM3Query } from './m3-1-analytics-lib.mjs';

const accountId = '0123456789abcdef0123456789abcdef';
const panelPassword = 'compat-password';
const apiToken = 'compat-token';
const auth = `Basic ${Buffer.from(`pnm:${panelPassword}`).toString('base64')}`;
const environment = {
  PNM_PANEL_PASSWORD: panelPassword,
  PNM_CF_ACCOUNT_ID: accountId,
  PNM_CF_ANALYTICS_TOKEN: apiToken,
};

const fixtures = new Map([
  [getM2Query('total_page_views').sql, { data: [{ page_views: 120 }] }],
  [getM2Query('total_product_views').sql, { data: [{ product_views: 30 }] }],
  [getM2Query('total_affiliate_clicks').sql, { data: [{ affiliate_clicks: 20 }] }],
  [getM3Query('total_commercial_impressions').sql, { data: [{ commercial_impressions: 80 }] }],
  [getM2Query('page_views_by_channel').sql, { data: [{ channel: 'organic', page_views: 80 }] }],
  [getM2Query('product_views_by_channel').sql, { data: [{ channel: 'organic', product_views: 25 }] }],
  [getM2Query('affiliate_clicks_by_channel').sql, { data: [{ channel: 'organic', affiliate_clicks: 12 }] }],
  [getM2Query('page_views_by_landing').sql, { data: [{ landing: '/guia', page_views: 70 }] }],
  [getM2Query('product_views_by_landing').sql, { data: [{ landing: '/guia', product_views: 25 }] }],
  [getM2Query('affiliate_clicks_by_landing').sql, { data: [{ landing: '/guia', affiliate_clicks: 12 }] }],
  [getM2Query('product_views_by_product').sql, { data: [{ product_id: 'produto-a', product_views: 20 }] }],
  [getM2Query('affiliate_clicks_by_product').sql, { data: [{ product_id: 'produto-a', affiliate_clicks: 7 }] }],
  [getM3Query('affiliate_click_rate_by_product', { m31StartUtc: M31_START_UTC }).sql, { data: [{ product_id: 'produto-a', commercial_impressions: 40, affiliate_clicks: 5, affiliate_click_rate_pct: 12.5 }] }],
  [getM2Query('affiliate_clicks_by_placement').sql, { data: [{ placement: 'card', affiliate_clicks: 15 }] }],
  [getM3Query('impressions_by_placement').sql, { data: [{ placement: 'card', commercial_impressions: 60 }] }],
  [getM3Query('affiliate_click_rate_by_placement', { m31StartUtc: M31_START_UTC }).sql, { data: [{ placement: 'card', commercial_impressions: 60, affiliate_clicks: 15, affiliate_click_rate_pct: 25 }] }],
]);

function successResponse(sql) {
  const payload = fixtures.get(sql);
  assert.ok(payload, `consulta de compatibilidade não prevista: ${String(sql).slice(0, 80)}`);
  return new Response(JSON.stringify(payload), { status: 200 });
}

{
  const originalFetch = globalThis.fetch;
  let runtimeFetchCalls = 0;
  globalThis.fetch = async function receiverSensitiveFetch(url, options) {
    assert.equal(this, undefined, 'fetch runtime não deve receber options como receiver');
    runtimeFetchCalls += 1;
    assert.equal(url, `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`);
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, `Bearer ${apiToken}`);
    return successResponse(options.body);
  };
  try {
    const response = await handleCommercialPanel(
      new Request(`https://preconamira.com.br${PANEL_PATH}`, { headers: { authorization: auth } }),
      environment,
    );
    assert.equal(response.status, 200);
    assert.equal(runtimeFetchCalls, 16, 'runtime fetch deve executar todas as consultas do painel sem receiver incorreto');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function assertAllQueriesFailure({ status, category, responseBody }) {
  const diagnosticFetch = async (url, options) => {
    assert.equal(url, `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`);
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, `Bearer ${apiToken}`);
    return new Response(responseBody, { status });
  };
  const logs = [];
  const originalConsoleError = console.error;
  console.error = (...args) => logs.push(args.map(value => typeof value === 'string' ? value : JSON.stringify(value)).join(' '));
  let response;
  try {
    response = await handleCommercialPanel(
      new Request(`https://preconamira.com.br${PANEL_PATH}`, { headers: { authorization: auth } }),
      environment,
      { fetchImpl: diagnosticFetch },
    );
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(response.status, 502, 'falha de todas as consultas deve derrubar somente o painel, não vazar detalhes');
  const body = await response.text();
  const combined = `${body}\n${logs.join('\n')}`;
  assert.match(body, new RegExp(`HTTP ${status}`));
  assert.match(body, new RegExp(category));
  assert.doesNotMatch(combined, new RegExp(apiToken));
  assert.doesNotMatch(combined, new RegExp(panelPassword));
  assert.doesNotMatch(combined, new RegExp(accountId));
  assert.doesNotMatch(combined, /Bearer\s+compat-token|PNM_CF_ANALYTICS_TOKEN|PNM_PANEL_PASSWORD/);
  assert.doesNotMatch(combined, /https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\//);
  assert.ok(logs.some(line => line.includes('PNM commercial panel diagnostics')));
  return body;
}

await assertAllQueriesFailure({ status: 401, category: 'authentication', responseBody: 'authentication failed' });
await assertAllQueriesFailure({ status: 403, category: 'authorization', responseBody: 'authorization failed' });
await assertAllQueriesFailure({ status: 503, category: 'cloudflare_5xx', responseBody: 'temporarily unavailable' });
const rejectedBody = await assertAllQueriesFailure({ status: 400, category: 'query_rejected', responseBody: 'Table does not exist' });
assert.match(rejectedBody, /M2\.1:total_page_views/);
assert.match(rejectedBody, /Table does not exist/);
assert.doesNotMatch(rejectedBody, /SELECT\s/i);

{
  const failSql = getM3Query('affiliate_click_rate_by_placement', { m31StartUtc: M31_START_UTC }).sql;
  const partialFetch = async (url, options) => {
    assert.equal(url, `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`);
    if (options.body === failSql) return new Response('query rejected', { status: 400 });
    return successResponse(options.body);
  };
  const logs = [];
  const originalConsoleError = console.error;
  console.error = (...args) => logs.push(args.map(value => typeof value === 'string' ? value : JSON.stringify(value)).join(' '));
  let response;
  try {
    response = await handleCommercialPanel(
      new Request(`https://preconamira.com.br${PANEL_PATH}`, { headers: { authorization: auth } }),
      environment,
      { fetchImpl: partialFetch },
    );
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(response.status, 200, 'uma consulta isolada deve degradar parcialmente no C2');
  const html = await response.text();
  assert.match(html, /Placements parcialmente disponível/);
  const combined = `${html}\n${logs.join('\n')}`;
  assert.ok(logs.some(line => line.includes('PNM commercial panel partial diagnostics')));
  assert.ok(logs.some(line => line.includes('M3.1') && line.includes('affiliate_click_rate_by_placement') && line.includes('query_rejected')));
  assert.doesNotMatch(combined, /SELECT\s|Bearer\s+compat-token/);
}

console.log('C2 M2 transport + diagnostics compatibility tests: OK');
