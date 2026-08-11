PREÇO NA MIRA — V13.6 • GITHUB E PUBLICAÇÃO ONLINE AUTOMÁTICA

A V13.6 conecta a Central local ao repositório oficial:
https://github.com/edsonrcaustirol/preco-na-mira

NOVO FLUXO
1. Execute CONFIGURAR-GITHUB.bat uma vez no computador.
2. Abra a Central com ABRIR-CENTRAL.bat.
3. Cole o link afiliado, revise e publique.
4. A Central cria o backup, valida, salva localmente e tenta enviar ao GitHub.
5. O GitHub Pages inicia a atualização do site online automaticamente.

SE A INTERNET FALHAR
- O produto continua salvo e validado na pasta local.
- Use o botão SINCRONIZAR SITE ONLINE quando a conexão voltar.
- Nenhuma senha ou token fica gravado dentro do projeto.

PRIMEIRA CONFIGURAÇÃO
- O arquivo CONFIGURAR-GITHUB.bat verifica Git e GitHub CLI.
- Quando necessário, usa o winget oficial do Windows para instalar os programas.
- A autorização é feita no navegador diretamente com o GitHub.
- Depois disso, as publicações seguintes são automáticas.

HISTÓRICO — V13.4.2 • CONTINGÊNCIA DA VERIFICAÇÃO DO MERCADO LIVRE

Esta atualização trata o bloqueio /gz/account-verification observado no anúncio da lavadora SM500S.

O QUE MUDOU NA V13.4.2
- A Central decodifica o anúncio real escondido no parâmetro go= da página de verificação.
- Quando o conteúdo do anúncio continuar bloqueado, recupera o título pelo endereço e usa o modelo para sugerir marca e categoria.
- O identificador MLBU do produto é preservado no cadastro.
- Links afiliados sem código depois de meli.la/ ficam claramente marcados como incompletos.
- Se a porta escolhida já estiver ocupada, o servidor tenta automaticamente a próxima porta disponível.
- O botão de captura passa a usar a porta em que a Central realmente abriu.

CASO VALIDADO NA V13.4.2
- Endereço bloqueado: /gz/account-verification?go=...
- Endereço recuperado: https://www.mercadolivre.com.br/lavadora-de-louca-industrial-sm500s/up/MLBU3567752485
- Produto inferido: Lavadora De Louca Industrial SM500S
- Marca inferida: Service Machine
- Classificação inferida: Cozinha → Lava-louças
- A foto pode continuar pendente quando o Mercado Livre não a entrega sem verificação.

HISTÓRICO — V13.4.1 • CORREÇÃO DA CAPTURA DO MERCADO LIVRE

Esta atualização corrige links meli.la que redirecionam para uma página /social/ do afiliado em vez do anúncio definitivo.

O QUE MUDOU
- O aplicativo procura o código MLB na URL, na página e no endereço da imagem.
- Com o MLB, consulta o cadastro público do item para recuperar título, marca, modelo, categoria, foto e link permanente.
- Se a consulta pública falhar, reconstrói o link normal pelo MLB e mantém os dados já encontrados na página.
- A marca Service Machine é reconhecida pelo modelo SM500/SM500S mesmo no modo de contingência.
- Lava-louças residenciais e industriais agora entram automaticamente em Cozinha → Lava-louças.
- O rascunho da V13.4.1 usa armazenamento separado para não restaurar cartões incompletos criados antes da correção.

CASO VALIDADO
- Link afiliado: https://meli.la/2oew8cQ
- Código recuperado: MLB98784803827
- Produto: Lavadora De Louça Industrial SM500S Inox 220V
- Marca: Service Machine
- Classificação: Cozinha → Lava-louças
- Link reconstruído: https://produto.mercadolivre.com.br/MLB-98784803827-_JM

HISTÓRICO — V13.4 • CENTRAL DE ALIMENTAÇÃO DO CATÁLOGO

A V13.4 preserva toda a V13.3 e acrescenta uma ferramenta local para cadastrar produtos sem editar o código manualmente.

COMEÇO RÁPIDO NO WINDOWS
1. Extraia todo o ZIP para uma pasta.
2. Instale o Node.js 20.11 ou superior, se ainda não estiver instalado.
3. Dê dois cliques em ABRIR-CENTRAL.bat.
4. Cole os links, clique em ANALISAR E PREENCHER e revise somente os cartões marcados.
5. Publique os produtos prontos, valide o catálogo e gere um novo ZIP pela própria central.

AUTOMAÇÕES DA CENTRAL
- Aceita texto bagunçado, links normais, links meli.la e arquivos TXT, CSV ou JSON.
- Agrupa o link normal e o link afiliado do mesmo produto.
- Tenta resolver links curtos e ler título, marca e imagem do anúncio.
- Limpa parâmetros desnecessários e reconhece códigos MLB.
- Sugere categoria, subcategoria e faixa de posicionamento.
- Dá suporte a 25 famílias, incluindo tecnologia, casa, cozinha, obra, instalações, acabamentos e áreas futuras.
- Marca classificações incertas para revisão humana.
- Detecta duplicatas por link afiliado, anúncio, código MLB, nome e marca.
- Também encontra links repetidos dentro do próprio lote antes de tocar no catálogo.
- Baixa imagens acessíveis para arquivos locais e registra a origem.
- O botão BUSCAR IMAGENS DE 6 PRODUTOS ANTIGOS cria lotes de recuperação para cadastros que ainda usam ilustração.
- Na recuperação, somente a imagem e sua procedência são atualizadas; nome, categoria, links e demais dados existentes ficam preservados.
- Diferencia imagem oficial, imagem capturada do anúncio e ilustração de fallback.
- Salva o rascunho no navegador para evitar perda de trabalho.
- Permite aplicar categoria, subcategoria e faixa a vários itens de uma vez.
- Possui um botão de favoritos para capturar a página aberta com um clique.

PUBLICAÇÃO SEGURA
- A publicação direta funciona somente pelo servidor local em 127.0.0.1.
- Cada sessão usa um token temporário para proteger as operações de escrita.
- Endereços locais, privados, credenciais embutidas e portas fora do padrão são bloqueados nas buscas externas.
- Cada destino de uma cadeia de redirecionamentos também passa pela verificação de segurança.
- Duplicatas exatas são bloqueadas; duplicatas possíveis exigem revisão explícita.
- Um backup com data e hora é criado antes de cada lote.
- Se o validador encontrar um problema, catálogo e imagens são restaurados automaticamente.
- O botão GERAR ZIP ATUALIZADO cria um pacote pronto para publicação.

MODO ORGANIZADOR
- Abrir gerenciador.html sem o arquivo .bat mantém análise local, revisão, rascunho e exportação JSON.
- Nesse modo, resolução de links curtos, download de imagens, publicação, backup, validação e ZIP ficam desativados.

ARQUIVOS V13.4
- gerenciador.html: interface da Central de Catálogo.
- assets/catalog-admin.js e assets/catalog-admin.css: comportamento e visual da central.
- assets/catalog-core.mjs: parser, taxonomia, classificação, duplicatas e conversão de produtos.
- tools/catalog-server.mjs: servidor local, metadados, imagens, publicação, rollback e empacotamento.
- ABRIR-CENTRAL.bat e abrir-central.sh: abertura rápida no Windows, macOS e Linux.
- INSTRUCOES-CENTRAL.txt: instruções resumidas para uso diário.
- scripts/validate-v13_4.mjs: validação completa da versão.
- scripts/test-catalog-server-v13_4.mjs: teste de segurança, análise, duplicatas, validação e ZIP.
- scripts/test-catalog-publish-v13_4.mjs: teste de publicação isolada, backup e manifesto.
- CHANGELOG-V13.4.md e VALIDACAO-V13.4.txt: registro técnico e resultado final.

ESTADO PRESERVADO DO SITE
- 525 produtos únicos.
- 262 produtos conectados a Pequenos Espaços.
- 134 imagens oficiais locais.
- 76 páginas HTML.

HISTÓRICO — V13.3 • PEQUENOS ESPAÇOS E NOVO RODAPÉ

Esta versão parte da V13.2, preserva todo o catálogo e cria uma experiência para studios, kitnets, apartamentos e cômodos compactos.

PEQUENOS ESPAÇOS — ATIVO
- 262 produtos existentes conectados ao novo ambiente por contexto de uso.
- 7 frentes de procura: cozinhar, trabalhar, limpar, banheiro, iluminar, conectar e relaxar.
- 8 perfis de espaço: studio, kitnet, apê de 1 quarto, quarto, cozinha, home office, lavanderia e banheiro.
- Montador com 5 etapas, salvamento local e link compartilhável.
- 20 réguas de comparação por categoria técnica, com armazenamento isolado.
- Avisos explícitos para confirmar largura, altura, profundidade, abertura, ventilação, tomadas, hidráulica e instalação.

Páginas novas:
- pequenos-espacos.html
- montar-espaco-compacto.html
- comparativo-compactos.html

RODAPÉ
- Assinatura visual local do Mercado Livre adicionada ao bloco de ofertas.
- Fundo amarelo forte trocado por azul suave e creme.
- Trilho global agora inclui Pequenos Espaços.

CATÁLOGO
- 525 produtos únicos no total.
- 120 novos produtos únicos importados da lista recebida.
- 1 duplicata de Selador Acrílico Coral removida automaticamente.
- 1 URL de Cuba Lemi que veio colada duas vezes foi normalizada.
- 54 produtos em Obra Base.
- 60 produtos em Instalações.
- 73 produtos em Acabamentos.
- 101 produtos ligados à Cozinha permanecem ativos.

INSTALAÇÕES — EXPANDIDA
- Fios e cabos: 2
- Disjuntores: 6
- Quadros de distribuição: 3
- DR / proteção diferencial: 2
- Iluminação: 20
- Chuveiros e duchas: 11
- Torneiras elétricas: 6
- Bombas d’água: 4
- Pressurizadores: 4
- Aquecedores de água: 2

Página: instalacoes.html
Comparador: comparativo-instalacoes.html

ACABAMENTOS — ATIVA
- Rejuntes: 6
- Tintas: 5
- Massas e seladores: 4
- Texturas: 6
- Louças sanitárias: 8
- Cubas: 10
- Torneiras para banheiro: 7
- Torneiras para cozinha: 7
- Fechaduras e puxadores: 7
- Iluminação decorativa: 5
- Acessórios para banheiro: 8

Nova página: acabamentos.html
Novo comparador: comparativo-acabamentos.html

IMAGENS
- 134 produtos têm imagem oficial local e otimizada em WebP.
- 64 imagens oficiais foram adicionadas nesta versão, incluindo produtos que já existiam no site.
- Imagens reais só entram quando a página oficial e a variante podem ser confirmadas.
- Os demais produtos usam fallbacks locais próprios por família, identificados como ilustração.
- O carregamento tardio e a decodificação assíncrona foram aplicados às vitrines e comparadores.
- Todas as tags de imagem têm texto alternativo.

CORREÇÕES IMPORTANTES
- O comparador de Pequenos Espaços possui armazenamento separado por função.
- A curadoria não inventa dimensões: todo produto compacto recebe aviso para conferência.
- Obra, Instalações e Acabamentos agora possuem armazenamento separado no comparador.
- A V13.1 podia misturar seleções desses grupos no comparador genérico.
- Links internos de páginas, scripts, estilos e imagens agora são verificados pelo validador V13.2.
- Trilho inferior passou a aceitar mais ambientes sem estourar o grid.
- Banheiro e Acabamentos estão ativos no Universo Casa.
- Casa Studio, Minha Casa e Universo Casa apontam para as três camadas ativas.
- Links externos abrem com proteção adequada; noindex,nofollow continua preservado durante o desenvolvimento.

ARQUIVOS DE CONTROLE
- assets/compactos.js: regras de curadoria, tags, frentes e réguas técnicas.
- scripts/apply-v13_3.mjs: integrações da nova área em Minha Casa e Universo Casa.
- scripts/validate-v13_3.mjs: valida a estrutura compacta, o rodapé e a ausência de regressões.
- CHANGELOG-V13.3.md: resumo técnico da versão.
- VALIDACAO-V13.3.txt: resultado dos testes finais.
- data/importacao-v13_2.json: manifesto dos 120 produtos importados.
- data/imagens-v13_2.json: manifesto das 64 imagens oficiais adicionadas e fontes ignoradas.
- scripts/validate-v13_2.mjs: valida catálogo, IDs, afiliados, imagens, referências internas e JavaScript.
- CHANGELOG-V13.2.md: resumo técnico da versão.
- VALIDACAO-V13.2.txt: resultado dos testes finais.

DEPLOY
Publique todo o conteúdo desta pasta como a nova versão dos Static Assets do Worker na Cloudflare.

Fluxos principais para conferir após publicar:
- Home → Minha Casa → Pequenos Espaços → Montar
- Pequenos Espaços → escolher rotina → Produto → Oferta
- Pequenos Espaços → Comparar → compartilhar seleção
- Home → Minha Casa → Instalações → Comparar
- Home → Minha Casa → Acabamentos → Comparar
- Universo Casa → Banheiro → Produto → Oferta
- Gerenciador → cobertura de imagens
