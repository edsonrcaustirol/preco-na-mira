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
4. copiar o **Application Audience (AUD) tag** da aplicação Access para `PNM_CENTRAL_ACCESS_AUD`;
5. configurar `PNM_CENTRAL_ACCESS_ISSUER` com o team domain oficial do Access no formato `https://<team-name>.cloudflareaccess.com`;
6. confirmar que `PNM_CENTRAL_EXPECTED_HOST=central.preconamira.com.br`;
7. somente depois adicionar a rota/custom domain `central.preconamira.com.br` ao Worker `preco-na-mira-central`;
8. manter `workers_dev=false` e `preview_urls=false` enquanto a superfície administrativa depender exclusivamente do domínio protegido.

Variáveis obrigatórias de runtime:

- `PNM_CENTRAL_ACCESS_AUD`: Application Audience (AUD) tag da aplicação Access;
- `PNM_CENTRAL_ACCESS_ISSUER`: team domain/issuer oficial do Access, exclusivamente em `https://<team-name>.cloudflareaccess.com`;
- `PNM_CENTRAL_EXPECTED_HOST`: host administrativo esperado, `central.preconamira.com.br`.

Nenhum desses valores é enviado ao navegador como credencial. O AUD e o issuer identificam a aplicação/tenant; chaves privadas, tokens e secrets não são armazenados no código.

## Validação criptográfica do assertion

A presença do header `Cf-Access-Jwt-Assertion` **não é suficiente** para autenticar.

Antes de servir qualquer área administrativa, o Worker:

1. exige a configuração obrigatória;
2. exige o host administrativo esperado;
3. exige um JWT estruturalmente válido no header `Cf-Access-Jwt-Assertion`;
4. aceita somente `RS256`;
5. busca o JWKS público oficial em `PNM_CENTRAL_ACCESS_ISSUER + /cdn-cgi/access/certs`;
6. seleciona a chave pública pelo `kid` e valida criptograficamente a assinatura;
7. exige `iss` exatamente igual ao issuer configurado;
8. exige que `aud` contenha exatamente o Application AUD configurado em `PNM_CENTRAL_ACCESS_AUD`;
9. exige `exp` válido e não expirado;
10. valida `nbf` e `iat` quando presentes.

A consulta ao JWKS usa somente o team domain configurado e aceito sob `*.cloudflareaccess.com`; não há domínio de conta hardcoded.

Falhas fechadas:

- configuração obrigatória ausente ou inválida: `503 CENTRAL_CONFIG_INCOMPLETE`;
- assertion ausente: `403 CLOUDFLARE_ACCESS_REQUIRED`;
- JWT malformado, assinatura inválida, chave desconhecida, algoritmo incorreto, issuer incorreto, AUD incorreto ou token temporalmente inválido: `403 CLOUDFLARE_ACCESS_INVALID`.

A resposta HTTP não expõe o motivo criptográfico interno da rejeição.

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
