export const DATASET = 'pnm_commercial_m1';
export const SCHEMA_VERSION = 'm1-v1';
export const ACCEPTED_EVENTS = Object.freeze(['page_view', 'affiliate_click']);
export const PLACEMENTS = Object.freeze([
  'card','primary','sidebar','sticky','related','search_result','saved','cart','comparison','project','studio','small_spaces','obra_base','dewalt_pending'
]);

export const SCHEMA = Object.freeze({
  timestamp: 'timestamp', event_index: 'index1', version: 'blob1', event: 'blob2', page: 'blob3', page_type: 'blob4',
  product_id: 'blob5', store: 'blob6', placement: 'blob7', utm_source: 'blob8', utm_medium: 'blob9', utm_campaign: 'blob10',
  referrer_host: 'blob11', host: 'blob12', landing: 'blob13', channel: 'blob14', session_id: 'blob15',
  weight: 'double1', sample_interval: '_sample_interval',
});

const DATA = DATASET;
const VERSION = SCHEMA_VERSION;
const placementSql = PLACEMENTS.map(value => `'${value}'`).join(', ');
const datasetEventSql = `'page_view', 'affiliate_click', 'commercial_impression'`;

export const QUERY_DEFINITIONS = Object.freeze({
  total_page_views: { group: 'metrics', description: 'Total de page_view válidos do schema M1, ponderado por amostragem.', sql: `SELECT SUM(_sample_interval) AS page_views\nFROM ${DATA}\nWHERE blob1 = '${VERSION}' AND index1 = 'page_view' AND blob2 = 'page_view'` },
  total_affiliate_clicks: { group: 'metrics', description: 'Total de affiliate_click válidos do schema M1, ponderado por amostragem.', sql: `SELECT SUM(_sample_interval) AS affiliate_clicks\nFROM ${DATA}\nWHERE blob1 = '${VERSION}' AND index1 = 'affiliate_click' AND blob2 = 'affiliate_click'` },
  affiliate_clicks_by_product: { group: 'metrics', description: 'Cliques afiliados por product_id.', sql: `SELECT blob5 AS product_id, SUM(_sample_interval) AS affiliate_clicks\nFROM ${DATA}\nWHERE blob1 = '${VERSION}' AND index1 = 'affiliate_click' AND blob2 = 'affiliate_click'\nGROUP BY product_id\nORDER BY affiliate_clicks DESC, product_id\nLIMIT 1000` },
  affiliate_clicks_by_page: { group: 'metrics', description: 'Cliques afiliados por página/origem.', sql: `SELECT blob3 AS page, SUM(_sample_interval) AS affiliate_clicks\nFROM ${DATA}\nWHERE blob1 = '${VERSION}' AND index1 = 'affiliate_click' AND blob2 = 'affiliate_click'\nGROUP BY page\nORDER BY affiliate_clicks DESC, page\nLIMIT 200` },
  affiliate_clicks_by_placement: { group: 'metrics', description: 'Cliques afiliados por placement.', sql: `SELECT blob7 AS placement, SUM(_sample_interval) AS affiliate_clicks\nFROM ${DATA}\nWHERE blob1 = '${VERSION}' AND index1 = 'affiliate_click' AND blob2 = 'affiliate_click'\nGROUP BY placement\nORDER BY affiliate_clicks DESC, placement\nLIMIT 100` },
  affiliate_clicks_by_store: { group: 'metrics', description: 'Cliques afiliados por loja.', sql: `SELECT blob6 AS store, SUM(_sample_interval) AS affiliate_clicks\nFROM ${DATA}\nWHERE blob1 = '${VERSION}' AND index1 = 'affiliate_click' AND blob2 = 'affiliate_click'\nGROUP BY store\nORDER BY affiliate_clicks DESC, store\nLIMIT 100` },
  top_products: { group: 'metrics', description: 'Top 25 produtos por cliques afiliados.', sql: `SELECT blob5 AS product_id, SUM(_sample_interval) AS affiliate_clicks\nFROM ${DATA}\nWHERE blob1 = '${VERSION}' AND index1 = 'affiliate_click' AND blob2 = 'affiliate_click'\nGROUP BY product_id\nORDER BY affiliate_clicks DESC, product_id\nLIMIT 25` },
  top_commercial_pages: { group: 'metrics', description: 'Top 25 páginas/origens por cliques afiliados.', sql: `SELECT blob3 AS page, SUM(_sample_interval) AS affiliate_clicks\nFROM ${DATA}\nWHERE blob1 = '${VERSION}' AND index1 = 'affiliate_click' AND blob2 = 'affiliate_click'\nGROUP BY page\nORDER BY affiliate_clicks DESC, page\nLIMIT 25` },
  events_by_hour: { group: 'metrics', description: 'Distribuição temporal horária em UTC por tipo de evento.', sql: `SELECT formatDateTime(timestamp, '%Y-%m-%d %H:00:00', 'Etc/UTC') AS hour_utc, index1 AS event, SUM(_sample_interval) AS events\nFROM ${DATA}\nWHERE blob1 = '${VERSION}' AND index1 IN ('page_view', 'affiliate_click') AND blob2 = index1\nGROUP BY hour_utc, event\nORDER BY hour_utc DESC, event\nLIMIT 2000` },
  affiliate_click_rate_by_page: { group: 'metrics', description: 'Taxa de clique afiliado por página; razão entre affiliate_click e page_view da mesma página.', sql: `SELECT\n  blob3 AS page,\n  SUM(_sample_interval * if(index1 = 'page_view' AND blob2 = 'page_view', 1, 0)) AS page_views,\n  SUM(_sample_interval * if(index1 = 'affiliate_click' AND blob2 = 'affiliate_click', 1, 0)) AS affiliate_clicks,\n  100.0 * SUM(_sample_interval * if(index1 = 'affiliate_click' AND blob2 = 'affiliate_click', 1, 0)) / SUM(_sample_interval * if(index1 = 'page_view' AND blob2 = 'page_view', 1, 0)) AS affiliate_click_rate_pct\nFROM ${DATA}\nWHERE blob1 = '${VERSION}' AND index1 IN ('page_view', 'affiliate_click')\nGROUP BY page\nHAVING SUM(_sample_interval * if(index1 = 'page_view' AND blob2 = 'page_view', 1, 0)) > 0\nORDER BY affiliate_click_rate_pct DESC, page\nLIMIT 200` },
  affiliate_clicks_by_channel: { group: 'metrics', description: 'Cliques afiliados por canal de aquisição preservado na sessão C1.', sql: `SELECT blob14 AS channel, SUM(_sample_interval) AS affiliate_clicks\nFROM ${DATA}\nWHERE blob1 = '${VERSION}' AND index1 = 'affiliate_click' AND blob2 = 'affiliate_click' AND blob14 != ''\nGROUP BY channel\nORDER BY affiliate_clicks DESC, channel\nLIMIT 20` },
  affiliate_clicks_by_landing: { group: 'metrics', description: 'Cliques afiliados por primeira landing preservada na sessão C1.', sql: `SELECT blob13 AS landing, SUM(_sample_interval) AS affiliate_clicks\nFROM ${DATA}\nWHERE blob1 = '${VERSION}' AND index1 = 'affiliate_click' AND blob2 = 'affiliate_click' AND blob13 != ''\nGROUP BY landing\nORDER BY affiliate_clicks DESC, landing\nLIMIT 500` },
  product_views_by_landing_product: { group: 'metrics', description: 'Page views de produto por landing e product_id; product view é inferido do page_view já existente.', sql: `SELECT blob13 AS landing, blob5 AS product_id, SUM(_sample_interval) AS product_views\nFROM ${DATA}\nWHERE blob1 = '${VERSION}' AND index1 = 'page_view' AND blob2 = 'page_view' AND blob4 = 'product' AND blob13 != '' AND blob5 != ''\nGROUP BY landing, product_id\nORDER BY product_views DESC, landing, product_id\nLIMIT 2000` },
  affiliate_clicks_by_landing_product: { group: 'metrics', description: 'Cliques afiliados por landing e product_id quando o produto é factual.', sql: `SELECT blob13 AS landing, blob5 AS product_id, SUM(_sample_interval) AS affiliate_clicks\nFROM ${DATA}\nWHERE blob1 = '${VERSION}' AND index1 = 'affiliate_click' AND blob2 = 'affiliate_click' AND blob13 != '' AND blob5 != '' AND blob5 != 'unknown'\nGROUP BY landing, product_id\nORDER BY affiliate_clicks DESC, landing, product_id\nLIMIT 2000` },
  unknown_event_types: { group: 'quality', description: 'Eventos desconhecidos ou divergência entre index1 e blob2; reconhece extensões legítimas do dataset sem alterar as métricas M2.1.', sql: `SELECT index1 AS event_index, blob2 AS event_blob, SUM(_sample_interval) AS rows\nFROM ${DATA}\nWHERE blob1 = '${VERSION}' AND (index1 NOT IN (${datasetEventSql}) OR blob2 NOT IN (${datasetEventSql}) OR index1 != blob2)\nGROUP BY event_index, event_blob\nORDER BY rows DESC\nLIMIT 100` },
  missing_affiliate_click_fields: { group: 'quality', description: 'Campos obrigatórios ausentes em affiliate_click.', sql: `SELECT\n  SUM(_sample_interval * if(blob5 = '', 1, 0)) AS missing_product_id,\n  SUM(_sample_interval * if(blob6 = '', 1, 0)) AS missing_store,\n  SUM(_sample_interval * if(blob3 = '', 1, 0)) AS missing_page,\n  SUM(_sample_interval * if(blob7 = '', 1, 0)) AS missing_placement\nFROM ${DATA}\nWHERE blob1 = '${VERSION}' AND index1 = 'affiliate_click' AND blob2 = 'affiliate_click'` },
  unexpected_affiliate_values: { group: 'quality', description: 'Loja, placement ou host fora do vocabulário M1 esperado.', sql: `SELECT blob6 AS store, blob7 AS placement, blob12 AS host, SUM(_sample_interval) AS rows\nFROM ${DATA}\nWHERE blob1 = '${VERSION}' AND index1 = 'affiliate_click' AND blob2 = 'affiliate_click'\n  AND (blob6 != 'mercado_livre' OR blob7 NOT IN (${placementSql}) OR blob12 != 'preconamira.com.br')\nGROUP BY store, placement, host\nORDER BY rows DESC\nLIMIT 200` },
  schema_incompatibilities: { group: 'quality', description: 'Linhas incompatíveis com o layout m1-v1 ou com os campos esperados por evento.', sql: `SELECT blob1 AS schema_version, index1 AS event_index, blob2 AS event_blob, blob3 AS page, blob4 AS page_type, blob5 AS product_id, blob6 AS store, blob7 AS placement, double1 AS weight, SUM(_sample_interval) AS rows\nFROM ${DATA}\nWHERE blob1 != '${VERSION}' OR double1 != 1 OR index1 != blob2\n  OR (index1 = 'page_view' AND (blob3 = '' OR blob4 = '' OR blob6 != '' OR blob7 != ''))\n  OR (index1 = 'affiliate_click' AND (blob3 = '' OR blob5 = '' OR blob6 = '' OR blob7 = '' OR blob4 != ''))\nGROUP BY schema_version, event_index, event_blob, page, page_type, product_id, store, placement, weight\nORDER BY rows DESC\nLIMIT 500` },
  possible_technical_duplicates: { group: 'quality', description: 'Heurística de duplicação: linhas idênticas no mesmo timestamp. Não prova duplicidade sem event/session id.', sql: `SELECT timestamp, index1 AS event, blob3 AS page, blob5 AS product_id, blob6 AS store, blob7 AS placement, SUM(_sample_interval) AS rows\nFROM ${DATA}\nWHERE blob1 = '${VERSION}'\nGROUP BY timestamp, index1, blob2, blob3, blob4, blob5, blob6, blob7, blob8, blob9, blob10, blob11, blob12, blob13, blob14, blob15, double1\nHAVING SUM(_sample_interval) > 1\nORDER BY rows DESC, timestamp DESC\nLIMIT 100` },
});

export function listQueries(group = '') {
  return Object.entries(QUERY_DEFINITIONS).filter(([, query]) => !group || query.group === group).map(([name, query]) => ({ name, group: query.group, description: query.description }));
}
export function getQuery(name) {
  const query = QUERY_DEFINITIONS[name];
  if (!query) throw new Error(`Consulta M2.1 desconhecida: ${name}`);
  return query;
}
export async function executeQuery(name, { accountId, apiToken, fetchImpl = fetch } = {}) {
  if (!accountId) throw new Error('PNM_CF_ACCOUNT_ID ausente.');
  if (!apiToken) throw new Error('PNM_CF_ANALYTICS_TOKEN ausente.');
  const query = getQuery(name);
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`;
  const response = await fetchImpl(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${apiToken}`, 'content-type': 'text/plain; charset=utf-8' }, body: query.sql });
  const text = await response.text();
  if (!response.ok) throw new Error(`Analytics Engine SQL API falhou (${response.status}): ${text.slice(0, 500)}`);
  try { return JSON.parse(text); } catch { return { raw: text }; }
}