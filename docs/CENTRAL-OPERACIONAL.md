# Central Operacional — Fundação L2.2

## Escopo desta etapa

Esta fundação cria uma superfície administrativa separada e somente informativa para a futura Central Operacional do Preço na Mira.

Nesta etapa permanecem **desligados**:

- adicionar, editar ou remover produtos;
- cadastro em lote;
- mutações no GitHub;
- merge automático;
- correção automática de links;
- monitor recorrente de links;
- persistência D1.

O catálogo continua tendo um único owner canônico:

`data/produtos-index.js`

A Central não cria banco de produtos próprio.

## Arquitetura preparada

Fluxo previsto:

`central.preconamira.com.br -> Cloudflare Access -> Worker administrativo separado -> contratos E2/L1.1/GitHub`

O Worker público existente continua independente. A configuração administrativa está em `central/wrangler.jsonc` e usa outro nome e outro entrypoint.

O `workers_dev` e os preview URLs da Central ficam desativados. A rota customizada para `central.preconamira.com.br` **não é adicionada nesta etapa** para impedir exposição antes da configuração do Cloudflare Access.

## Cloudflare Access — configuração externa obrigatória antes de qualquer exposição

Antes de adicionar a rota `central.preconamira.com.br` ao Worker administrativo:

1. criar no Cloudflare Zero Trust uma aplicação Access do tipo **Self-hosted** para `central.preconamira.com.br`;
2. criar política `Allow` apenas para o proprietário/grupo administrativo autorizado;
3. não criar política pública, bypass ou regra que permita acesso anônimo;
4. copiar o **Application Audience (AUD) tag** da aplicação Access para a variável de runtime `PNM_CENTRAL_ACCESS_AUD` do Worker administrativo;
5. confirmar que `PNM_CENTRAL_EXPECTED_HOST=central.preconamira.com.br`;
6. somente depois adicionar a rota/custom domain `central.preconamira.com.br` ao Worker `preco-na-mira-central`;
7. manter `workers_dev=false` e `preview_urls=false` enquanto a superfície administrativa depender exclusivamente do domínio protegido.

O Worker falha com `503 CENTRAL_CONFIG_INCOMPLETE` quando a configuração administrativa obrigatória estiver ausente e com `403 CLOUDFLARE_ACCESS_REQUIRED` quando o request não trouxer o assertion header injetado pelo Cloudflare Access.

O Worker **não implementa usuário/senha próprio** e não armazena senha no repositório.

## Owner único e E2

A Central referencia explicitamente:

- owner: `data/produtos-index.js`;
- validação E2: `npm run validate:e2-catalog`;
- teste de ciclo E2: `npm run test:e2-catalog-operations`;
- módulo E2: `scripts/validar-catalogo-operacional.mjs`.

Na etapa funcional futura, qualquer alteração de catálogo deverá editar somente o owner canônico e depois executar a cadeia E2 antes de criar a transação GitHub.

## Auditoria L1.1

Contrato preparado para reaproveitar:

- comando: `npm run audit:affiliate-integrity`;
- CLI: `scripts/audit-affiliate-integrity.mjs`;
- contrato: `pnm.affiliate-integrity/v1`.

Nenhuma auditoria automática é disparada pela Central nesta fundação.

## GitHub transacional

O contrato futuro preserva:

`branch -> commit -> pull request -> CI validar -> merge controlado`

A flag de mutação GitHub permanece `false` nesta etapa. Não existe token GitHub, Authorization header nem chamada de escrita no Worker administrativo.

## D1

Nenhum binding D1 é criado nesta etapa.

Quando for adicionado, D1 poderá registrar exclusivamente:

- histórico;
- auditorias;
- eventos operacionais;
- rastreabilidade.

D1 nunca poderá ser catálogo autoritativo nem segunda cópia owner dos produtos.

## Áreas da interface

A shell administrativa contém:

- Painel;
- Produtos;
- Novo Produto;
- Saúde dos Links;
- Histórico.

Todas as áreas são informativas ou indisponíveis para escrita nesta etapa.
