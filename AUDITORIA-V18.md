# Auditoria total — Preço na Mira V18.0.0

Data da varredura: 16/08/2026

Origem oficial: https://preconamira.com.br/

Repositório oficial: https://github.com/edsonrcaustirol/preco-na-mira

Ramo de produção: `main`

## Resultado executivo

- 641 arquivos HTML inventariados e analisados.
- 556 páginas estáticas de produto conferidas.
- 556 produtos na fonte canônica `data/produtos-index.js`.
- 626 URLs indexáveis no mapa do site.
- 626 URLs oficiais no `sitemap.xml`.
- 13123 ocorrências de links registradas, incluindo 4684 ocorrências de afiliados em páginas e catálogo.
- 0 links internos quebrados encontrados após as correções.
- 0 links vazios não controlados encontrados após as correções.
- 0 IDs de produto duplicados.
- 0 links de afiliado duplicados.
- 0 possíveis segredos detectados.
- 158 arquivos JavaScript validados sem erro de sintaxe.

## Checklist de áreas inspecionadas

- [x] Página inicial, Universos, Ofertas e Catálogo.
- [x] Casa, Cozinha, Lavanderia, pequenos espaços e Casa Studio.
- [x] Gamer, peças, comparadores e Montar PC.
- [x] Tecnologia, smartphones, notebooks, tablets, áudio, TVs, monitores, projetores e conectividade.
- [x] Obra Base, Instalações, Acabamentos e Linha DeWalt.
- [x] Busca, filtros, estados vazios, salvos, carrinho e projetos.
- [x] Comparadores e seletores de produtos.
- [x] Todas as 556 páginas de produto.
- [x] Cabeçalho, navegação, rodapé, botões, links externos, modais e controles desabilitados.
- [x] SEO, metadados sociais, canonicals, robots, sitemap e página 404.
- [x] Cabeçalhos de segurança, arquivos ignorados e exposição de segredos.

O inventário completo, página por página, está em `INVENTARIO-ROTAS-V18.csv`. A relação por ocorrência dos links está em `RELATORIO-LINKS-V18.csv`.

## Correções implementadas

1. Criada a camada de plataforma V18 com design dark premium, tokens centralizados, setores Casa/teal, Gamer/violeta e Tecnologia/ciano.
2. Padronizados cards, palcos de imagens e miniaturas com proporção estável e `object-fit: contain`.
3. Adicionado fallback neutro e explicitamente identificado para falha de fotografia, sem fingir que é imagem real.
4. Corrigidas rotas limpas, canonicals e metadados que ainda apontavam para o domínio antigo.
5. Criados imagem social oficial, página 404, sitemap e robots no domínio próprio.
6. Adicionados foco visível, link para pular conteúdo, áreas clicáveis mínimas, redução de movimento e melhoria de teclado/Escape.
7. Endurecidos CSP (Política de Segurança de Conteúdo), HSTS e demais cabeçalhos de segurança.
8. Corrigido `.gitignore` e ampliado `.assetsignore` para não publicar fontes, relatórios, utilitários locais e fragmentos legados.
9. Criada auditoria estática rigorosa e verificação obrigatória no GitHub Actions antes da integração ao `main`.
10. Centralizada a identificação da versão e criada proteção para links desabilitados controlados por JavaScript.
11. Localizadas 61 imagens que antes dependiam externamente do marketplace.
12. Completada a compatibilidade AM4/DDR4/mATX de uma placa-mãe somente com dados explícitos no título do anúncio.
13. Corrigida após inspeção publicada a disputa de especificidade que ainda deixava faixas claras em Casa e Tecnologia.

## Cobertura de conteúdo e imagens

- Campos essenciais completos: 556/556 nomes, 556/556 marcas, 556/556 categorias, 556/556 links e 556/556 resumos.
- Benefícios/chips: 556/556.
- Chamada editorial/por que comprar: 556/556.
- Fonte técnica cadastrada: 209/556.
- Imagens locais: 246/556.
- Imagens ainda externas: 310/556, todas em `http2.mlstatic.com`.
- Preço interno: não é apresentado como dado estático; preço, estoque, frete e variante são confirmados na loja parceira.

## Pendências e limites que não foram escondidos

### 1. HTTP ainda responde sem redirecionar para HTTPS

- Onde: `http://preconamira.com.br/`.
- Causa provável: a opção **Always Use HTTPS** da zona Cloudflare não está ativa.
- Impacto: a primeira visita por HTTP não recebe redirecionamento 301/308, embora a página possua CSP e o pacote V18 adicione HSTS.
- Solução: ativar **SSL/TLS → Edge Certificates → Always Use HTTPS** no painel da Cloudflare.
- O que falta: permissão de configuração da zona; não é seguro alterar DNS ou SSL sem essa autorização específica.

### 2. 310 imagens dependem do CDN externo do marketplace

- Onde: produtos listados em `cobertura-imagens.html` e no relatório da auditoria.
- Causa: o CDN respondeu 403 à tentativa automatizada de cópia de parte das fotos.
- Impacto: a foto pode falhar caso o endereço externo mude ou bloqueie hotlink.
- Solução: localizar progressivamente fotografias oficiais e armazenar versões otimizadas no projeto.
- O que falta: fonte oficial/arquivo autorizado para esses 310 modelos.

### 3. Destino final dos encurtadores de afiliado

- Onde: links `meli.la` do catálogo.
- Causa: o redirecionador do marketplace bloqueou a inspeção automatizada segura.
- Impacto: a estrutura, domínio, presença e unicidade foram validados, mas não é possível afirmar automaticamente que cada anúncio final continua sendo o mesmo SKU.
- Solução: conferência humana periódica por amostragem e, futuramente, integração oficial de catálogo/API do parceiro.
- O que falta: acesso permitido pelo marketplace ou rotina oficial de verificação.

### 4. Compatibilidade física do gabinete MasterFrame 360

- Onde: Montar PC.
- Causa: medidas/form factors não estão confirmados na base.
- Impacto: o sistema não bloqueia a escolha, mas exibe aviso para validação manual.
- Solução: cadastrar os formatos e limites físicos somente após confirmação oficial.
- O que falta: ficha técnica verificável do modelo exato.

### 5. Central de catálogo V13 permanece legada

- Onde: `gerenciador.html`, `automacao.html` e `tools/catalog-server.mjs` (não publicados).
- Causa: a ferramenta ainda espera uma fonte antiga e não regenera todas as páginas estáticas e divisões de dados atuais.
- Impacto: usá-la como publicador poderia criar divergência entre catálogo e páginas.
- Solução: reconstruir a ingestão sobre a fonte canônica V18, com geração única, validação e pull request.
- O que falta: uma etapa própria de modernização; nesta versão ela foi isolada da produção e documentada como legada.

## Responsividade e interação

- Regras fluidas adicionadas para 850 px e 620 px, cobrindo menu, grades, cards, construtores, resumos, tabelas e botões.
- Imagens agora têm palco estável, proporção reservada e contenção em cards verticais, horizontais e quadrados.
- Comparadores largos mantêm rolagem interna em vez de estourar a página.
- Menu móvel, foco, teclado, links desabilitados, estado offline e redução de movimento possuem tratamento centralizado.

## Validação da versão publicada

- 13 rotas representativas foram reabertas no domínio próprio depois da implantação: início, ofertas, Casa, Gamer, Tecnologia, Montar PC, catálogo, DeWalt, busca, comparador, pequenos espaços, produto e 404.
- Todas carregaram a camada V18, um único H1, conteúdo principal, link de salto e largura sem estouro horizontal no navegador de inspeção (1.363 px).
- Nenhuma fotografia quebrada foi observada nessas rotas e não houve erro de console originado pelo site; os únicos registros de erro pertenciam à extensão do navegador de teste.
- Celular e tablet foram verificados por regras fluidas, limites de largura, grades, menu, tabelas e breakpoints de 850/620 px. O navegador remoto disponível é fixo em desktop e o Chromium local foi bloqueado pelo isolamento do ambiente; portanto, não é correto afirmar que houve ensaio em aparelhos físicos nesta rodada.

## Arquivos da entrega

- `AUDITORIA-V18.md`: este relatório.
- `INVENTARIO-ROTAS-V18.csv`: todas as rotas e seu estado.
- `RELATORIO-LINKS-V18.csv`: relação dos links por ocorrência e status.
- `ARQUIVOS-ALTERADOS-V18.txt`: lista exata de arquivos modificados, adicionados ou removidos.
- `.audit/site-audit.json`: relatório técnico reproduzível, gerado localmente e não publicado.

## Próxima versão recomendada

V18.1 deve modernizar a ingestão de produtos, reduzir a duplicação entre os 37 arquivos de dados e concluir a hospedagem local das 310 fotos externas. A meta arquitetural é gerar páginas, índices, categorias e comparadores a partir de uma única fonte canônica, mantendo pull request, auditoria e rollback em todas as publicações.
