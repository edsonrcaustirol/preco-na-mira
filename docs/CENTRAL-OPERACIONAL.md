# Central Operacional — modo gratuito sem cartão

## Estado atual

A Central do Preço na Mira usa um Worker administrativo separado em `central.preconamira.com.br`, autenticado diretamente pelo GitHub OAuth.

O Cloudflare Zero Trust / Access **não é requisito de produção**. A barreira administrativa ativa é implementada no próprio Worker por:

`central.preconamira.com.br -> GitHub OAuth + PKCE -> sessão assinada -> Central -> GitHub transacional`

O catálogo continua com owner único em:

`data/produtos-index.js`

A Central não mantém uma segunda cópia autoritativa do catálogo.

## Objetivo desta configuração

A Central deve funcionar com os componentes gratuitos já usados pelo projeto e sem cadastrar cartão de crédito:

- Cloudflare Workers Free;
- Custom Domain `central.preconamira.com.br`;
- GitHub OAuth App;
- GitHub Actions do repositório público;
- GitHub como owner e executor transacional.

Nenhum plano Zero Trust é necessário.

## Worker e domínio

A configuração está em `central/wrangler.jsonc`.

Regras obrigatórias:

- Worker: `preco-na-mira-central`;
- entrypoint: `central/src/runtime-worker.mjs`;
- `workers_dev=false`;
- `preview_urls=false`;
- Custom Domain: `central.preconamira.com.br`;
- host diferente de `central.preconamira.com.br` é rejeitado pelo runtime;
- o Worker público de `preconamira.com.br` permanece separado e não serve a Central.

A primeira publicação não depende de D1. Sem `PNM_HISTORY_DB`, o histórico operacional fica em estado `unbound`, mas autenticação, leitura da projeção e fluxo de produto continuam independentes desse banco. D1 poderá ser conectado depois sem virar owner do catálogo.

## Autenticação GitHub OAuth

Rotas:

- login: `/auth/github/login`;
- callback: `/auth/github/callback`;
- logout: `/auth/logout`.

Fluxo:

1. o Worker gera `state` criptograficamente aleatório;
2. gera `code_verifier` e envia `code_challenge` SHA-256 ao GitHub (PKCE/S256);
3. o callback exige o mesmo `state` e o `code_verifier` original;
4. o Worker troca o `code` no backend, nunca no navegador;
5. busca `https://api.github.com/user`;
6. aceita somente o GitHub user ID configurado e o login configurado;
7. descarta o token OAuth após identificar o usuário;
8. cria sessão HMAC-SHA-256 com validade de 4 horas;
9. grava a sessão em cookie `__Host-` com `HttpOnly`, `Secure` e `SameSite=Lax`.

O token OAuth usado para identificar o administrador não é armazenado e não é usado para alterar o repositório.

## Identidade autorizada

Configuração atual não secreta:

- `PNM_GITHUB_ALLOWED_USER_ID=315643281`;
- `PNM_GITHUB_ALLOWED_LOGIN=edsonrcaustirol`;
- `PNM_CENTRAL_EXPECTED_HOST=central.preconamira.com.br`;
- `PNM_CENTRAL_AUTH_MODE=github-oauth`.

A autorização usa o ID numérico além do login, evitando depender apenas de um nome de usuário mutável.

## GitHub OAuth App

No GitHub, em **Settings -> Developer settings -> OAuth Apps**, o aplicativo da Central deve ter:

- Homepage URL: `https://central.preconamira.com.br`;
- Authorization callback URL: `https://central.preconamira.com.br/auth/github/callback`.

O `Client ID` pode ficar no `wrangler.jsonc`. O `Client Secret` nunca deve ser commitado.

O login da Central não solicita escopos de repositório. Ele serve apenas para comprovar a identidade do administrador.

## Secrets do Worker

Os valores abaixo nunca devem aparecer no repositório:

- `PNM_GITHUB_OAUTH_CLIENT_SECRET`: segredo do OAuth App;
- `PNM_CENTRAL_SESSION_SECRET`: material aleatório com no mínimo 32 bytes usado para assinar sessões;
- `PNM_GITHUB_TOKEN`: credencial server-side separada usada apenas pelo fluxo transacional da Central.

O token transacional deve ser mínimo e restrito ao repositório `edsonrcaustirol/preco-na-mira`. Ele não é o token temporário do login OAuth.

## Publicação gratuita via GitHub Actions

O workflow `.github/workflows/deploy-central-free.yml` é manual (`workflow_dispatch`) para impedir deploy administrativo acidental.

Antes do primeiro uso, cadastrar no repositório GitHub somente estes secrets:

- `CLOUDFLARE_API_TOKEN`;
- `PNM_GITHUB_OAUTH_CLIENT_SECRET`;
- `PNM_GITHUB_TOKEN`.

O workflow:

1. executa os testes da autenticação;
2. executa o guardrail da Central Free;
3. faz um deploy fail-closed do Worker;
4. sincroniza o secret do OAuth;
5. sincroniza o token GitHub transacional;
6. gera um novo segredo criptográfico de sessão e grava no Worker.

Gerar um novo segredo de sessão em cada deploy invalida sessões administrativas antigas. Isso é intencional e não afeta catálogo, OAuth App ou GitHub.

O `CLOUDFLARE_API_TOKEN` precisa apenas das permissões necessárias para publicar o Worker/Custom Domain na conta já usada pelo PNM. Não é necessário contratar Cloudflare Access.

## Falhas fechadas

A Central deve negar acesso quando:

- configuração obrigatória estiver ausente: `503 CENTRAL_CONFIG_INCOMPLETE`;
- o host estiver incorreto: `421 CENTRAL_HOST_REJECTED`;
- uma API for chamada sem sessão: `401 GITHUB_OAUTH_REQUIRED`;
- uma página for acessada sem sessão: redirecionamento para `/auth/github/login`;
- o callback tiver `state`, PKCE, código ou backend inválido: rejeição do callback;
- a identidade GitHub não for exatamente a permitida: `403 ADMIN_IDENTITY_REJECTED`;
- a assinatura da sessão estiver adulterada ou expirada: sessão rejeitada.

## Mutação de produtos

Autenticação e publicação são responsabilidades diferentes.

Depois do login, qualquer alteração real continua obedecendo ao fluxo transacional:

`preflight -> owner -> sync E2 -> validação -> branch -> commit -> pull request -> CI -> merge controlado`

Não existe push direto em `main` pela interface.

## Owner único e E2

A Central referencia:

- owner: `data/produtos-index.js`;
- validação E2: `npm run validate:e2-catalog`;
- teste de ciclo E2: `npm run test:e2-catalog-operations`;
- módulo E2: `scripts/validar-catalogo-operacional.mjs`.

D1, cookies e OAuth nunca substituem o owner canônico.

## Auditoria de afiliados

A Central reutiliza o contrato existente:

- comando: `npm run audit:affiliate-integrity`;
- CLI: `scripts/audit-affiliate-integrity.mjs`;
- contrato: `pnm.affiliate-integrity/v1`.

## Checklist de aceite

A Central só deve ser considerada pronta quando estes pontos forem comprovados:

- [ ] `npm run test:o4-github-oauth-auth` PASS;
- [ ] `npm run test:p2-central-free` PASS;
- [ ] `npm run check` PASS;
- [ ] `https://central.preconamira.com.br/` redireciona usuário anônimo ao GitHub;
- [ ] a conta GitHub autorizada entra e recebe sessão;
- [ ] outra identidade é rejeitada;
- [ ] nenhuma tela pública do PNM contém link administrativo;
- [ ] um produto de teste percorre Central -> PR -> CI -> merge -> produção;
- [ ] nenhum cartão/plano Zero Trust é necessário para o fluxo.
