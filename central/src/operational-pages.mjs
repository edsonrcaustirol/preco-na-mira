import { CENTRAL_AREAS, CENTRAL_CONTRACTS } from './contracts.mjs';
import { CENTRAL_OPERATIONAL_CONTRACT } from './operational-read-model.mjs';

const PATHS = Object.freeze({ painel: '/painel', produtos: '/produtos', 'novo-produto': '/novo-produto', 'saude-links': '/saude-links', historico: '/historico' });
const COMMERCIAL_PANEL_URL = 'https://preconamira.com.br/__pnm/commercial';

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function nav(active) {
  const internal = CENTRAL_AREAS.map(area => `<a href="${PATHS[area.id]}"${area.id === active ? ' aria-current="page"' : ''}>${escapeHtml(area.label)}</a>`).join('');
  return `${internal}<a href="${COMMERCIAL_PANEL_URL}" target="_blank" rel="noopener noreferrer">Painel Comercial ↗</a>`;
}

function value(number) {
  return Number.isFinite(number) ? String(number) : '—';
}

function date(value) {
  return value ? escapeHtml(value) : '—';
}

function statusClass(status) {
  return status === 'SUCCESS' ? 'ok' : status === 'PARTIAL' ? 'warn' : status === 'FAILED' ? 'bad' : '';
}

const BASE_STYLE = `:root{font-family:Inter,system-ui,sans-serif;color:#eaf2ff;background:#08111f}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#08111f;overflow-x:hidden}.layout{display:grid;grid-template-columns:230px minmax(0,1fr);min-height:100vh}.side{padding:24px 18px;border-right:1px solid #203047}.brand{font-weight:800}.sub,.muted{color:#8ea3bd}.side nav{display:grid;gap:6px;margin-top:24px}.side a{color:#cfe0f5;text-decoration:none;padding:10px;border-radius:8px}.side a[aria-current=page],.side a:hover{background:#14233a}.main{padding:30px;min-width:0;max-width:1300px;width:100%}h1{margin:6px 0}.status{display:flex;gap:7px;flex-wrap:wrap;margin:18px 0}.pill{border:1px solid #34506f;border-radius:999px;padding:5px 8px;font-size:11px}.notice{border:1px dashed #34506f;border-radius:12px;padding:16px;color:#a9bdd4;margin:16px 0}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:18px 0}.metric,.panel{border:1px solid #223751;background:#0e1b2d;border-radius:12px;padding:14px;min-width:0}.metric span{display:block;color:#8ea3bd;font-size:11px}.metric strong{display:block;font-size:24px;margin-top:5px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.panel h2{font-size:15px;margin:0 0 12px}.panel-link{display:inline-block;margin-top:10px;color:#cfe0f5}.row{display:grid;grid-template-columns:minmax(120px,180px) minmax(0,1fr);gap:10px;padding:7px 0;border-bottom:1px solid #182a41}.row span{color:#7890aa}.row strong{font-weight:500;overflow-wrap:anywhere}.run-list,.event-list,.result-list{display:grid;gap:8px}.run,.event,.result-item{border:1px solid #223751;border-radius:10px;padding:11px;display:grid;grid-template-columns:minmax(130px,1fr) repeat(3,minmax(90px,.7fr));gap:10px;align-items:center}.ok{color:#8fe0b0}.warn{color:#ffd28a}.bad{color:#ff9e9e}.technical{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;overflow-wrap:anywhere;color:#9fb8d2}.section{margin-top:20px}@media(max-width:800px){.layout{display:block}.side{border-right:0;border-bottom:1px solid #203047}.side nav{display:flex;flex-wrap:wrap}.main{padding:22px 16px}.metrics,.grid{grid-template-columns:1fr 1fr}.run,.event,.result-item,.row{grid-template-columns:1fr}}@media(max-width:480px){.metrics,.grid{grid-template-columns:1fr}}`;

function shell(active, title, subtitle, body) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} — Preço na Mira</title><style>${BASE_STYLE}</style></head><body><div class="layout"><aside class="side"><div class="brand">Preço na Mira</div><div class="sub">Central Operacional</div><nav>${nav(active)}</nav></aside><main class="main"><div class="muted">L2.4G · ${CENTRAL_OPERATIONAL_CONTRACT}</div><h1>${escapeHtml(title)}</h1><p class="muted">${escapeHtml(subtitle)}</p>${body}</main></div></body></html>`;
}

export function renderOperationalDashboard(model) {
  if (!model || model.contract !== CENTRAL_OPERATIONAL_CONTRACT) throw new Error('invalid-central-operational-model');
  const historyReady = model.history.status === 'available';
  const latest = model.history.latestRun;
  const healthy = model.history.latestHealthyFull;
  const degraded = latest && latest.status !== 'SUCCESS';
  const notice = historyReady ? '' : `<div class="notice"><strong>Histórico remoto ainda não provisionado.</strong><br>O catálogo real continua disponível, mas métricas de auditoria não são inventadas.</div>`;
  const body = `<div class="status"><span class="pill">Central somente leitura</span><span class="pill">Owner único: ${escapeHtml(model.catalog.owner)}</span><span class="pill">Monitor configurado: ${model.monitor.configured ? 'SIM' : 'NÃO'}</span><span class="pill">D1 remoto: ${model.history.remoteProvisioned ? 'PROVISIONADO' : 'NÃO PROVISIONADO'}</span></div>${notice}<section class="metrics"><div class="metric"><span>PRODUTOS</span><strong>${model.catalog.total}</strong></div><div class="metric"><span>PRECISA DE ATENÇÃO</span><strong>${value(model.health.attention)}</strong></div><div class="metric"><span>NÃO_COMPROVÁVEL</span><strong>${value(model.health.nonVerifiable)}</strong></div><div class="metric"><span>AUDITORIA ATUAL</span><strong>${value(model.health.currentResults)}</strong></div></section><section class="grid"><div class="panel"><h2>Catálogo</h2><div class="row"><span>Estado</span><strong>Read-only</strong></div><div class="row"><span>Fonte</span><strong>${escapeHtml(model.catalog.source)}</strong></div><div class="row"><span>Total</span><strong>${model.catalog.total}</strong></div></div><div class="panel"><h2>Monitor</h2><div class="row"><span>Agenda</span><strong>${escapeHtml(model.monitor.schedule || '—')}</strong></div><div class="row"><span>Cadência</span><strong>domingo/quarta · 3/4 dias</strong></div><div class="row"><span>Execução agendada observada</span><strong>${model.monitor.observedScheduledRun ? 'SIM' : 'NÃO COMPROVADA'}</strong></div></div><div class="panel"><h2>Última execução</h2><div class="row"><span>Status</span><strong class="${statusClass(latest?.status)}">${escapeHtml(latest?.status || '—')}</strong></div><div class="row"><span>Escopo</span><strong>${escapeHtml(latest?.scope || '—')}</strong></div><div class="row"><span>Finalizada</span><strong>${date(latest?.finishedAt)}</strong></div>${degraded ? '<div class="notice">A execução mais recente está degradada/falhou; ela não substitui silenciosamente a última FULL saudável.</div>' : ''}</div><div class="panel"><h2>Última FULL saudável</h2><div class="row"><span>Run</span><strong>${escapeHtml(healthy?.runId || '—')}</strong></div><div class="row"><span>Status</span><strong class="${statusClass(healthy?.status)}">${escapeHtml(healthy?.status || '—')}</strong></div><div class="row"><span>Finalizada</span><strong>${date(healthy?.finishedAt)}</strong></div></div><div class="panel"><h2>Painel Comercial</h2><p class="muted">C2 já existente no site público administrativo. A Central apenas navega para ele; Analytics Engine e credenciais não são duplicados aqui.</p><a class="panel-link" href="${COMMERCIAL_PANEL_URL}" target="_blank" rel="noopener noreferrer">Abrir Painel Comercial ↗</a></div></section>`;
  return shell('painel', 'Painel', 'Estado operacional consolidado sem exposição administrativa e sem números inventados.', body);
}

function runCard(item) {
  return `<article class="run"><strong class="technical">${escapeHtml(item.runId || '—')}</strong><span>${escapeHtml(item.scope || '—')}</span><span class="${statusClass(item.status)}">${escapeHtml(item.status || '—')}</span><span>${date(item.finishedAt || item.startedAt)}</span></article>`;
}

function eventCard(item) {
  return `<article class="event"><strong>${escapeHtml(item.event_type || item.eventType || 'EVENTO')}</strong><span>${escapeHtml(item.product_id || item.productId || '—')}</span><span class="technical">${escapeHtml(item.run_id || item.runId || '—')}</span><span>${date(item.occurred_at || item.occurredAt)}</span></article>`;
}

function resultCard(item) {
  return `<article class="result-item"><strong>${escapeHtml(item.product_id || item.productId || '—')}</strong><span>${escapeHtml(item.classification || '—')}</span><span>${escapeHtml(item.scope || '—')} · ${escapeHtml(item.status || '—')}</span><span>${date(item.checked_at || item.checkedAt)}</span></article>`;
}

export function renderOperationalHistory({ historyStatus = 'unbound', history = null } = {}) {
  const available = historyStatus === 'available' && history;
  const runs = available && Array.isArray(history.recentRuns) ? history.recentRuns : [];
  const events = available && Array.isArray(history.events) ? history.events : [];
  const results = available && Array.isArray(history.results) ? history.results : [];
  const healthy = available ? history.latestHealthyFull : null;
  const notice = available ? '' : `<div class="notice"><strong>Histórico remoto ainda não provisionado.</strong><br>Schema e regras estão versionados, mas nenhum D1 remoto é presumido como operacional.</div>`;
  const body = `<div class="status"><span class="pill">Somente leitura</span><span class="pill">Contrato: ${escapeHtml(CENTRAL_CONTRACTS.d1.historyContract)}</span><span class="pill">D1 remoto: ${CENTRAL_CONTRACTS.d1.remoteProvisioned ? 'PROVISIONADO' : 'NÃO PROVISIONADO'}</span></div>${notice}<section class="metrics"><div class="metric"><span>RUNS RECENTES</span><strong>${available ? runs.length : '—'}</strong></div><div class="metric"><span>RESULTADOS</span><strong>${available ? results.length : '—'}</strong></div><div class="metric"><span>EVENTOS</span><strong>${available ? events.length : '—'}</strong></div><div class="metric"><span>ÚLTIMA FULL SAUDÁVEL</span><strong>${healthy ? 'SUCCESS' : '—'}</strong></div></section><section class="section panel"><h2>Execuções</h2>${runs.length ? `<div class="run-list">${runs.map(runCard).join('')}</div>` : '<p class="muted">Nenhuma execução persistida disponível.</p>'}</section><section class="section panel"><h2>Resultados recentes</h2>${results.length ? `<div class="result-list">${results.slice(0, 100).map(resultCard).join('')}</div>` : '<p class="muted">Nenhum resultado persistido disponível.</p>'}</section><section class="section panel"><h2>Eventos factuais</h2>${events.length ? `<div class="event-list">${events.slice(0, 100).map(eventCard).join('')}</div>` : '<p class="muted">Nenhum evento persistido disponível.</p>'}</section><p class="muted section">Detalhes técnicos são mostrados por run/SHA quando existem; JSON cru não é a experiência principal.</p>`;
  return shell('historico', 'Histórico', 'Runs, resultados e eventos factuais do monitor, sem transformar D1 em catálogo.', body);
}
