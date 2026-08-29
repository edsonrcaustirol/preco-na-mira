# O4-R3 — Autenticação da Central sem Cloudflare Access

A Central passa a usar GitHub OAuth somente para identidade administrativa, com PKCE, state, callback exato e sessão assinada no Worker.

Princípios:

- nenhum login por senha próprio;
- nenhum escopo GitHub de repositório no OAuth de login;
- OAuth token de usuário não é persistido nem enviado ao browser;
- identidade autorizada é validada por GitHub user ID + login;
- sessão administrativa usa cookie `__Host-`, `HttpOnly`, `Secure` e `SameSite=Lax`;
- `PNM_GITHUB_TOKEN` continua separado, apenas server-side, para o fluxo transacional O3;
- `workers_dev=false` e `preview_urls=false` permanecem obrigatórios;
- `central.preconamira.com.br` continua o único hostname administrativo esperado;
- catálogo, produtos e links não são alterados por esta etapa.

Runtime necessário para autenticação:

- `PNM_CENTRAL_AUTH_MODE=github-oauth`
- `PNM_CENTRAL_EXPECTED_HOST=central.preconamira.com.br`
- `PNM_GITHUB_OAUTH_CLIENT_ID`
- `PNM_GITHUB_OAUTH_CLIENT_SECRET` (secret)
- `PNM_GITHUB_ALLOWED_USER_ID`
- `PNM_GITHUB_ALLOWED_LOGIN`
- `PNM_CENTRAL_SESSION_SECRET` (secret)

O fluxo de autenticação é:

`Central -> GitHub OAuth authorize + PKCE -> callback server-side -> /user -> allowlist -> sessão assinada`.

O fluxo de publicação permanece separado:

`Central autenticada -> backend -> PNM_GITHUB_TOKEN -> workflow O3 -> branch -> PR -> CI -> merge controlado`.
