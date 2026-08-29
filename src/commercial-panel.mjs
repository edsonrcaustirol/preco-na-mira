import { executeQuery as executeM2Query } from '../scripts/m2-1-analytics-lib.mjs';
import { executeQuery as executeM3Query } from '../scripts/m3-1-analytics-lib.mjs';

export const PANEL_PATH = '/__pnm/commercial';
export const PANEL_USERNAME = 'pnm';
export const M31_START_UTC = '2026-08-22T05:24:34Z';
export const C2_PERIOD = 'FIXO';
export const C2_THRESHOLDS = Object.freeze({ landingActivity: 10, productViews: 5, placementImpressions: 20, weakPlacementRatio: 0.5 });

const encoder = new TextEncoder();
const numberFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const percentFormat = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const runtimeFetch = (...args) => fetch(...args);
const DETAIL_LIMIT = 300;
const TOP_ROWS = 20;

function secureHeaders(contentType) {
  return {
    'cache-control': 'no-store, max-age=0', 'content-type': contentType,
    'cross-origin-resource-policy': 'same-origin', 'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY',
  };
}
function htmlHeaders() {
  return { ...secureHeaders('text/html; charset=utf-8'), 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" };
}
function plainResponse(body, status, extraHeaders = {}) {
  return new Response(body, { status, headers: { ...secureHeaders('text/plain; charset=utf-8'), ...extraHeaders } });
}
async function digest(value) { return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(String(value)))); }
async function constantTimeEqual(left, right) {
  const [a, b] = await Promise.all([digest(left), digest(right)]); let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= a[index] ^ b[index];
  return mismatch === 0;
}
function decodeBasicCredential(encoded) {
  try { const binary = atob(encoded); return new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0))); } catch { return ''; }
}
export async function isPanelAuthorized(request, password) {
  if (!password) return false;
  const match = (request.headers.get('authorization') || '').match(/^Basic\s+([A-Za-z0-9+/=]+)$/i);
  return Boolean(match) && constantTimeEqual(decodeBasicCredential(match[1]), `${PANEL_USERNAME}:${password}`);
}

const rows = result => Array.isArray(result?.data) ? result.data : [];
const firstValue = (result, key) => rows(result)[0]?.[key] ?? 0;
function finite(value) { if (value === null || value === undefined || value === '') return null; const numeric = Number(value); return Number.isFinite(numeric) ? numeric : null; }
function ratioPercent(numerator, denominator) {
  const top = finite(numerator); const bottom = finite(denominator);
  return top === null || bottom === null || bottom <= 0 ? null : (100 * top) / bottom;
}
function classifyAnalyticsFailure(status, transportFailure) {
  if (transportFailure) return 'transport';
  if (status === 400) return 'query_rejected'; if (status === 401) return 'authentication'; if (status === 403) return 'authorization';
  if (status === 404) return 'account_or_endpoint'; if (status === 429) return 'rate_limited';
  if (Number.isInteger(status) && status >= 500) return 'cloudflare_5xx'; if (Number.isInteger(status) && status >= 400) return 'cloudflare_4xx';
  return 'unexpected';
}
function sanitizeDiagnosticDetail(value, { accountId = '', apiToken = '', panelPassword = '' } = {}) {
  let text = String(value ?? '').replace(/^Analytics Engine SQL API falhou \(\d+\):\s*/i, '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  for (const secret of [accountId, apiToken, panelPassword]) if (secret) text = text.replaceAll(String(secret), '[redacted]');
  return text.replace(/https?:\/\/[^\s"'<>]+/gi, '[redacted]').replace(/\bAuthorization\b(?:\s*[:=]\s*|\s+)[^,;]+/gi, '[redacted]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, '[redacted]').replace(/\b(?:PNM_CF_ANALYTICS_TOKEN|PNM_PANEL_PASSWORD)\b/gi, '[redacted]')
    .replace(/\b[^\s,;=]*secret[^\s,;=]*\b/gi, '[redacted]').replace(/\b(?:token|password|senha)\s*[:=]\s*[^,;\s]+/gi, '[redacted]')
    .replace(/\b[a-f0-9]{32}\b/gi, '[redacted]').replace(/\b(?:SELECT|SHOW|WITH|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\b[\s\S]*/i, '[redacted]')
    .replace(/\s+/g, ' ').trim().slice(0, DETAIL_LIMIT);
}
async function executeDashboardQuery(spec) {
  let observedStatus = null; let transportFailure = false;
  const diagnosticFetch = async (...args) => {
    try { const response = await spec.options.fetchImpl(...args); observedStatus = Number.isInteger(response?.status) ? response.status : null; return response; }
    catch { transportFailure = true; throw new Error('Analytics Engine transport failure.'); }
  };
  try { return await spec.execute(spec.name, { ...spec.options, fetchImpl: diagnosticFetch }); }
  catch (error) {
    const detail = observedStatus === 400 ? sanitizeDiagnosticDetail(error?.message, spec.options) : '';
    throw { pnmSafeDiagnostic: true, source: spec.source, query: spec.name, status: observedStatus, category: classifyAnalyticsFailure(observedStatus, transportFailure), ...(detail ? { detail } : {}) };
  }
}
function normalizeDiagnostic(reason, spec) {
  if (reason?.pnmSafeDiagnostic === true) return { key: spec.key, block: spec.block, source: String(reason.source || spec.source), query: String(reason.query || spec.name), status: Number.isInteger(reason.status) ? reason.status : null, category: String(reason.category || 'unexpected'), detail: String(reason.detail || '') };
  return { key: spec.key, block: spec.block, source: spec.source, query: spec.name, status: null, category: 'unexpected', detail: '' };
}

const QUERY_SPECS = Object.freeze([
  { key: 'pageViews', block: 'summary', source: 'M2.1', name: 'total_page_views', execute: executeM2Query },
  { key: 'productViews', block: 'summary', source: 'C2', name: 'total_product_views', execute: executeM2Query },
  { key: 'affiliateClicks', block: 'summary', source: 'M2.1', name: 'total_affiliate_clicks', execute: executeM2Query },
  { key: 'commercialImpressions', block: 'summary', source: 'M3.1', name: 'total_commercial_impressions', execute: executeM3Query },
  { key: 'pageViewsByChannel', block: 'origins', source: 'C2', name: 'page_views_by_channel', execute: executeM2Query, limit: 20 },
  { key: 'productViewsByChannel', block: 'origins', source: 'C2', name: 'product_views_by_channel', execute: executeM2Query, limit: 20 },
  { key: 'clicksByChannel', block: 'origins', source: 'M2.1', name: 'affiliate_clicks_by_channel', execute: executeM2Query, limit: 20 },
  { key: 'pageViewsByLanding', block: 'landings', source: 'C2', name: 'page_views_by_landing', execute: executeM2Query, limit: 500 },
  { key: 'productViewsByLanding', block: 'landings', source: 'C2', name: 'product_views_by_landing', execute: executeM2Query, limit: 500 },
  { key: 'clicksByLanding', block: 'landings', source: 'M2.1', name: 'affiliate_clicks_by_landing', execute: executeM2Query, limit: 500 },
  { key: 'productViewsByProduct', block: 'products', source: 'C2', name: 'product_views_by_product', execute: executeM2Query, limit: 1000 },
  { key: 'clicksByProduct', block: 'products', source: 'M2.1', name: 'affiliate_clicks_by_product', execute: executeM2Query, limit: 1000 },
  { key: 'ctrByProduct', block: 'products', source: 'M3.1', name: 'affiliate_click_rate_by_product', execute: executeM3Query, limit: 1000 },
  { key: 'clicksByPlacement', block: 'placements', source: 'M2.1', name: 'affiliate_clicks_by_placement', execute: executeM2Query, limit: 100 },
  { key: 'impressionsByPlacement', block: 'placements', source: 'M3.1', name: 'impressions_by_placement', execute: executeM3Query, limit: 100 },
  { key: 'ctrByPlacement', block: 'placements', source: 'M3.1', name: 'affiliate_click_rate_by_placement', execute: executeM3Query, limit: 100 },
]);

function mergeRows({ id, available, sources }) {
  const output = new Map();
  for (const source of sources) {
    if (!available.has(source.key)) continue;
    for (const item of source.rows) {
      const identity = String(item?.[id] || '').trim(); if (!identity) continue;
      if (!output.has(identity)) {
        const base = { [id]: identity };
        for (const candidate of sources) {
          if (!available.has(candidate.key)) base[candidate.target] = null;
          else if (Object.prototype.hasOwnProperty.call(candidate, 'defaultValue')) base[candidate.target] = candidate.defaultValue;
          else base[candidate.target] = candidate.complete ? 0 : null;
        }
        output.set(identity, base);
      }
      output.get(identity)[source.target] = finite(item[source.field]) ?? 0;
    }
  }
  return [...output.values()];
}
function blockStatus(keys, failuresByKey, items) {
  const failed = keys.filter(key => failuresByKey.has(key)).length;
  if (failed === keys.length) return 'error'; if (failed > 0) return 'partial'; if (!items.length) return 'empty'; return 'available';
}
function commercialSort(a, b) {
  return (finite(b.affiliateClicks) ?? -1) - (finite(a.affiliateClicks) ?? -1) || (finite(b.productViews) ?? -1) - (finite(a.productViews) ?? -1)
    || (finite(b.pageViews) ?? -1) - (finite(a.pageViews) ?? -1) || String(a.landing || a.product_id || a.channel || '').localeCompare(String(b.landing || b.product_id || b.channel || ''));
}

export async function loadCommercialDashboard({ accountId, apiToken, fetchImpl = runtimeFetch } = {}) {
  const m2Options = { accountId, apiToken, fetchImpl }; const m3Options = { accountId, apiToken, fetchImpl, m31StartUtc: M31_START_UTC };
  const specs = QUERY_SPECS.map(spec => ({ ...spec, options: spec.source === 'M3.1' ? m3Options : m2Options }));
  const settled = await Promise.allSettled(specs.map(executeDashboardQuery)); const values = new Map(); const failures = [];
  settled.forEach((result, index) => { const spec = specs[index]; if (result.status === 'fulfilled') values.set(spec.key, result.value); else failures.push(normalizeDiagnostic(result.reason, spec)); });
  if (!values.size) { const error = new Error('Falha em todas as consultas do painel comercial.'); error.name = 'CommercialDashboardQueryError'; error.failures = failures; throw error; }
  const failuresByKey = new Map(failures.map(item => [item.key, item])); const available = new Set(values.keys());
  const getRows = key => available.has(key) ? rows(values.get(key)) : [];
  const getScalar = (key, field) => available.has(key) ? finite(firstValue(values.get(key), field)) ?? 0 : null;
  const specByKey = new Map(specs.map(spec => [spec.key, spec]));
  const complete = key => { const spec = specByKey.get(key); return available.has(key) && (!spec?.limit || getRows(key).length < spec.limit); };
  const source = (key, field, target, extra = {}) => ({ key, rows: getRows(key), field, target, complete: complete(key), ...extra });

  const origins = mergeRows({ id: 'channel', available, sources: [source('pageViewsByChannel', 'page_views', 'pageViews'), source('productViewsByChannel', 'product_views', 'productViews'), source('clicksByChannel', 'affiliate_clicks', 'affiliateClicks')] })
    .map(item => ({ ...item, clickRatePct: ratioPercent(item.affiliateClicks, item.pageViews) })).sort(commercialSort).slice(0, TOP_ROWS);
  const landings = mergeRows({ id: 'landing', available, sources: [source('pageViewsByLanding', 'page_views', 'pageViews'), source('productViewsByLanding', 'product_views', 'productViews'), source('clicksByLanding', 'affiliate_clicks', 'affiliateClicks')] })
    .map(item => ({ ...item, clickRatePct: ratioPercent(item.affiliateClicks, item.pageViews) })).sort(commercialSort).slice(0, TOP_ROWS);
  const products = mergeRows({ id: 'product_id', available, sources: [source('productViewsByProduct', 'product_views', 'productViews'), source('clicksByProduct', 'affiliate_clicks', 'affiliateClicks'), source('ctrByProduct', 'affiliate_click_rate_pct', 'eligibleCtrPct', { defaultValue: null })] })
    .sort(commercialSort).slice(0, TOP_ROWS);
  const placements = mergeRows({ id: 'placement', available, sources: [source('clicksByPlacement', 'affiliate_clicks', 'affiliateClicks'), source('impressionsByPlacement', 'commercial_impressions', 'commercialImpressions', { defaultValue: null }), source('ctrByPlacement', 'affiliate_click_rate_pct', 'eligibleCtrPct', { defaultValue: null })] });
  const ctrRows = new Map(getRows('ctrByPlacement').map(item => [String(item.placement), item]));
  for (const item of placements) { const ctr = ctrRows.get(item.placement); item.eligibleImpressions = ctr ? finite(ctr.commercial_impressions) ?? 0 : null; item.eligibleClicks = ctr ? finite(ctr.affiliate_clicks) ?? 0 : null; }
  placements.sort((a, b) => (finite(b.affiliateClicks) ?? -1) - (finite(a.affiliateClicks) ?? -1) || String(a.placement).localeCompare(String(b.placement)));

  const summaryKeys = ['pageViews', 'productViews', 'affiliateClicks', 'commercialImpressions']; const summaryItems = summaryKeys.filter(key => available.has(key));
  return {
    generatedAtUtc: new Date().toISOString(), m31StartUtc: M31_START_UTC, period: C2_PERIOD,
    totals: { pageViews: getScalar('pageViews', 'page_views'), productViews: getScalar('productViews', 'product_views'), affiliateClicks: getScalar('affiliateClicks', 'affiliate_clicks'), commercialImpressions: getScalar('commercialImpressions', 'commercial_impressions') },
    summary: { status: blockStatus(summaryKeys, failuresByKey, summaryItems), failedKeys: summaryKeys.filter(key => failuresByKey.has(key)) },
    origins: { status: blockStatus(['pageViewsByChannel', 'productViewsByChannel', 'clicksByChannel'], failuresByKey, origins), rows: origins },
    landings: { status: blockStatus(['pageViewsByLanding', 'productViewsByLanding', 'clicksByLanding'], failuresByKey, landings), rows: landings },
    products: { status: blockStatus(['productViewsByProduct', 'clicksByProduct', 'ctrByProduct'], failuresByKey, products), rows: products },
    placements: { status: blockStatus(['clicksByPlacement', 'impressionsByPlacement', 'ctrByPlacement'], failuresByKey, placements), rows: placements.slice(0, TOP_ROWS) }, failures,
  };
}

export function parseCanonicalProductTitles(source) {
  const match = String(source || '').match(/^const\s+PRODUTOS\s*=\s*(\[[\s\S]*\]);?\s*$/); if (!match) return new Map();
  try { const products = JSON.parse(match[1]); if (!Array.isArray(products)) return new Map(); return new Map(products.filter(item => item && typeof item === 'object' && String(item.id || '').trim()).map(item => [String(item.id).trim(), String(item.nome || item.id).trim()])); } catch { return new Map(); }
}
export async function loadCanonicalProductTitles(assets, requestUrl) {
  if (!assets || typeof assets.fetch !== 'function') return new Map();
  try { const response = await assets.fetch(new Request(new URL('/data/produtos-index.js', requestUrl))); return response?.ok ? parseCanonicalProductTitles(await response.text()) : new Map(); } catch { return new Map(); }
}
function escapeHtml(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }
function formatCount(value) { const numeric = finite(value); return numeric === null ? '—' : numberFormat.format(numeric); }
function formatPercent(value) { const numeric = finite(value); return numeric === null ? '—' : `${percentFormat.format(numeric)}%`; }
function stateMessage(status, noun) {
  if (status === 'error') return `${noun} indisponível temporariamente por falha de consulta.`; if (status === 'partial') return `${noun} parcialmente disponível; uma consulta falhou e os demais dados foram preservados.`;
  if (status === 'empty') return 'Ainda não há dados suficientes para esta dimensão.'; return '';
}
function renderState(status, noun) { const message = stateMessage(status, noun); if (!message) return ''; const kind = status === 'error' ? 'error-state' : status === 'partial' ? 'partial-state' : 'empty-state'; return `<p class="state ${kind}" role="status">${escapeHtml(message)}</p>`; }
function renderRows(items, columns) {
  if (!items.length) return `<tr><td colspan="${columns.length}" class="empty">Ainda não há dados suficientes para esta dimensão.</td></tr>`;
  return items.map(item => `<tr>${columns.map(column => `<td>${escapeHtml(column.value ? column.value(item) : item[column.key])}</td>`).join('')}</tr>`).join('');
}
function renderTable(title, description, block, columns) {
  const state = renderState(block.status, title); const table = block.status === 'error' ? '' : `<div class="table-wrap"><table><thead><tr>${columns.map(column => `<th scope="col">${escapeHtml(column.label)}</th>`).join('')}</tr></thead><tbody>${renderRows(block.rows, columns)}</tbody></table></div>`;
  return `<section class="panel-section"><div class="section-heading"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div></div>${state}${table}</section>`;
}
function opportunityRows(data, productTitles) {
  const opportunities = [];
  if (data.landings.status !== 'error') {
    for (const item of data.landings.rows.filter(row => finite(row.pageViews) !== null && row.pageViews >= C2_THRESHOLDS.landingActivity && finite(row.affiliateClicks) === 0).sort((a, b) => b.pageViews - a.pageViews).slice(0, 3)) opportunities.push({ label: 'TRÁFEGO SEM CLIQUE', title: item.landing, detail: `${formatCount(item.pageViews)} page views atribuídos à landing e 0 affiliate clicks.` });
    const strong = data.landings.rows.filter(item => item.pageViews >= C2_THRESHOLDS.landingActivity && item.affiliateClicks > 0 && finite(item.clickRatePct) !== null).sort((a, b) => b.clickRatePct - a.clickRatePct)[0];
    if (strong) opportunities.push({ label: 'LANDING COM SINAL COMERCIAL', title: strong.landing, detail: `${formatPercent(strong.clickRatePct)} cliques/page view com ${formatCount(strong.pageViews)} page views. É um sinal agregado, não uma taxa de venda.` });
  }
  if (data.products.status !== 'error') for (const item of data.products.rows.filter(row => finite(row.productViews) !== null && row.productViews >= C2_THRESHOLDS.productViews && finite(row.affiliateClicks) === 0).sort((a, b) => b.productViews - a.productViews).slice(0, 3)) opportunities.push({ label: 'PRODUTO VISTO SEM CLIQUE', title: productTitles.get(item.product_id) || item.product_id, detail: `${formatCount(item.productViews)} product views e 0 affiliate clicks.` });
  if (data.placements.status !== 'error') {
    const comparable = data.placements.rows.filter(item => finite(item.eligibleImpressions) !== null && item.eligibleImpressions >= C2_THRESHOLDS.placementImpressions && finite(item.eligibleCtrPct) !== null); const bestCtr = comparable.reduce((best, item) => Math.max(best, item.eligibleCtrPct), 0);
    for (const item of comparable.filter(item => bestCtr > 0 && item.eligibleCtrPct < bestCtr * C2_THRESHOLDS.weakPlacementRatio).slice(0, 2)) opportunities.push({ label: 'PLACEMENT FRACO', title: item.placement, detail: `${formatPercent(item.eligibleCtrPct)} CTR elegível com ${formatCount(item.eligibleImpressions)} impressões; abaixo de metade do melhor placement comparável.` });
  }
  if (data.origins.status !== 'error') { const organic = data.origins.rows.find(item => item.channel === 'organic' && finite(item.affiliateClicks) !== null && item.affiliateClicks > 0); if (organic) opportunities.push({ label: 'ORGANIC COMERCIAL', title: 'organic', detail: `${formatCount(organic.affiliateClicks)} affiliate clicks atribuídos ao canal organic.` }); }
  return opportunities.slice(0, 8);
}
function renderOpportunities(data, productTitles) {
  const items = opportunityRows(data, productTitles);
  if (!items.length) return `<section class="panel-section"><div class="section-heading"><div><h2>Oportunidades / exceções</h2><p>Regras simples: landing ≥ ${C2_THRESHOLDS.landingActivity} page views; produto ≥ ${C2_THRESHOLDS.productViews} product views; placement ≥ ${C2_THRESHOLDS.placementImpressions} impressões elegíveis.</p></div></div><p class="state empty-state" role="status">Dados insuficientes para classificar oportunidades com segurança.</p></section>`;
  return `<section class="panel-section"><div class="section-heading"><div><h2>Oportunidades / exceções</h2><p>Sinais acionáveis com limiares mínimos documentados; baixo volume não é classificado como ruim.</p></div></div><div class="opportunities">${items.map(item => `<article class="opportunity"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.detail)}</p></article>`).join('')}</div></section>`;
}
function renderFunnel(data) {
  const productViewShare = ratioPercent(data.totals.productViews, data.totals.pageViews);
  return `<section class="panel-section funnel-section"><div class="section-heading"><div><h2>Funil observado</h2><p>Contagens de eventos agregados. Page view não é usuário; affiliate click não é venda.</p></div></div>${renderState(data.summary.status, 'Resumo do funil')}<div class="funnel"><div class="funnel-step"><span>PAGE VIEWS</span><strong>${escapeHtml(formatCount(data.totals.pageViews))}</strong><small>atividade observada</small></div><div class="funnel-arrow" aria-hidden="true">↓</div><div class="funnel-step"><span>PRODUCT VIEWS</span><strong>${escapeHtml(formatCount(data.totals.productViews))}</strong><small>${productViewShare === null ? 'taxa indisponível' : `${escapeHtml(formatPercent(productViewShare))} dos page views`}</small></div><div class="funnel-arrow" aria-hidden="true">↓</div><div class="funnel-step"><span>AFFILIATE CLICKS</span><strong>${escapeHtml(formatCount(data.totals.affiliateClicks))}</strong><small>saídas para o Mercado Livre</small></div></div><p class="definition">Os estágios são eventos, não pessoas únicas. Cliques podem acontecer em cards/listagens sem uma product view imediatamente anterior; por isso o painel não inventa uma taxa sequencial entre product view e click.</p></section>`;
}

export function renderCommercialDashboard(data, { productTitles = new Map() } = {}) {
  const productName = item => { const title = productTitles.get(item.product_id); return title ? `${title} · ${item.product_id}` : item.product_id; };
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>Funil Comercial — Preço na Mira</title><style>
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#08111f;color:#eef4fb}*{box-sizing:border-box}body{margin:0;background:#08111f;color:#eef4fb}main{width:min(1240px,calc(100% - 32px));margin:0 auto;padding:36px 0 64px}a{color:#9ac8ff}.eyebrow{margin:0 0 8px;color:#79b8ff;font-size:.78rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}h1{margin:0;font-size:clamp(2rem,5vw,3.2rem);letter-spacing:-.04em}h2{margin:0;font-size:1.05rem}p{color:#9eabb8;line-height:1.55}.top{display:flex;gap:20px;align-items:flex-end;justify-content:space-between;margin-bottom:20px}.refresh{white-space:nowrap;border:1px solid #2a405a;border-radius:10px;padding:9px 12px;text-decoration:none;background:#101c2d}.notice{border:1px solid #2a405a;border-left:3px solid #79b8ff;background:#0e1b2d;border-radius:10px;padding:14px 16px;margin:0 0 16px;color:#cbd5df}.meta{font-size:.86rem;margin:4px 0 0}.status-line{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 18px}.pill{border:1px solid #2a405a;border-radius:999px;padding:6px 9px;font-size:.75rem;color:#b9cbe0}.cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:18px 0}.card{border:1px solid #20344d;background:#0e1b2d;border-radius:12px;padding:15px}.card span{display:block;color:#8f9ba8;font-size:.78rem}.card strong{display:block;margin-top:6px;font-size:1.8rem;letter-spacing:-.03em}.panel-section{margin-top:16px;border:1px solid #20344d;background:#0c1828;border-radius:12px;overflow:hidden}.section-heading{padding:15px 17px;border-bottom:1px solid #20344d}.section-heading p{margin:5px 0 0;font-size:.84rem}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:650px}th,td{padding:10px 16px;border-bottom:1px solid #1b2c42;text-align:left;font-size:.88rem;vertical-align:top}th{color:#8f9ba8;font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;background:#101c2d}tbody tr:last-child td{border-bottom:0}.empty{color:#7f8b97}.state{margin:14px 16px;padding:12px;border-radius:9px}.empty-state{background:#101c2d;color:#9eabb8}.partial-state{background:#2a2417;color:#f3d59a}.error-state{background:#2b171a;color:#ffb3b3}.funnel{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;align-items:center;gap:10px;padding:18px}.funnel-step{border:1px solid #28425f;border-radius:12px;padding:15px;background:#101c2d;text-align:center}.funnel-step span,.funnel-step small{display:block;color:#8fa7c2}.funnel-step strong{display:block;font-size:1.75rem;margin:5px 0}.funnel-arrow{font-size:1.35rem;color:#6fa9e8}.definition{margin:0;padding:0 18px 18px;font-size:.82rem}.opportunities{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:14px}.opportunity{border:1px solid #28425f;border-radius:10px;padding:12px;background:#101c2d}.opportunity span{font-size:.7rem;letter-spacing:.08em;color:#79b8ff}.opportunity strong{display:block;margin:5px 0}.opportunity p{margin:0;font-size:.82rem}.foot{margin-top:20px;font-size:.8rem;color:#7f8b97}:focus-visible{outline:2px solid #9ac8ff;outline-offset:3px}@media(max-width:820px){main{width:min(100% - 20px,1240px);padding-top:24px}.top{align-items:flex-start;flex-direction:column}.cards{grid-template-columns:1fr 1fr}.funnel{grid-template-columns:1fr}.opportunities{grid-template-columns:1fr}}@media(max-width:480px){.cards{grid-template-columns:1fr}.card strong{font-size:1.6rem}}
</style></head><body><main><header class="top"><div><p class="eyebrow">Preço na Mira · C2</p><h1>Funil Comercial</h1><p class="meta">Uma visão operacional sobre dados agregados reais do Analytics Engine.</p></div><a class="refresh" href="${PANEL_PATH}">Atualizar</a></header><p class="notice"><strong>Leitura correta:</strong> <code>affiliate_click</code> é um clique de saída para o Mercado Livre. Não representa venda, pedido ou comissão. Page view não representa usuário.</p><div class="status-line"><span class="pill">Período: ${C2_PERIOD}</span><span class="pill">Jornada por channel/landing: somente eventos com dimensões C1</span><span class="pill">CTR placement/produto: card/related desde ${escapeHtml(M31_START_UTC.replace('T', ' ').replace('Z', ' UTC'))}</span></div><div class="cards"><div class="card"><span>PAGE VIEWS</span><strong>${escapeHtml(formatCount(data.totals.pageViews))}</strong></div><div class="card"><span>PRODUCT VIEWS</span><strong>${escapeHtml(formatCount(data.totals.productViews))}</strong></div><div class="card"><span>AFFILIATE CLICKS</span><strong>${escapeHtml(formatCount(data.totals.affiliateClicks))}</strong></div><div class="card"><span>COMMERCIAL IMPRESSIONS</span><strong>${escapeHtml(formatCount(data.totals.commercialImpressions))}</strong></div></div>${renderFunnel(data)}${renderTable('Origens','Canal C1 agregado. “Cliques / page view” é uma razão de eventos, não taxa de venda.',data.origins,[{key:'channel',label:'Canal'},{key:'pageViews',label:'Page views',value:item=>formatCount(item.pageViews)},{key:'productViews',label:'Product views',value:item=>formatCount(item.productViews)},{key:'affiliateClicks',label:'Affiliate clicks',value:item=>formatCount(item.affiliateClicks)},{key:'clickRatePct',label:'Cliques / page view',value:item=>formatPercent(item.clickRatePct)}])}${renderTable('Landings','Primeira landing preservada na sessão C1. Ordenação prioriza impacto comercial observado.',data.landings,[{key:'landing',label:'Landing'},{key:'pageViews',label:'Page views',value:item=>formatCount(item.pageViews)},{key:'productViews',label:'Product views',value:item=>formatCount(item.productViews)},{key:'affiliateClicks',label:'Affiliate clicks',value:item=>formatCount(item.affiliateClicks)},{key:'clickRatePct',label:'Cliques / page view',value:item=>formatPercent(item.clickRatePct)}])}${renderTable('Produtos','product_id permanece a identidade; o título é resolvido do catálogo canônico quando disponível. CTR usa somente card/related elegíveis M3.1.',data.products,[{key:'product_id',label:'Produto',value:productName},{key:'productViews',label:'Product views',value:item=>formatCount(item.productViews)},{key:'affiliateClicks',label:'Affiliate clicks',value:item=>formatCount(item.affiliateClicks)},{key:'eligibleCtrPct',label:'CTR comercial elegível',value:item=>formatPercent(item.eligibleCtrPct)}])}${renderTable('Placements','Impressões e CTR comerciais; CTR é factual somente nos placements elegíveis card/related M3.1.',data.placements,[{key:'placement',label:'Placement'},{key:'commercialImpressions',label:'Impressões',value:item=>formatCount(item.commercialImpressions)},{key:'affiliateClicks',label:'Affiliate clicks',value:item=>formatCount(item.affiliateClicks)},{key:'eligibleCtrPct',label:'CTR elegível',value:item=>formatPercent(item.eligibleCtrPct)}])}${renderOpportunities(data,productTitles)}<p class="foot">Atualizado em ${escapeHtml(data.generatedAtUtc)} · Rankings limitados a ${TOP_ROWS} linhas · “—” indica valor indisponível ou não demonstrável pelo ranking retornado · Sem sessão individual, PII, receita, pedido ou comissão.</p></main></body></html>`;
}

function safeDiagnosticsFromError(error, secrets) {
  if (Array.isArray(error?.failures) && error.failures.length) return error.failures.map((failure, index) => { const detail = index === 0 ? sanitizeDiagnosticDetail(failure.detail, secrets) : ''; return { source: String(failure.source || 'unknown'), query: String(failure.query || 'unknown'), status: Number.isInteger(failure.status) ? failure.status : null, category: String(failure.category || 'unexpected'), ...(detail ? { detail } : {}) }; });
  return [{ source: 'panel', query: 'unknown', status: null, category: 'unexpected' }];
}
function formatPublicDiagnostic(failure) { const base = `${failure.source}:${failure.query} — HTTP ${failure.status ?? 'n/a'} — ${failure.category}`; return failure.detail ? `${base} — detalhe: ${failure.detail}` : base; }
export async function handleCommercialPanel(request, env, { fetchImpl = runtimeFetch } = {}) {
  const password = String(env?.PNM_PANEL_PASSWORD || ''); if (!password) return plainResponse('Painel comercial não configurado.', 503);
  if (!(await isPanelAuthorized(request, password))) return plainResponse('Autenticação necessária.', 401, { 'www-authenticate': 'Basic realm="PNM Comercial", charset="UTF-8"' });
  if (request.method !== 'GET') return plainResponse('Método não permitido.', 405, { allow: 'GET' });
  const accountId = String(env?.PNM_CF_ACCOUNT_ID || ''); const apiToken = String(env?.PNM_CF_ANALYTICS_TOKEN || ''); if (!accountId || !apiToken) return plainResponse('Configuração de leitura do painel incompleta.', 503);
  try {
    const [data, productTitles] = await Promise.all([loadCommercialDashboard({ accountId, apiToken, fetchImpl }), loadCanonicalProductTitles(env?.ASSETS, request.url)]);
    if (data.failures.length) { const safe = safeDiagnosticsFromError({ failures: data.failures }, { accountId, apiToken, panelPassword: password }); console.error('PNM commercial panel partial diagnostics', JSON.stringify({ failures: safe })); }
    return new Response(renderCommercialDashboard(data, { productTitles }), { status: 200, headers: htmlHeaders() });
  } catch (error) {
    const failures = safeDiagnosticsFromError(error, { accountId, apiToken, panelPassword: password }); console.error('PNM commercial panel diagnostics', JSON.stringify({ failures }));
    return plainResponse(`Não foi possível consultar as métricas comerciais. Diagnóstico: ${failures.map(formatPublicDiagnostic).join('; ')}`, 502);
  }
}
