import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker from '../src/worker.mjs';
import {
  C2_PERIOD,
  C2_THRESHOLDS,
  M31_START_UTC,
  PANEL_PATH,
  handleCommercialPanel,
  loadCommercialDashboard,
  parseCanonicalProductTitles,
  renderCommercialDashboard,
} from '../src/commercial-panel.mjs';
import { getQuery as getM2Query, listQueries as listM2Queries } from './m2-1-analytics-lib.mjs';
import { getQuery as getM3Query } from './m3-1-analytics-lib.mjs';

const accountId = '0123456789abcdef0123456789abcdef';
const auth = `Basic ${Buffer.from('pnm:x').toString('base64')}`;
const canonicalSource = 'const PRODUTOS = [{"id":"produto-a","nome":"Produto A Canônico"},{"id":"produto-b","nome":"Produto B Canônico"}];';
const assets = {
  async fetch(request) {
    assert.equal(new URL(request.url).pathname, '/data/produtos-index.js');
    return new Response(canonicalSource, { status: 200 });
  },
};
const environment = {
  PNM_PANEL_PASSWORD: 'x',
  PNM_CF_ACCOUNT_ID: accountId,
  PNM_CF_ANALYTICS_TOKEN: 'x',
  ASSETS: assets,
};

assert.equal(M31_START_UTC, '2026-08-22T05:24:34Z');
assert.equal(PANEL_PATH, '/__pnm/commercial');
assert.equal(C2_PERIOD, 'FIXO');
assert.deepEqual(C2_THRESHOLDS, {
  landingActivity: 10,
  productViews: 5,
  placementImpressions: 20,
  weakPlacementRatio: 0.5,
});
assert.deepEqual(listM2Queries('c2').map(item => item.name).sort(), [
  'page_views_by_channel',
  'page_views_by_landing',
  'product_views_by_channel',
  'product_views_by_landing',
  'product_views_by_product',
  'total_product_views',
].sort());

const fixtures = new Map([
  [getM2Query('total_page_views').sql, { data: [{ page_views: 120 }] }],
  [getM2Query('total_product_views').sql, { data: [{ product_views: 30 }] }],
  [getM2Query('total_affiliate_clicks').sql, { data: [{ affiliate_clicks: 20 }] }],
  [getM3Query('total_commercial_impressions').sql, { data: [{ commercial_impressions: 80 }] }],

  [getM2Query('page_views_by_channel').sql, { data: [{ channel: 'organic', page_views: 80 }, { channel: 'direct', page_views: 40 }] }],
  [getM2Query('product_views_by_channel').sql, { data: [{ channel: 'organic', product_views: 25 }, { channel: 'direct', product_views: 5 }] }],
  [getM2Query('affiliate_clicks_by_channel').sql, { data: [{ channel: 'organic', affiliate_clicks: 12 }, { channel: 'direct', affiliate_clicks: 8 }] }],

  [getM2Query('page_views_by_landing').sql, { data: [{ landing: '/guia', page_views: 70 }, { landing: '/ofertas', page_views: 50 }] }],
  [getM2Query('product_views_by_landing').sql, { data: [{ landing: '/guia', product_views: 25 }, { landing: '/ofertas', product_views: 5 }] }],
  [getM2Query('affiliate_clicks_by_landing').sql, { data: [{ landing: '/guia', affiliate_clicks: 12 }, { landing: '/ofertas', affiliate_clicks: 8 }] }],

  [getM2Query('product_views_by_product').sql, { data: [{ product_id: 'produto-a', product_views: 20 }, { product_id: 'produto-b', product_views: 10 }] }],
  [getM2Query('affiliate_clicks_by_product').sql, { data: [{ product_id: 'produto-a', affiliate_clicks: 7 }, { product_id: 'produto-b', affiliate_clicks: 0 }] }],
  [getM3Query('affiliate_click_rate_by_product', { m31StartUtc: M31_START_UTC }).sql, { data: [
    { product_id: 'produto-a', commercial_impressions: 40, affiliate_clicks: 5, affiliate_click_rate_pct: 12.5 },
    { product_id: 'produto-b', commercial_impressions: 30, affiliate_clicks: 0, affiliate_click_rate_pct: 0 },
  ] }],

  [getM2Query('affiliate_clicks_by_placement').sql, { data: [{ placement: 'card', affiliate_clicks: 15 }, { placement: 'primary', affiliate_clicks: 5 }, { placement: 'related', affiliate_clicks: 4 }] }],
  [getM3Query('impressions_by_placement').sql, { data: [{ placement: 'card', commercial_impressions: 60 }, { placement: 'related', commercial_impressions: 20 }] }],
  [getM3Query('affiliate_click_rate_by_placement', { m31StartUtc: M31_START_UTC }).sql, { data: [
    { placement: 'card', commercial_impressions: 60, affiliate_clicks: 15, affiliate_click_rate_pct: 25 },
    { placement: 'related', commercial_impressions: 20, affiliate_clicks: 4, affiliate_click_rate_pct: 20 },
  ] }],
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
  assert.equal(data.totals.productViews, 30);
  assert.equal(data.totals.affiliateClicks, 20);
  assert.equal(data.totals.commercialImpressions, 80);
  assert.equal(data.summary.status, 'available');
  assert.equal(data.origins.status, 'available');
  assert.equal(data.origins.rows[0].channel, 'organic');
  assert.equal(data.origins.rows[0].affiliateClicks, 12);
  assert.equal(data.origins.rows[0].clickRatePct, 15);
  assert.equal(data.landings.rows[0].landing, '/guia', 'ranking de landing deve priorizar impacto comercial');
  assert.equal(data.landings.rows[0].affiliateClicks, 12);
  assert.equal(data.products.rows[0].product_id, 'produto-a');
  assert.equal(data.products.rows[0].eligibleCtrPct, 12.5);
  assert.equal(data.placements.rows.find(item => item.placement === 'card').eligibleCtrPct, 25);
  assert.equal(capturedSql.length, 16);
}

{
  const titles = parseCanonicalProductTitles(canonicalSource);
  assert.equal(titles.get('produto-a'), 'Produto A Canônico');
  assert.equal(parseCanonicalProductTitles('not-canonical').size, 0);
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
  const response = await handleCommercialPanel(
    new Request(`https://preconamira.com.br${PANEL_PATH}`, { headers: { authorization: auth } }),
    { PNM_PANEL_PASSWORD: 'x' },
    { fetchImpl: fakeFetch },
  );
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
  assert.match(html, /Funil Comercial/);
  assert.match(html, /PAGE VIEWS/);
  assert.match(html, /PRODUCT VIEWS/);
  assert.match(html, /AFFILIATE CLICKS/);
  assert.match(html, /organic/);
  assert.match(html, /\/guia/);
  assert.match(html, /Produto A Canônico/);
  assert.match(html, /produto-a/);
  assert.match(html, /card/);
  assert.match(html, /25,00%/);
  assert.match(html, /Período: FIXO/);
  assert.match(html, /Não representa venda, pedido ou comissão/);
  assert.match(html, /Page view não representa usuário/);
  assert.doesNotMatch(html, /session_id/i);
  assert.doesNotMatch(html, /convers[aã]o|conversion/i);
  assert.doesNotMatch(html, /Bearer x|SELECT\s|PNM_CF_ANALYTICS_TOKEN/);
  assert.doesNotMatch(html, /NaN|Infinity/);
  assert.match(html, /name="viewport"/);
  assert.match(html, /@media\(max-width:820px\)/);
  assert.match(html, /overflow-x:auto/);
  assert.equal(capturedSql.length, 16);
}

{
  const zeroFixtures = new Map();
  for (const sql of fixtures.keys()) {
    if (sql.includes('AS product_views') && !sql.includes('GROUP BY')) {
      zeroFixtures.set(sql, { data: [{ product_views: 0 }] });
    } else if (sql.includes('AS page_views') && !sql.includes('GROUP BY')) {
      zeroFixtures.set(sql, { data: [{ page_views: 0 }] });
    } else if (sql.includes('AS affiliate_clicks') && !sql.includes('GROUP BY') && !sql.includes('commercial_impression')) {
      zeroFixtures.set(sql, { data: [{ affiliate_clicks: 0 }] });
    } else if (sql.includes('AS commercial_impressions') && !sql.includes('GROUP BY')) {
      zeroFixtures.set(sql, { data: [{ commercial_impressions: 0 }] });
    } else {
      zeroFixtures.set(sql, { data: [] });
    }
  }
  const zeroFetch = async (url, options) => new Response(JSON.stringify(zeroFixtures.get(options.body) || { data: [] }), { status: 200 });
  const data = await loadCommercialDashboard({ accountId, apiToken: 'x', fetchImpl: zeroFetch });
  const html = renderCommercialDashboard(data);
  assert.equal(data.origins.status, 'empty');
  assert.equal(data.landings.status, 'empty');
  assert.equal(data.products.status, 'empty');
  assert.match(html, /Ainda não há dados suficientes para esta dimensão/);
  assert.match(html, /Dados insuficientes para classificar oportunidades com segurança/);
  assert.doesNotMatch(html, /NaN|Infinity/);
  assert.doesNotMatch(html, /TRÁFEGO SEM CLIQUE|PRODUTO VISTO SEM CLIQUE|PLACEMENT FRACO/);
}

{
  const failSql = getM2Query('page_views_by_channel').sql;
  const partialFetch = async (url, options) => {
    if (options.body === failSql) return new Response('query rejected', { status: 400 });
    const payload = fixtures.get(options.body);
    assert.ok(payload, 'consulta parcial deve existir no fixture');
    return new Response(JSON.stringify(payload), { status: 200 });
  };
  const data = await loadCommercialDashboard({ accountId, apiToken: 'x', fetchImpl: partialFetch });
  assert.equal(data.origins.status, 'partial');
  assert.equal(data.products.status, 'available');
  assert.ok(data.failures.some(item => item.query === 'page_views_by_channel'));
  const request = new Request(`https://preconamira.com.br${PANEL_PATH}`, { headers: { authorization: auth } });
  const response = await handleCommercialPanel(request, environment, { fetchImpl: partialFetch });
  assert.equal(response.status, 200, 'falha isolada deve degradar parcialmente, não derrubar painel');
  const html = await response.text();
  assert.match(html, /Origens parcialmente disponível/);
  assert.match(html, /Produto A Canônico/);
  assert.doesNotMatch(html, /SELECT\s|Bearer x/);
}

{
  const lowVolumeData = await loadCommercialDashboard({ accountId, apiToken: 'x', fetchImpl: fakeFetch });
  lowVolumeData.landings.rows = [{ landing: '/baixo-volume', pageViews: 3, productViews: 2, affiliateClicks: 0, clickRatePct: 0 }];
  lowVolumeData.products.rows = [{ product_id: 'produto-b', productViews: 2, affiliateClicks: 0, eligibleCtrPct: 0 }];
  lowVolumeData.placements.rows = [{ placement: 'related', commercialImpressions: 5, affiliateClicks: 0, eligibleImpressions: 5, eligibleClicks: 0, eligibleCtrPct: 0 }];
  lowVolumeData.origins.rows = [];
  const html = renderCommercialDashboard(lowVolumeData);
  assert.match(html, /Dados insuficientes para classificar oportunidades com segurança/);
  assert.doesNotMatch(html, /TRÁFEGO SEM CLIQUE|PRODUTO VISTO SEM CLIQUE|PLACEMENT FRACO/);
}

{
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
  const failFetch = async () => new Response(unsafeDiagnosticBody, { status: 400 });
  const logs = [];
  const originalConsoleError = console.error;
  console.error = (...args) => logs.push(args.map(value => typeof value === 'string' ? value : JSON.stringify(value)).join(' '));
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
