import {
  CENTRAL_LINK_HEALTH_CONTRACT,
  AFFILIATE_INTEGRITY_CONTRACT,
  LINK_HEALTH_CLASSIFICATIONS,
  LINK_HEALTH_ATTENTION_CLASSIFICATIONS,
  LINK_HEALTH_NON_VERIFIABLE,
} from './link-health.mjs';

const PATHS = Object.freeze({
  painel: '/painel',
  produtos: '/produtos',
  'novo-produto': '/novo-produto',
  'saude-links': '/saude-links',
  historico: '/historico',
});

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeJson(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
}

function count(value) {
  return Number.isFinite(value) ? String(value) : '—';
}

function options() {
  const official = LINK_HEALTH_CLASSIFICATIONS
    .map(state => `<option value="${escapeHtml(state)}">${escapeHtml(state)}</option>`)
    .join('');
  return `<option value="attention">PRECISA DE ATENÇÃO</option><option value="non-verifiable">${escapeHtml(LINK_HEALTH_NON_VERIFIABLE)}</option><option value="all">TODOS OS RESULTADOS ATUAIS</option>${official}`;
}

function resultCard(result, index) {
  return `<button class="result-card" type="button" data-result-index="${index}" data-classification="${escapeHtml(result.classification)}" data-attention="${result.requiresAttention ? 'true' : 'false'}" data-non-verifiable="${result.nonVerifiable ? 'true' : 'false'}"><span class="classification">${escapeHtml(result.classification)}</span><strong>${escapeHtml(result.productId)}</strong><span class="reason">${escapeHtml(result.reason || 'Sem resumo adicional.')}</span></button>`;
}

function staleCard(result) {
  return `<div class="stale-card"><span class="classification">RESULTADO OBSOLETO</span><strong>${escapeHtml(result.productId)}</strong><span class="reason">${escapeHtml(result.reason || 'O link atual mudou desde a auditoria.')}</span><small>${escapeHtml(result.checkedAt || 'Data indisponível')}</small></div>`;
}

function clientScript(readModel) {
  return `(function(){'use strict';
const model=${safeJson(readModel)},filter=document.getElementById('health-filter'),cards=[...document.querySelectorAll('[data-result-index]')],empty=document.getElementById('filtered-empty'),detail=document.getElementById('health-detail'),detailTitle=document.getElementById('health-detail-title'),detailBody=document.getElementById('health-detail-body');
function matches(card,value){if(value==='all')return true;if(value==='attention')return card.dataset.attention==='true';if(value==='non-verifiable')return card.dataset.nonVerifiable==='true';return card.dataset.classification===value}
function apply(){let shown=0;cards.forEach(card=>{const show=matches(card,filter.value);card.hidden=!show;if(show)shown++});empty.hidden=shown!==0||model.availability!=='available'}
function show(index){const item=model.results[index];if(!item)return;detailTitle.textContent=item.productId;detailBody.replaceChildren();[['Classificação',item.classification],['Mudança objetiva',item.delta],['Motivo',item.reason],['Link auditado',item.auditedLink],['Verificado em',item.checkedAt],['Run',item.runId]].forEach(([label,value])=>{const row=document.createElement('div'),a=document.createElement('span'),b=document.createElement('strong');a.textContent=label;b.textContent=value||'—';row.className='row';row.append(a,b);detailBody.append(row)});detail.hidden=false;detail.scrollIntoView({behavior:'smooth',block:'start'})}
filter.addEventListener('change',apply);document.getElementById('health-results').addEventListener('click',event=>{const card=event.target.closest('[data-result-index]');if(card)show(Number(card.dataset.resultIndex))});document.getElementById('health-detail-close').addEventListener('click',()=>{detail.hidden=true});apply();})();`;
}

export function renderLinkHealthPage(readModel, nonce) {
  if (!readModel || readModel.contract !== CENTRAL_LINK_HEALTH_CONTRACT || readModel.sourceContract !== AFFILIATE_INTEGRITY_CONTRACT || !Array.isArray(readModel.results)) {
    throw new Error('invalid-central-link-health-read-model');
  }

  const nav = Object.entries(PATHS).map(([id, href]) => `<a href="${href}"${id === 'saude-links' ? ' aria-current="page"' : ''}>${id === 'saude-links' ? 'Saúde dos Links' : id === 'novo-produto' ? 'Novo Produto' : id.charAt(0).toUpperCase() + id.slice(1)}</a>`).join('');
  const summary = readModel.summary;
  const coverage = readModel.coverage;
  const cards = readModel.results.map(resultCard).join('');
  const staleCards = (readModel.staleResults || []).map(staleCard).join('');
  const unavailable = readModel.availability === 'none';
  const runLabel = readModel.run?.finishedAt || 'Nenhuma auditoria disponível';
  const fullLabel = readModel.referenceFull?.finishedAt || 'Nenhuma FULL saudável disponível';
  const historyLabel = readModel.historyStatus === 'available' ? 'Histórico disponível' : readModel.historyStatus === 'unbound' ? 'D1 ainda não vinculado' : 'Histórico indisponível';

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Saúde dos Links — Preço na Mira</title><style>
:root{font-family:Inter,system-ui,sans-serif;color:#eaf2ff;background:#08111f}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#08111f}.layout{display:grid;grid-template-columns:230px minmax(0,1fr);min-height:100vh}.side{padding:24px 18px;border-right:1px solid #203047}.brand{font-weight:800}.sub,.muted,small{color:#8ea3bd}.side nav{display:grid;gap:6px;margin-top:24px}.side a{color:#cfe0f5;text-decoration:none;padding:10px;border-radius:8px}.side a[aria-current=page],.side a:hover{background:#14233a}.main{padding:30px;min-width:0;max-width:1300px;width:100%}h1{margin:6px 0}.status{display:flex;gap:7px;flex-wrap:wrap;margin:18px 0}.pill{border:1px solid #34506f;border-radius:999px;padding:5px 8px;font-size:11px}.summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:18px 0}.metric{border:1px solid #223751;background:#0e1b2d;border-radius:12px;padding:14px}.metric span{display:block;color:#8ea3bd;font-size:11px}.metric strong{display:block;font-size:24px;margin-top:5px}.toolbar{display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin:18px 0}.field{display:grid;gap:5px;min-width:240px}.field label{font-size:11px;color:#8ea3bd}.field select{border:1px solid #2b415f;background:#0e1b2d;color:#eaf2ff;border-radius:9px;padding:10px}.notice,.empty{border:1px dashed #34506f;border-radius:12px;padding:18px;color:#a9bdd4}.results,.stale-list{display:grid;gap:9px}.result-card,.stale-card{display:grid;grid-template-columns:180px minmax(140px,240px) minmax(0,1fr);gap:12px;align-items:center;text-align:left;border:1px solid #223751;background:#0e1b2d;color:#eaf2ff;border-radius:11px;padding:12px}.stale-card{grid-template-columns:180px minmax(140px,240px) minmax(0,1fr) auto;border-style:dashed}.result-card[hidden],.empty[hidden],.detail[hidden]{display:none}.classification{font-size:11px;border:1px solid #34506f;border-radius:999px;padding:5px 8px;width:max-content;max-width:100%}.reason{color:#9fb8d2;overflow-wrap:anywhere}.detail{margin-top:18px;border:1px solid #2b415f;background:#0b1828;border-radius:14px;padding:18px}.detail-head{display:flex;justify-content:space-between;gap:12px}.close,.actions button{border:1px solid #2b415f;background:#14233a;color:#eaf2ff;border-radius:8px;padding:8px 10px}.row{display:grid;grid-template-columns:150px minmax(0,1fr);gap:10px;padding:7px 0;border-bottom:1px solid #182a41}.row span{color:#7890aa}.row strong{font-weight:500;overflow-wrap:anywhere}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.actions button:disabled{opacity:.45}.legend,.history-note{margin-top:18px;color:#8ea3bd;font-size:12px;line-height:1.6}.stale-section{margin-top:24px}@media(max-width:800px){.layout{display:block}.side{border-right:0;border-bottom:1px solid #203047}.side nav{display:flex;overflow:auto}.main{padding:22px 16px}.summary{grid-template-columns:repeat(2,minmax(0,1fr))}.result-card,.stale-card,.row{grid-template-columns:1fr}.field{min-width:100%;width:100%}.field select{width:100%}}
</style></head><body><div class="layout"><aside class="side"><div class="brand">Preço na Mira</div><div class="sub">Central Operacional</div><nav>${nav}</nav></aside><main class="main"><div class="muted">L2.4E · ${escapeHtml(CENTRAL_LINK_HEALTH_CONTRACT)}</div><h1>Saúde dos Links</h1><p class="muted">Leitura segura do histórico produzido pelo auditor oficial ${escapeHtml(AFFILIATE_INTEGRITY_CONTRACT)}. Resultado de link antigo nunca representa o link atual.</p><div class="status"><span class="pill">Somente leitura</span><span class="pill">${escapeHtml(historyLabel)}</span><span class="pill">Última referência: ${escapeHtml(runLabel)}</span><span class="pill">Última FULL saudável: ${escapeHtml(fullLabel)}</span></div>
<section class="summary" aria-label="Resumo"><div class="metric"><span>PRECISA DE ATENÇÃO</span><strong>${count(summary?.attention)}</strong></div><div class="metric"><span>${escapeHtml(LINK_HEALTH_NON_VERIFIABLE)}</span><strong>${count(summary?.nonVerifiable)}</strong></div><div class="metric"><span>RESULTADOS ATUAIS</span><strong>${count(coverage?.currentResults ?? summary?.total)}</strong></div><div class="metric"><span>RESULTADOS OBSOLETOS</span><strong>${count(coverage?.staleResults)}</strong></div></section>
<div class="toolbar"><div class="field"><label for="health-filter">Mostrar</label><select id="health-filter">${options()}</select></div></div>
${unavailable ? '<div class="notice" id="health-unavailable"><strong>Nenhuma auditoria disponível.</strong><br>Sem resultado compatível com o link atual, a Central não inventa um estado de saúde.</div>' : ''}
<section class="results" id="health-results" aria-live="polite">${cards}</section><div class="empty" id="filtered-empty" hidden>Nenhum resultado atual corresponde ao filtro selecionado.</div>
${staleCards ? `<section class="stale-section"><h2>Resultados obsoletos</h2><p class="muted">Estes resultados pertencem a links anteriores e ficam fora da saúde atual.</p><div class="stale-list">${staleCards}</div></section>` : ''}
<section class="detail" id="health-detail" hidden aria-labelledby="health-detail-title"><div class="detail-head"><div><div class="muted">Detalhe do resultado atual</div><h2 id="health-detail-title"></h2></div><button class="close" id="health-detail-close" type="button">Fechar</button></div><div id="health-detail-body"></div><div class="actions"><button type="button" disabled>AUDITAR NOVAMENTE</button><button type="button" disabled>INFORMAR NOVO LINK</button></div></section>
<div class="history-note">Cobertura: ${count(coverage?.productsTotal)} produtos · ${count(coverage?.notAudited)} sem auditoria atual. As ações permanecem indisponíveis enquanto a operação administrativa segura não estiver liberada.</div><div class="legend">PRECISA DE ATENÇÃO = ${LINK_HEALTH_ATTENTION_CLASSIFICATIONS.map(escapeHtml).join(' · ')}.<br>${escapeHtml(LINK_HEALTH_NON_VERIFIABLE)} fica separado e nunca é tratado automaticamente como link quebrado. Deltas são fatos objetivos; não existe hierarquia inventada de “piorou”.</div>
<script nonce="${escapeHtml(nonce)}">${clientScript(readModel)}</script></main></div></body></html>`;
}
