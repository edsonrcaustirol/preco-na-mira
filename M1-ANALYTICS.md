# M1 — Instrumentação comercial mínima

## Eventos

`page_view` registra `page`, `page_type` e, em páginas de produto, `product_id`. Pode incluir somente `utm_source`, `utm_medium`, `utm_campaign` e `referrer_host` (apenas hostname externo, nunca URL completa).

`affiliate_click` registra `product_id`, `store`, `page` e `placement`, com a mesma atribuição de tráfego quando disponível. `affiliate_click` significa que o visitante saiu do Preço na Mira para a loja; não confirma venda nem comissão.

## Placements

Vocabulário M1: `card`, `primary`, `sidebar`, `sticky`, `related`, `search_result`, `saved`, `cart`, `comparison`, `project`, `studio`, `small_spaces`, `obra_base`, `dewalt_pending`.

Links DeWalt ainda não normalizados usam `product_id=unknown` e `placement=dewalt_pending`.

## Arquitetura

A única fronteira de telemetria no navegador é `window.PNMAnalytics.track(eventName, data)`. O fragmento fica em `scripts/m1-client-fragment.js` e o build o injeta idempotentemente no `assets/pnm-platform-v18.js`, evitando uma nova requisição de script.

O envio usa `navigator.sendBeacon('/__pnm/analytics', ...)`, com fallback `fetch(..., keepalive:true)`. O Worker aceita apenas os dois eventos do M1 e grava no dataset `pnm_commercial_m1` do Workers Analytics Engine. O dataset é criado pela Cloudflare no primeiro `writeDataPoint` após uma versão com o binding ser executada.

## Privacidade

Não são enviados nome, e-mail, telefone, IP coletado manualmente, fingerprint, ID persistente, conteúdo de localStorage, carrinho, favoritos, projetos ou termos livres de busca. A atribuição usa apenas os três UTMs permitidos e hostname externo do referrer; o contexto sanitizado é mantido apenas em `sessionStorage` para sobreviver à navegação interna da mesma sessão.

## Limitações

M1 mede visitas e saídas comerciais. Não reconcilia venda/comissão do programa afiliado e não altera URLs afiliadas. Não inclui dashboard, anúncios, segunda loja ou eventos de busca/salvos/carrinho/comparação/projeto.
