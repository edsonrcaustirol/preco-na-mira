import { CENTRAL_AREAS, CENTRAL_CONTRACTS } from './contracts.mjs';

const stateLabels = Object.freeze({
  informativo: 'Informativo',
  'somente-leitura': 'Somente leitura',
  'indisponivel-nesta-etapa': 'Indisponível nesta etapa',
  'contrato-pronto': 'Contrato preparado',
  'sem-persistencia-nesta-etapa': 'Sem persistência nesta etapa',
});

function areaCard(area) {
  const details = {
    painel: 'Visão operacional da Central. Nesta fundação, mostra apenas estado e próximos encaixes.',
    produtos: `Catálogo canônico: ${CENTRAL_CONTRACTS.catalog.owner}. Nenhuma edição está habilitada.`,
    'novo-produto': 'Fluxo preparado para uma etapa futura. Não há formulário com escrita nem publicação ativa.',
    'saude-links': `Integração futura com ${CENTRAL_CONTRACTS.affiliateIntegrity.contract}. Nenhuma auditoria automática é disparada aqui.`,
    historico: 'D1 não está ligado nesta etapa. Quando existir, será somente histórico, auditoria, eventos e rastreabilidade.',
  };
  return `<section class="card" id="${area.id}"><div class="card-head"><h2>${area.label}</h2><span>${stateLabels[area.state]}</span></div><p>${details[area.id]}</p></section>`;
}

export function renderCentralShell() {
  const nav = CENTRAL_AREAS.map(area => `<a href="#${area.id}">${area.label}</a>`).join('');
  const cards = CENTRAL_AREAS.map(areaCard).join('');
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Central Operacional — Preço na Mira</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#eaf2ff;background:#08111f}*{box-sizing:border-box}body{margin:0;background:linear-gradient(180deg,#08111f,#0c1727);min-height:100vh}.layout{display:grid;grid-template-columns:240px 1fr;min-height:100vh}.side{border-right:1px solid #203047;padding:28px 20px;background:#0a1422}.brand{font-weight:800;font-size:18px;margin-bottom:6px}.sub{color:#8ea3bd;font-size:13px;margin-bottom:28px}.side nav{display:grid;gap:8px}.side a{color:#cfe0f5;text-decoration:none;padding:10px 12px;border-radius:9px}.side a:hover{background:#14233a}.main{padding:34px;max-width:1100px;width:100%}.eyebrow{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8ea3bd}.hero h1{margin:8px 0 10px;font-size:30px}.hero p{margin:0;color:#a9bdd4;max-width:760px;line-height:1.6}.status{margin:24px 0;display:flex;gap:10px;flex-wrap:wrap}.pill{border:1px solid #2b415f;background:#102038;border-radius:999px;padding:8px 11px;font-size:12px;color:#bdd0e7}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.card{border:1px solid #223751;background:#0e1b2d;border-radius:14px;padding:18px;min-height:150px}.card-head{display:flex;align-items:flex-start;gap:12px;justify-content:space-between}.card h2{font-size:17px;margin:0}.card span{font-size:11px;color:#9fb8d2;border:1px solid #2b415f;border-radius:999px;padding:5px 8px}.card p{color:#a9bdd4;line-height:1.55;margin:18px 0 0}.foot{margin-top:20px;color:#7890aa;font-size:12px}@media(max-width:800px){.layout{display:block}.side{border-right:0;border-bottom:1px solid #203047}.side nav{display:flex;overflow:auto}.main{padding:24px 18px}.grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="layout">
<aside class="side"><div class="brand">Preço na Mira</div><div class="sub">Central Operacional</div><nav>${nav}</nav></aside>
<main class="main">
<section class="hero"><div class="eyebrow">Fundação L2.2</div><h1>Operação separada do site público</h1><p>Esta versão estabelece apenas a superfície administrativa e os contratos de integração. Escrita de produtos, mutações no GitHub, merge automático e monitor recorrente permanecem desligados.</p></section>
<div class="status"><div class="pill">Cloudflare Access obrigatório</div><div class="pill">Owner único: data/produtos-index.js</div><div class="pill">GitHub: somente contrato futuro</div><div class="pill">D1: não autoritativo</div></div>
<div class="grid">${cards}</div>
<div class="foot">Nenhuma ação desta tela altera catálogo, GitHub ou produção.</div>
</main>
</div>
</body>
</html>`;
}
