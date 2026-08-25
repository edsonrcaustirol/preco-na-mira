import { renderProductsPage } from './products-page.mjs';
import { productHealthState } from './operational-read-model.mjs';

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function safeJson(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
}

export function renderOperationalProductsPage(projection, linkHealth, nonce) {
  const base = renderProductsPage(projection, nonce);
  const health = projection.products.map(product => ({ id: product.id, ...productHealthState(product.id, linkHealth) }));
  const label = linkHealth?.historyStatus === 'available' ? 'Histórico integrado' : linkHealth?.historyStatus === 'unavailable' ? 'Histórico indisponível' : 'Histórico remoto ainda não provisionado';
  const replacement = `<section class="section" id="detail-health"><h3>SAÚDE DO LINK</h3><p id="detail-health-state">${escapeHtml(label)}</p><div id="detail-health-data"></div><div class="actions"><button type="button" disabled>AUDITAR NOVAMENTE</button></div></section>`;
  const withSection = base.replace('<section class="section"><h3>SAÚDE DO LINK</h3><p>Saúde dos links será integrada na próxima etapa.</p></section>', replacement);
  const script = `<script nonce="${escapeHtml(nonce)}">(function(){'use strict';const health=${safeJson(health)},grid=document.getElementById('grid'),state=document.getElementById('detail-health-state'),data=document.getElementById('detail-health-data');function row(k,v){const r=document.createElement('div');r.className='row';const a=document.createElement('span'),b=document.createElement('strong');a.textContent=k;b.textContent=v||'—';r.append(a,b);return r}function show(i){const h=health[i];if(!h)return;data.replaceChildren();if(h.state==='current'){state.textContent='Resultado atual compatível com o link atual';data.append(row('Classificação',h.classification),row('Verificado em',h.checkedAt),row('Run',h.runId),row('Mudança objetiva',h.delta),row('Motivo',h.reason));}else if(h.state==='stale'){state.textContent='Resultado obsoleto — link atual mudou';data.append(row('Verificado em',h.checkedAt),row('Run',h.runId),row('Motivo',h.reason));}else{state.textContent='Produto ainda sem auditoria atual';}}grid.addEventListener('click',event=>{const button=event.target.closest('[data-open-product]');if(button)show(Number(button.dataset.openProduct))});})();</script>`;
  return withSection.replace('</main></div></body></html>', `${script}</main></div></body></html>`);
}
