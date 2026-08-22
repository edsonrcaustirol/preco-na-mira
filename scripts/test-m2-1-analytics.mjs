import assert from 'node:assert/strict';
import { ACCEPTED_EVENTS, DATASET, PLACEMENTS, QUERY_DEFINITIONS, SCHEMA, executeQuery, getQuery, listQueries } from './m2-1-analytics-lib.mjs';

assert.equal(DATASET, 'pnm_commercial_m1');
assert.deepEqual(ACCEPTED_EVENTS, ['page_view', 'affiliate_click']);
assert.equal(SCHEMA.event_index, 'index1');
assert.equal(SCHEMA.version, 'blob1');
assert.equal(SCHEMA.event, 'blob2');
assert.equal(SCHEMA.page, 'blob3');
assert.equal(SCHEMA.page_type, 'blob4');
assert.equal(SCHEMA.product_id, 'blob5');
assert.equal(SCHEMA.store, 'blob6');
assert.equal(SCHEMA.placement, 'blob7');
assert.equal(SCHEMA.host, 'blob12');
assert.equal(SCHEMA.weight, 'double1');
assert.equal(PLACEMENTS.length, 14);

const requiredMetrics = [
  'total_page_views','total_affiliate_clicks','affiliate_clicks_by_product','affiliate_clicks_by_page',
  'affiliate_clicks_by_placement','affiliate_clicks_by_store','top_products','top_commercial_pages',
  'events_by_hour','affiliate_click_rate_by_page',
];
const requiredQuality = [
  'unknown_event_types','missing_affiliate_click_fields','unexpected_affiliate_values',
  'schema_incompatibilities','possible_technical_duplicates',
];
for (const name of requiredMetrics) assert.equal(getQuery(name).group, 'metrics', `${name} deve ser métrica`);
for (const name of requiredQuality) assert.equal(getQuery(name).group, 'quality', `${name} deve ser qualidade`);
assert.equal(listQueries('metrics').length, requiredMetrics.length);
assert.equal(listQueries('quality').length, requiredQuality.length);

for (const [name, query] of Object.entries(QUERY_DEFINITIONS)) {
  assert.match(query.sql, /FROM pnm_commercial_m1/, `${name}: dataset incorreto`);
  assert.doesNotMatch(`${query.description}\n${query.sql}`, /taxa de convers[aã]o|conversion rate/i, `${name}: nomenclatura proibida`);
  assert.doesNotMatch(query.sql, /amazon|shopee/i, `${name}: segunda loja não permitida`);
}
assert.match(getQuery('affiliate_click_rate_by_page').description, /Taxa de clique afiliado/);
assert.match(getQuery('affiliate_click_rate_by_page').sql, /GROUP BY page/);
assert.match(getQuery('affiliate_click_rate_by_page').sql, /page_view/);
assert.match(getQuery('affiliate_click_rate_by_page').sql, /affiliate_click/);
assert.match(getQuery('possible_technical_duplicates').description, /Heurística/);

let captured;
const fakeFetch = async (url, options) => {
  captured = { url, options };
  return new Response(JSON.stringify({ data: [{ page_views: 3 }] }), { status: 200 });
};
const result = await executeQuery('total_page_views', {
  accountId: '0123456789abcdef0123456789abcdef',
  apiToken: 'x',
  fetchImpl: fakeFetch,
});
assert.equal(captured.url, 'https://api.cloudflare.com/client/v4/accounts/0123456789abcdef0123456789abcdef/analytics_engine/sql');
assert.equal(captured.options.method, 'POST');
assert.equal(captured.options.headers.Authorization, 'Bearer x');
assert.equal(captured.options.body, getQuery('total_page_views').sql);
assert.deepEqual(result, { data: [{ page_views: 3 }] });
await assert.rejects(() => executeQuery('total_page_views', { apiToken: 'x', fetchImpl: fakeFetch }), /PNM_CF_ACCOUNT_ID/);
await assert.rejects(() => executeQuery('total_page_views', { accountId: 'x', fetchImpl: fakeFetch }), /PNM_CF_ANALYTICS_TOKEN/);

console.log('M2.1 analytics tests: OK');
