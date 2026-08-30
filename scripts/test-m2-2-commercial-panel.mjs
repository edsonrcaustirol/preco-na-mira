import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Buffer } from 'node:buffer';
import { handleCommercialPanel } from '../src/commercial-panel.mjs';
import worker from '../src/index.mjs';

const PANEL_PATH = '/__pnm/commercial';
const accountId = '1234567890abcdef1234567890abcdef';
const token = ['pnm', 'test', 'analytics', 'token'].join('-');
const panelPassword = ['pnm', 'test', 'panel', 'password'].join('-');
const auth = `Basic ${Buffer.from(`admin:${panelPassword}`).toString('base64')}`;
const environment = {
  PNM_CF_ACCOUNT_ID: accountId,
  PNM_CF_ANALYTICS_TOKEN: token,
  PNM_PANEL_PASSWORD: panelPassword,
};

const fakeRows = [
  { total_page_views: 100 },
  { total_affiliate_clicks: 10 },
  { pathname: '/produto-a', affiliate_clicks: 5 },
  { product_id: 'produto-a', affiliate_clicks: 5 },
  { placement: 'product-main', affiliate_clicks: 5 },
  { total_commercial_impressions: 20 },
  { placement: 'product-main', commercial_impressions: 10 },
  { placement: 'product-main', commercial_impressions: 10, affiliate_clicks: 5, affiliate_click_rate: 0.5 },
  { channel: 'direct', page_views: 42 },
];

let queryIndex = 0;
const fakeFetch = async (_url, options = {}) => {
  assert.equal(options.method, 'POST');
  assert.match(String(options.headers?.authorization || ''), /^Bearer /);
  const current = fakeRows[Math.min(queryIndex, fakeRows.length - 1)];
  queryIndex += 1;
  return new Response(JSON.stringify({ data: [current], meta: [], rows: 1, rows_before_limit_at_least: 1 }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

{
  queryIndex = 0;
  const response = await handleCommercialPanel(
    new Request(`https://preconamira.com.br${PANEL_PATH}`, { headers: { authorization: auth } }),
    environment,
    { fetchImpl: fakeFetch },
  );
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Painel Comercial/);
  assert.match(html, /100/);
  assert.match(html, /10/);
  assert.doesNotMatch(html, new RegExp(token));
  assert.doesNotMatch(html, new RegExp(panelPassword));
}

{
  const noConfig = await handleCommercialPanel(new Request(`https://preconamira.com.br${PANEL_PATH}`), {}, { fetchImpl: fakeFetch });
  assert.equal(noConfig.status, 503);
}

{
  const noAuth = await handleCommercialPanel(new Request(`https://preconamira.com.br${PANEL_PATH}`), environment, { fetchImpl: fakeFetch });
  assert.equal(noAuth.status, 401);
}

{
  const wrongAuth = `Basic ${Buffer.from('admin:wrong').toString('base64')}`;
  const response = await handleCommercialPanel(
    new Request(`https://preconamira.com.br${PANEL_PATH}`, { headers: { authorization: wrongAuth } }),
    environment,
    { fetchImpl: fakeFetch },
  );
  assert.equal(response.status, 401);
}

{
  const badAccount = { ...environment, PNM_CF_ACCOUNT_ID: 'not-valid' };
  const response = await handleCommercialPanel(
    new Request(`https://preconamira.com.br${PANEL_PATH}`, { headers: { authorization: auth } }),
    badAccount,
    { fetchImpl: fakeFetch },
  );
  assert.equal(response.status, 503);
}

{
  let count = 0;
  const partialFetch = async () => {
    count += 1;
    if (count === 9) {
      return new Response(JSON.stringify({ code: 10000, message: 'query rejected' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }
    const current = fakeRows[Math.min(count - 1, fakeRows.length - 1)];
    return new Response(JSON.stringify({ data: [current], meta: [], rows: 1, rows_before_limit_at_least: 1 }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const response = await handleCommercialPanel(
    new Request(`https://preconamira.com.br${PANEL_PATH}`, { headers: { authorization: auth } }),
    environment,
    { fetchImpl: partialFetch },
  );
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.match(body, /Painel Comercial/);
}

{
  const diagnosticToken = ['cloudflare', 'raw', 'secret'].join('-');
  const diagnosticPanelPassword = ['diagnostic', 'panel', 'password'].join('-');
  const diagnosticAuth = `Basic ${Buffer.from(`admin:${diagnosticPanelPassword}`).toString('base64')}`;
  const diagnosticEnvironment = {
    PNM_CF_ACCOUNT_ID: accountId,
    PNM_CF_ANALYTICS_TOKEN: diagnosticToken,
    PNM_PANEL_PASSWORD: diagnosticPanelPassword,
  };
  const logs = [];
  const originalConsoleError = console.error;
  console.error = (...args) => logs.push(args.join(' '));
  const failFetch = async () => {
    throw new Error('transport failure');
  };
  let response;
  try {
    response = await handleCommercialPanel(
      new Request(`https://preconamira.com.br${PANEL_PATH}`, { headers: { authorization: diagnosticAuth } }),
      diagnosticEnvironment,
      { fetchImpl: failFetch },
    );
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(response.status, 502);
  const body = await response.text();
  const combined = `${body}\n${logs.join('\n')}`;
  assert.match(body, /Não foi possível consultar as métricas comerciais/);
  assert.doesNotMatch(combined, new RegExp(diagnosticToken));
  assert.doesNotMatch(combined, new RegExp(diagnosticPanelPassword));
  assert.doesNotMatch(combined, new RegExp(accountId));
  assert.doesNotMatch(combined, /cloudflare-raw-secret|Bearer SECRET|PNM_CF_ANALYTICS_TOKEN|PNM_PANEL_PASSWORD/);
  assert.doesNotMatch(combined, /https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\//);
  assert.doesNotMatch(combined, /SELECT\s+\*/i);
}

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

{
  const canonical = fs.readFileSync(new URL('../data/produtos-index.js', import.meta.url), 'utf8');
  const match = canonical.match(/^const\s+PRODUTOS\s*=\s*(\[[\s\S]*\]);?\s*$/);
  assert.ok(match, 'owner canônico deve continuar parseável');
  const products = JSON.parse(match[1]);
  assert.ok(products.length > 0, 'owner canônico deve conter produtos');
  assert.equal(new Set(products.map(item => item.id)).size, products.length, 'IDs devem permanecer únicos para qualquer tamanho válido de catálogo');
  assert.equal(products.filter(item => String(item.linkAfiliado || '')).length, products.length, 'todo produto deve manter link afiliado para qualquer tamanho válido de catálogo');
}

console.log('M2.2 + C2 commercial funnel panel tests: OK');
