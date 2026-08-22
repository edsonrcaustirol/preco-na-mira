import { executeQuery as executeM2Query } from '../scripts/m2-1-analytics-lib.mjs';
import { executeQuery as executeM3Query } from '../scripts/m3-1-analytics-lib.mjs';

export const PANEL_PATH = '/__pnm/commercial';
export const PANEL_USERNAME = 'pnm';
export const M31_START_UTC = '2026-08-22T05:24:34Z';

const encoder = new TextEncoder();
const numberFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const percentFormat = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const runtimeFetch = (...args) => fetch(...args);

function secureHeaders(contentType) {
  return {
    'cache-control': 'no-store, max-age=0',
    'content-type': contentType,
    'cross-origin-resource-policy': 'same-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
  };
}

function htmlHeaders() {
  return {
    ...secureHeaders('text/html; charset=utf-8'),
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  };
}

function plainResponse(body, status, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: { ...secureHeaders('text/plain; charset=utf-8'), ...extraHeaders },
  });
}

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(String(value))));
}

async function constantTimeEqual(left, right) {
  const [leftHash, rightHash] = await Promise.all([digest(left), digest(right)]);
  let mismatch = 0;
  for (let index = 0; index < leftHash.length; index += 1) mismatch |= leftHash[index] ^ rightHash[index];
  return mismatch === 0;
}

function decodeBasicCredential(encoded) {
  try {
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

export async function isPanelAuthorized(request, password) {
  if (!password) return false;
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Basic\s+([A-Za-z0-9+/=]+)$/i);
  if (!match) return false;
  const presented = decodeBasicCredential(match[1]);
  return constantTimeEqual(presented, `${PANEL_USERNAME}:${password}`);
}

function rows(result) {
  return Array.isArray(result?.data) ? result.data : [];
}

function firstValue(result, key) {
  return rows(result)[0]?.[key] ?? 0;
}

function classifyAnalyticsFailure(status, transportFailure) {
  if (transportFailure) return 'transport';
  if (status === 400) return 'query_rejected';
  if (status === 401) return 'authentication';
  if (status === 403) return 'authorization';
  if (status === 404) return 'account_or_endpoint';
  if (status === 429) return 'rate_limited';
  if (Number.isInteger(status) && status >= 500) return 'cloudflare_5xx';
  if (Number.isInteger(status) && status >= 400) return 'cloudflare_4xx';
  return 'unexpected';
}

async function executeDashboardQuery({ source, name, execute, options }) {
  let observedStatus = null;
  let transportFailure = false;
  const diagnosticFetch = async (...args) => {
    try {
      const response = await options.fetchImpl(...args);
      observedStatus = Number.isInteger(response?.status) ? response.status : null;
      return response;
    } catch {
      transportFailure = true;
      throw new Error('Analytics Engine transport failure.');
    }
  };

  try {
    return await execute(name, { ...options, fetchImpl: diagnosticFetch });
  } catch {
    throw {
      pnmSafeDiagnostic: true,
      source,
      query: name,
      status: observedStatus,
      category: classifyAnalyticsFailure(observedStatus, transportFailure),
    };
  }
}

function normalizeDiagnostic(reason, fallback) {
  if (reason?.pnmSafeDiagnostic === true) {
    return {
      source: String(reason.source || fallback.source),
      query: String(reason.query || fallback.name),
      status: Number.isInteger(reason.status) ? reason.status : null,
      category: String(reason.category || 'unexpected'),
    };
  }
  return { source: fallback.source, query: fallback.name, status: null, category: 'unexpected' };
}

export async function loadCommercialDashboard({ accountId, apiToken, fetchImpl = runtimeFetch } = {}) {
  const m2 = { accountId, apiToken, fetchImpl };
  const m3 = { accountId, apiToken, fetchImpl, m31StartUtc: M31_START_UTC };
  const querySpecs = [
    { source: 'M2.1', name: 'total_page_views', execute: executeM2Query, options: m2 },
    { source: 'M2.1', name: 'total_affiliate_clicks', execute: executeM2Query, options: m2 },
    { source: 'M3.1', name: 'total_commercial_impressions', execute: executeM3Query, options: m3 },
    { source: 'M2.1', name: 'affiliate_clicks_by_page', execute: executeM2Query, options: m2 },
    { source: 'M2.1', name: 'affiliate_clicks_by_product', execute: executeM2Query, options: m2 },
    { source: 'M2.1', name: 'affiliate_clicks_by_placement', execute: executeM2Query, options: m2 },
    { source: 'M3.1', name: 'impressions_by_placement', execute: executeM3Query, options: m3 },
    { source: 'M3.1', name: 'affiliate_click_rate_by_placement', execute: executeM3Query, options: m3 },
  ];
  const settled = await Promise.allSettled(querySpecs.map(spec => executeDashboardQuery(spec)));
  const failures = settled.flatMap((result, index) => result.status === 'rejected' ? [normalizeDiagnostic(result.reason, querySpecs[index])] : []);
  if (failures.length) {
    const error = new Error('Falha em uma ou mais consultas do painel comercial.');
    error.name = 'CommercialDashboardQueryError';
    error.failures = failures;
    throw error;
  }

  const [pageViews, affiliateClicks, commercialImpressions, clicksByPage, clicksByProduct, clicksByPlacement, impressionsByPlacement, ctrByPlacement] = settled.map(result => result.value);

  return {
    generatedAtUtc: new Date().toISOString(),
    m31StartUtc: M31_START_UTC,
    totals: {
      pageViews: firstValue(pageViews, 'page_views'),
      affiliateClicks: firstValue(affiliateClicks, 'affiliate_clicks'),
      commercialImpressions: firstValue(commercialImpressions, 'commercial_impressions'),
    },
    clicksByPage: rows(clicksByPage),
    clicksByProduct: rows(clicksByProduct),
    clicksByPlacement: rows(clicksByPlacement),
    impressionsByPlacement: rows(impressionsByPlacement),
    ctrByPlacement: rows(ctrByPlacement),
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatCount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numberFormat.format(numeric) : '—';
}

function formatPercent(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${percentFormat.format(numeric)}%` : '—';
}

function renderRows(items, columns, emptyMessage = 'Sem dados no período.') {
  if (!items.length) return `<tr><td colspan="${columns.length}" class="empty">${escapeHtml(emptyMessage)}</td></tr>`;
  return items.map(item => `<tr>${columns.map(column => `<td>${escapeHtml(column.format ? column.format(item[column.key]) : item[column.key])}</td>`).join('')}</tr>`).join('');
}

function renderTable(title, description, items, columns) {
  return `<section class="panel-section">
    <div class="section-heading"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div></div>
    <div class="table-wrap"><table><thead><tr>${columns.map(column => `<th scope="col">${escapeHtml(column.label)}</th>`).join('')}</tr></thead><tbody>${renderRows(items, columns)}</tbody></table></div>
  </section>`;
}

export function renderCommercialDashboard(data) {
  const countColumn = { key: 'affiliate_clicks', label: 'Cliques', format: formatCount };
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>Painel Comercial — Preço na Mira</title>
  <style>
    :root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0b0f14;color:#eef4fb}
    *{box-sizing:border-box}body{margin:0;background:#0b0f14;color:#eef4fb}main{width:min(1180px,calc(100% - 32px));margin:0 auto;padding:40px 0 64px}
    a{color:#9ac8ff}.eyebrow{margin:0 0 8px;color:#79b8ff;font-size:.78rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}h1{margin:0;font-size:clamp(2rem,5vw,3.4rem);letter-spacing:-.04em}h2{margin:0;font-size:1.05rem}p{color:#9eabb8;line-height:1.55}.top{display:flex;gap:20px;align-items:flex-end;justify-content:space-between;margin-bottom:24px}.refresh{white-space:nowrap;border:1px solid #273445;border-radius:10px;padding:9px 12px;text-decoration:none;background:#111923}
    .notice{border:1px solid #273445;border-left:3px solid #79b8ff;background:#101722;border-radius:10px;padding:14px 16px;margin:0 0 20px;color:#cbd5df}.meta{font-size:.86rem;margin:4px 0 0}
    .cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:20px 0}.card{border:1px solid #202b38;background:#101722;border-radius:14px;padding:18px}.card span{display:block;color:#8f9ba8;font-size:.82rem}.card strong{display:block;margin-top:7px;font-size:2rem;letter-spacing:-.03em}
    .panel-section{margin-top:20px;border:1px solid #202b38;background:#0f151e;border-radius:14px;overflow:hidden}.section-heading{padding:16px 18px;border-bottom:1px solid #202b38}.section-heading p{margin:5px 0 0;font-size:.86rem}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;min-width:520px}th,td{padding:11px 18px;border-bottom:1px solid #1c2631;text-align:left;font-size:.9rem}th{color:#8f9ba8;font-size:.75rem;text-transform:uppercase;letter-spacing:.06em;background:#111923}tbody tr:last-child td{border-bottom:0}.empty{color:#7f8b97}
    .foot{margin-top:22px;font-size:.82rem;color:#7f8b97}@media(max-width:720px){main{width:min(100% - 20px,1180px);padding-top:24px}.top{align-items:flex-start;flex-direction:column}.cards{grid-template-columns:1fr}.card strong{font-size:1.7rem}}
  </style>
</head>
<body>
<main>
  <header class="top"><div><p class="eyebrow">Preço na Mira · M2.2</p><h1>Painel Comercial</h1><p class="meta">Dados agregados reais do Analytics Engine · pnm_commercial_m1</p></div><a class="refresh" href="${PANEL_PATH}">Atualizar</a></header>
  <p class="notice"><strong>Leitura correta:</strong> <code>affiliate_click</code> indica um clique de saída para o Mercado Livre. Não representa venda, pedido ou comissão.</p>
  <div class="cards">
    <div class="card"><span>Page views</span><strong>${escapeHtml(formatCount(data.totals.pageViews))}</strong></div>
    <div class="card"><span>Affiliate clicks</span><strong>${escapeHtml(formatCount(data.totals.affiliateClicks))}</strong></div>
    <div class="card"><span>Commercial impressions</span><strong>${escapeHtml(formatCount(data.totals.commercialImpressions))}</strong></div>
  </div>
  ${renderTable('Cliques por página', 'Origem registrada no evento affiliate_click.', data.clicksByPage, [{ key: 'page', label: 'Página' }, countColumn])}
  ${renderTable('Cliques por produto', 'product_id registrado no evento affiliate_click.', data.clicksByProduct, [{ key: 'product_id', label: 'Produto' }, countColumn])}
  ${renderTable('Cliques por placement', 'Todos os placements válidos para affiliate_click.', data.clicksByPlacement, [{ key: 'placement', label: 'Placement' }, countColumn])}
  ${renderTable('Impressões por placement', 'M3.1 mede commercial_impression somente em card e related.', data.impressionsByPlacement, [{ key: 'placement', label: 'Placement' }, { key: 'commercial_impressions', label: 'Impressões', format: formatCount }])}
  ${renderTable('CTR comercial elegível por placement', `Cliques ÷ impressões somente para card/related e somente a partir de ${M31_START_UTC.replace('T', ' ').replace('Z', ' UTC')}.`, data.ctrByPlacement, [{ key: 'placement', label: 'Placement' }, { key: 'commercial_impressions', label: 'Impressões elegíveis', format: formatCount }, { key: 'affiliate_clicks', label: 'Cliques elegíveis', format: formatCount }, { key: 'affiliate_click_rate_pct', label: 'CTR', format: formatPercent }])}
  <p class="foot">Atualizado em ${escapeHtml(data.generatedAtUtc)} · Sem métricas de receita, pedido ou comissão.</p>
</main>
</body>
</html>`;
  return html;
}

function safeDiagnosticsFromError(error) {
  if (Array.isArray(error?.failures) && error.failures.length) {
    return error.failures.map(failure => ({
      source: String(failure.source || 'unknown'),
      query: String(failure.query || 'unknown'),
      status: Number.isInteger(failure.status) ? failure.status : null,
      category: String(failure.category || 'unexpected'),
    }));
  }
  return [{ source: 'panel', query: 'unknown', status: null, category: 'unexpected' }];
}

function formatPublicDiagnostic(failure) {
  return `${failure.source}:${failure.query} — HTTP ${failure.status ?? 'n/a'} — ${failure.category}`;
}

export async function handleCommercialPanel(request, env, { fetchImpl = runtimeFetch } = {}) {
  const password = String(env?.PNM_PANEL_PASSWORD || '');
  if (!password) return plainResponse('Painel comercial não configurado.', 503);

  if (!(await isPanelAuthorized(request, password))) {
    return plainResponse('Autenticação necessária.', 401, { 'www-authenticate': 'Basic realm="PNM Comercial", charset="UTF-8"' });
  }

  if (request.method !== 'GET') return plainResponse('Método não permitido.', 405, { allow: 'GET' });

  const accountId = String(env?.PNM_CF_ACCOUNT_ID || '');
  const apiToken = String(env?.PNM_CF_ANALYTICS_TOKEN || '');
  if (!accountId || !apiToken) return plainResponse('Configuração de leitura do painel incompleta.', 503);

  try {
    const data = await loadCommercialDashboard({ accountId, apiToken, fetchImpl });
    return new Response(renderCommercialDashboard(data), { status: 200, headers: htmlHeaders() });
  } catch (error) {
    const failures = safeDiagnosticsFromError(error);
    console.error('PNM commercial panel diagnostics', JSON.stringify({ failures }));
    return plainResponse(`Não foi possível consultar as métricas comerciais. Diagnóstico: ${failures.map(formatPublicDiagnostic).join('; ')}`, 502);
  }
}
