import { DATASET, SCHEMA_VERSION, PLACEMENTS, SCHEMA } from './m2-1-analytics-lib.mjs';

export { DATASET, SCHEMA_VERSION, SCHEMA };
export const ACCEPTED_EVENTS = Object.freeze(['page_view', 'affiliate_click', 'commercial_impression']);
export const IMPRESSION_PLACEMENTS = Object.freeze(['card', 'related']);
export const ALL_PLACEMENTS = PLACEMENTS;

const DATA = DATASET;
const VERSION = SCHEMA_VERSION;
const coveredPlacementSql = IMPRESSION_PLACEMENTS.map(value => `'${value}'`).join(', ');
const eventSql = ACCEPTED_EVENTS.map(value => `'${value}'`).join(', ');
const M31_START_TOKEN = '__M3_1_START_UTC__';

function m31StartSql(value) {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(raw)) {
    throw new Error('PNM_M31_START_UTC obrigatório para CTR M3.1 no formato YYYY-MM-DDTHH:mm:ssZ.');
  }
  return `toDateTime('${raw.slice(0, 19).replace('T', ' ')}', 'Etc/UTC')`;
}

export const QUERY_DEFINITIONS = Object.freeze({
  total_commercial_impressions: {
    group: 'metrics',
    description: 'Total de commercial_impression válidos, ponderado por amostragem.',
    sql: `SELECT SUM(_sample_interval) AS commercial_impressions\nFROM ${DATA}\nWHERE blob1 = '${VERSION}' AND index1 = 'commercial_impression' AND blob2 = 'commercial_impression'`,
  },
  impressions_by_product: {
    group: 'metrics',
    description: 'Impressões comerciais por product_id.',
    sql: `SELECT blob5 AS product_id, SUM(_sample_interval) AS commercial_impressions\nFROM ${DATA}\nWHERE blob1 = '${VERSION}' AND index1 = 'commercial_impression' AND blob2 = 'commercial_impression'\nGROUP BY product_id\nORDER BY commercial_impressions DESC, product_id\nLIMIT 1000`,
  },
  impressions_by_page: {
    group: 'metrics',
    description: 'Impressões comerciais por página/origem.',
    sql: `SELECT blob3 AS page, SUM(_sample_interval) AS commercial_impressions\nFROM ${DATA}\nWHERE blob1 = '${VERSION}' AND index1 = 'commercial_impression' AND blob2 = 'commercial_impression'\nGROUP BY page\nORDER BY commercial_impressions DESC, page\nLIMIT 200`,
  },
  impressions_by_placement: {
    group: 'metrics',
    description: 'Impressões comerciais por placement.',
    sql: `SELECT blob7 AS placement, SUM(_sample_interval) AS commercial_impressions\nFROM ${DATA}\nWHERE blob1 = '${VERSION}' AND index1 = 'commercial_impression' AND blob2 = 'commercial_impression'\nGROUP BY placement\nORDER BY commercial_impressions DESC, placement\nLIMIT 100`,
  },
  affiliate_click_rate_by_product: {
    group: 'metrics',
    requires_m31_start: true,
    description: 'CTR afiliado por produto somente para card/related e a partir do corte UTC explícito da M3.1; cliques históricos anteriores ficam fora.',
    sql: `SELECT\n  blob5 AS product_id,\n  SUM(_sample_interval * if(index1 = 'commercial_impression' AND blob2 = 'commercial_impression', 1, 0)) AS commercial_impressions,\n  SUM(_sample_interval * if(index1 = 'affiliate_click' AND blob2 = 'affiliate_click', 1, 0)) AS affiliate_clicks,\n  100.0 * SUM(_sample_interval * if(index1 = 'affiliate_click' AND blob2 = 'affiliate_click', 1, 0)) / SUM(_sample_interval * if(index1 = 'commercial_impression' AND blob2 = 'commercial_impression', 1, 0)) AS affiliate_click_rate_pct\nFROM ${DATA}\nWHERE blob1 = '${VERSION}' AND timestamp >= ${M31_START_TOKEN} AND index1 IN ('commercial_impression', 'affiliate_click') AND blob7 IN (${coveredPlacementSql}) AND blob5 != 'unknown'\nGROUP BY product_id\nHAVING SUM(_sample_interval * if(index1 = 'commercial_impression' AND blob2 = 'commercial_impression', 1, 0)) > 0\nORDER BY affiliate_click_rate_pct DESC, product_id\nLIMIT 1000`,
  },
  affiliate_click_rate_by_placement: {
    group: 'metrics',
    requires_m31_start: true,
    description: 'CTR afiliado por card/related a partir do corte UTC explícito da M3.1; cliques históricos anteriores ficam fora.',
    sql: `SELECT\n  blob7 AS placement,\n  SUM(_sample_interval * if(index1 = 'commercial_impression' AND blob2 = 'commercial_impression', 1, 0)) AS commercial_impressions,\n  SUM(_sample_interval * if(index1 = 'affiliate_click' AND blob2 = 'affiliate_click', 1, 0)) AS affiliate_clicks,\n  100.0 * SUM(_sample_interval * if(index1 = 'affiliate_click' AND blob2 = 'affiliate_click', 1, 0)) / SUM(_sample_interval * if(index1 = 'commercial_impression' AND blob2 = 'commercial_impression', 1, 0)) AS affiliate_click_rate_pct\nFROM ${DATA}\nWHERE blob1 = '${VERSION}' AND timestamp >= ${M31_START_TOKEN} AND index1 IN ('commercial_impression', 'affiliate_click') AND blob7 IN (${coveredPlacementSql}) AND blob5 != 'unknown'\nGROUP BY placement\nHAVING SUM(_sample_interval * if(index1 = 'commercial_impression' AND blob2 = 'commercial_impression', 1, 0)) > 0\nORDER BY affiliate_click_rate_pct DESC, placement\nLIMIT 100`,
  },
  missing_commercial_impression_fields: {
    group: 'quality',
    description: 'Campos obrigatórios ausentes em commercial_impression.',
    sql: `SELECT\n  SUM(_sample_interval * if(blob5 = '', 1, 0)) AS missing_product_id,\n  SUM(_sample_interval * if(blob6 = '', 1, 0)) AS missing_store,\n  SUM(_sample_interval * if(blob3 = '', 1, 0)) AS missing_page,\n  SUM(_sample_interval * if(blob4 = '', 1, 0)) AS missing_page_type,\n  SUM(_sample_interval * if(blob7 = '', 1, 0)) AS missing_placement\nFROM ${DATA}\nWHERE blob1 = '${VERSION}' AND index1 = 'commercial_impression' AND blob2 = 'commercial_impression'`,
  },
  unexpected_commercial_impression_values: {
    group: 'quality',
    description: 'Loja, placement inicial ou host fora do vocabulário esperado para commercial_impression M3.1.',
    sql: `SELECT blob6 AS store, blob7 AS placement, blob12 AS host, SUM(_sample_interval) AS rows\nFROM ${DATA}\nWHERE blob1 = '${VERSION}' AND index1 = 'commercial_impression' AND blob2 = 'commercial_impression'\n  AND (blob6 != 'mercado_livre' OR blob7 NOT IN (${coveredPlacementSql}) OR blob12 != 'preconamira.com.br')\nGROUP BY store, placement, host\nORDER BY rows DESC\nLIMIT 200`,
  },
  unknown_event_types_m3_1: {
    group: 'quality',
    description: 'Eventos desconhecidos na população M3.1 ou divergência entre index1 e blob2.',
    sql: `SELECT index1 AS event_index, blob2 AS event_blob, SUM(_sample_interval) AS rows\nFROM ${DATA}\nWHERE blob1 = '${VERSION}' AND (index1 NOT IN (${eventSql}) OR blob2 NOT IN (${eventSql}) OR index1 != blob2)\nGROUP BY event_index, event_blob\nORDER BY rows DESC\nLIMIT 100`,
  },
  schema_incompatibilities_m3_1: {
    group: 'quality',
    description: 'Linhas incompatíveis com m1-v1 para page_view, affiliate_click ou commercial_impression.',
    sql: `SELECT blob1 AS schema_version, index1 AS event_index, blob2 AS event_blob, blob3 AS page, blob4 AS page_type, blob5 AS product_id, blob6 AS store, blob7 AS placement, double1 AS weight, SUM(_sample_interval) AS rows\nFROM ${DATA}\nWHERE blob1 != '${VERSION}' OR double1 != 1 OR index1 != blob2\n  OR (index1 = 'page_view' AND (blob3 = '' OR blob4 = '' OR blob6 != '' OR blob7 != ''))\n  OR (index1 = 'affiliate_click' AND (blob3 = '' OR blob5 = '' OR blob6 = '' OR blob7 = '' OR blob4 != ''))\n  OR (index1 = 'commercial_impression' AND (blob3 = '' OR blob4 = '' OR blob5 = '' OR blob5 = 'unknown' OR blob6 = '' OR blob7 = '' OR blob7 NOT IN (${coveredPlacementSql})))\nGROUP BY schema_version, event_index, event_blob, page, page_type, product_id, store, placement, weight\nORDER BY rows DESC\nLIMIT 500`,
  },
  possible_impression_inflation: {
    group: 'quality',
    description: 'Heurística de possível inflação: mais de 10 impressões ponderadas do mesmo page/product/placement no mesmo minuto. Sinaliza investigação; não prova duplicação entre usuários.',
    sql: `SELECT toStartOfMinute(timestamp) AS minute_utc, blob3 AS page, blob5 AS product_id, blob7 AS placement, SUM(_sample_interval) AS commercial_impressions\nFROM ${DATA}\nWHERE blob1 = '${VERSION}' AND index1 = 'commercial_impression' AND blob2 = 'commercial_impression'\nGROUP BY minute_utc, page, product_id, placement\nHAVING SUM(_sample_interval) > 10\nORDER BY commercial_impressions DESC, minute_utc DESC\nLIMIT 200`,
  },
});

export function listQueries(group = '') {
  return Object.entries(QUERY_DEFINITIONS)
    .filter(([, query]) => !group || query.group === group)
    .map(([name, query]) => ({ name, group: query.group, description: query.description, requires_m31_start: Boolean(query.requires_m31_start) }));
}

export function getQuery(name, { m31StartUtc = '' } = {}) {
  const query = QUERY_DEFINITIONS[name];
  if (!query) throw new Error(`Consulta M3.1 desconhecida: ${name}`);
  if (!query.requires_m31_start) return query;
  return { ...query, sql: query.sql.replaceAll(M31_START_TOKEN, m31StartSql(m31StartUtc)) };
}

export async function executeQuery(name, { accountId, apiToken, m31StartUtc = '', fetchImpl = fetch } = {}) {
  if (!accountId) throw new Error('PNM_CF_ACCOUNT_ID ausente.');
  if (!apiToken) throw new Error('PNM_CF_ANALYTICS_TOKEN ausente.');
  const query = getQuery(name, { m31StartUtc });
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`;
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiToken}`, 'content-type': 'text/plain; charset=utf-8' },
    body: query.sql,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Analytics Engine SQL API falhou (${response.status}): ${text.slice(0, 500)}`);
  try { return JSON.parse(text); } catch { return { raw: text }; }
}
