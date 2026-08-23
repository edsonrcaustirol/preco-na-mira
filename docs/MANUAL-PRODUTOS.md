# Preço na Mira — Manual de Criação e Manutenção de Produtos

Este manual descreve o fluxo **real** do repositório atual do Preço na Mira para criar, editar e remover produtos com segurança.

> **FONTE DE VERDADE:** `data/produtos-index.js`
>
> **NÃO FAÇA:** não use `data/produtos-mobile.js`, `data/produtos-ofertas.js`, Catálogo, Ofertas ou outro arquivo gerado como fonte principal de cadastro.

## 1. Mapa rápido: fonte, derivados, gerados e manuais

| Tipo | Arquivo/área | Regra operacional |
| --- | --- | --- |
| **FONTE** | `data/produtos-index.js` | Owner dos dados de produto. Cadastro e dados comerciais começam aqui. |
| **DERIVADO / GERADO** | `data/produtos-mobile.js` | Gerado de `data/produtos-index.js` por `npm run build:mobile-data`. Não editar como owner. |
| **DERIVADO / GERADO** | `data/produtos-ofertas.js` | Payload da seleção final de Ofertas. Não editar como owner. |
| **DERIVADO / GERADO** | blocos de Catálogo, Ofertas e destaques da Home | Reconstruídos pelo build. Não fazer manutenção comercial diretamente nesses blocos. |
| **MANUAL** | `produto-<id>.html` | A página individual continua tendo conteúdo editorial e manutenção manual relevantes. A E2 não cria nem substitui destrutivamente essa página. |
| **FONTE MANUAL DA FILA** | `scripts/fila-links-2026-08-16.txt` | Owner dos links pendentes usados pela fila DeWalt atual. |
| **DERIVADO / GERADO** | `data/dewalt-pendentes.js` | Gerado a partir da fila. Não editar como owner. |

## 2. Campos obrigatórios do produto

Todo produto em `data/produtos-index.js` precisa ter estes campos preenchidos:

- `id`
- `nome`
- `marca`
- `categoria`
- `imagem`
- `imagemAlt`
- `linkAfiliado`
- `loja`
- `resumo`

Campos opcionais usados pelo site incluem, entre outros:

- `categoriaId`
- `tipoProduto`
- `imagemFallback`
- `imagemTipo`
- `oferta`
- `destaque`
- `faixa`
- `selo`
- `chamada`
- campos `subtipo*`
- `porteEspaco`

### ID e slug

Não existe um campo `slug` separado no catálogo atual. O `id` é usado como identidade do produto e compõe a página `produto-<id>.html` e a rota correspondente.

**AÇÃO →** escolher um `id` novo e estável.

**COMO →** siga o padrão já usado no repositório, normalmente minúsculas e palavras separadas por hífen. Antes de usar, confirme que o mesmo `id` não existe em `data/produtos-index.js` nem como `produto-<id>.html`.

**ATENÇÃO:** o validador exige unicidade, mas não existe hoje um campo independente de slug. Trocar um `id` existente equivale a trocar a identidade/rota do produto e exige tratar página e referências como uma mudança estrutural, não como simples correção de texto.

## 3. Adicionar produto

### AÇÃO

Cadastrar um produto novo e fazê-lo chegar ao Catálogo, derivados e página individual sem criar divergências.

### ONDE

1. Dados: `data/produtos-index.js`.
2. Imagem local, quando aplicável: caminho informado em `imagem`.
3. Página individual: `produto-<id>.html`.

### COMO

1. Abra `data/produtos-index.js` e adicione um novo objeto ao array `PRODUTOS`.
2. Preencha todos os campos obrigatórios.
3. Escolha um `id` único e estável.
4. Cadastre `imagem` e `imagemAlt` coerentes. Se a imagem for local, o arquivo precisa existir no caminho informado.
5. Cadastre um `linkAfiliado` válido e exclusivo para aquele produto.
6. Preencha `loja` e `resumo`.
7. Adicione somente os campos comerciais opcionais que realmente forem necessários. Para Ofertas, veja o significado de `oferta` no Manual de Operação Comercial.
8. Crie manualmente `produto-<id>.html`. Use uma página individual existente e compatível como referência estrutural, preservando os componentes exigidos pelo site e escrevendo o conteúdo editorial do produto.
9. Na página individual, confirme pelo menos:
   - o `data-product-id` identifica exatamente o mesmo `id` da fonte;
   - o `<h1>` corresponde exatamente a `nome`;
   - o link afiliado da fonte está presente como destino na página;
   - imagens, texto editorial, ficha técnica, fontes e Related fazem sentido para aquele produto.
10. Rode o build e depois a validação obrigatória.

### VALIDAR

```bash
npm run build:site
npm run check
```

O build atual reconstrói dados mobile, fila DeWalt, listagens/SEO, curadoria de Ofertas, payload de Ofertas e demais etapas de preparação. `npm run check` refaz o build e executa as auditorias e testes fail-closed antes do dry-run do pacote Cloudflare.

### Resultado esperado

- produto presente em `data/produtos-index.js`;
- derivado mobile sincronizado;
- produto presente no Catálogo;
- `produto-<id>.html` existente;
- nenhuma página faltante ou órfã;
- nenhum ID ou link afiliado duplicado;
- nenhuma referência ou imagem inválida detectada;
- `npm run check` concluído com sucesso.

### Checklist — adicionar produto

- [ ] produto na fonte canônica
- [ ] ID único
- [ ] link afiliado válido e único
- [ ] imagem válida
- [ ] `imagemAlt` preenchido
- [ ] página `produto-<id>.html` criada
- [ ] `npm run build:site`
- [ ] `npm run check`
- [ ] revisão do diff e da página
- [ ] commit/PR
- [ ] merge somente após validação

## 4. Editar produto

### 4.1 Edição de dados

Use `data/produtos-index.js` como owner para alterar nome, marca, categoria, imagem, resumo e demais dados de catálogo.

**COMO:**

1. altere primeiro a fonte canônica;
2. revise a página `produto-<id>.html`, porque parte do conteúdo individual é manual;
3. execute `npm run build:site`;
4. revise os arquivos gerados e a página;
5. execute `npm run check`.

**ATENÇÃO:** nome e link afiliado possuem cruzamento explícito entre a fonte e a página individual. Alterar a fonte sem atualizar a página faz a validação falhar.

### 4.2 Edição de link afiliado

**ONDE →** `linkAfiliado` em `data/produtos-index.js`.

Depois, atualize na página individual os CTAs do próprio produto que precisam apontar para esse mesmo link. O validador exige que o link da fonte esteja presente na página.

**VALIDAÇÃO OBRIGATÓRIA:** `npm run check` detecta links afiliados duplicados e também audita o destino esperado.

> **NÃO FAÇA:** não altere o link apenas em `data/produtos-mobile.js`, `data/produtos-ofertas.js`, Catálogo ou Ofertas. Esses arquivos não são o owner.

### 4.3 Edição da página individual

É correto editar `produto-<id>.html` quando a mudança é editorial ou estrutural daquela página: texto, ficha técnica, fontes, alertas, seção Related e outros conteúdos individuais.

Ao editar a página:

- mantenha o `data-product-id` coerente com o `id`;
- mantenha o `<h1>` igual ao `nome` da fonte;
- mantenha o link afiliado canônico presente;
- preserve o conteúdo editorial que não faz parte da alteração;
- não faça replace em massa nas 556 páginas para resolver uma mudança pontual.

## 5. Remover produto

Remover produto é um ciclo completo. **Não basta apagar um HTML.**

### AÇÃO

Retirar um produto da fonte, das listagens e das referências sem deixar páginas ou links órfãos.

### COMO

1. Localize o produto em `data/produtos-index.js` e confirme o `id` exato.
2. Procure referências manuais ao produto, principalmente em blocos Related de páginas individuais e outras áreas editoriais.
3. Remova ou substitua essas referências de forma consciente. Não faça substituição global cega.
4. Remova o registro de `data/produtos-index.js`.
5. Remova a página `produto-<id>.html` correspondente.
6. Não edite manualmente Catálogo, Ofertas, Home ou payloads gerados para “apagar” o produto; o build deve reconstruí-los a partir da fonte.
7. Se existir uma imagem que ficou sem uso, trate a limpeza do asset separadamente e somente depois de confirmar que nenhum outro arquivo depende dela.
8. Rode:

```bash
npm run build:site
npm run check
```

### O que a validação protege

A E2 reprova, entre outros casos:

- produto na fonte sem página individual;
- página `produto-*.html` sem produto correspondente na fonte;
- Catálogo divergente da fonte;
- mobile divergente da fonte;
- referências locais ausentes detectadas pela auditoria;
- IDs e links afiliados duplicados.

## 6. Imagens

### ONDE

A referência principal da imagem vive no campo `imagem` do produto em `data/produtos-index.js`. O texto alternativo vive em `imagemAlt`.

### COMO

1. atualize `imagem` e `imagemAlt` na fonte;
2. se o caminho for local, confirme que o arquivo existe;
3. se `imagemFallback` estiver definido, confirme que o fallback também existe;
4. revise a página individual, porque ela pode conter referências de imagem e metadados próprios;
5. rode build/check.

### Regra operacional

Produto não deve ficar sem imagem. O auditor atual detecta caminho ausente, arquivo local inexistente, fallback inválido e problemas de cobertura.

> **NÃO FAÇA:** não “corrija” uma imagem somente no derivado mobile ou no HTML gerado das listagens.

## 7. Links afiliados

### ONDE

Campo `linkAfiliado` em `data/produtos-index.js`.

### Riscos protegidos

- link vazio;
- link duplicado entre produtos;
- destino fora dos domínios esperados pela auditoria;
- divergência entre fonte e página individual.

### Fluxo

1. valide que o link pertence ao produto correto;
2. altere `linkAfiliado` na fonte;
3. atualize os CTAs necessários da página individual;
4. rode `npm run build:site`;
5. rode `npm run check`;
6. revise o diff antes do commit.

## 8. Produto HTML: o que continua manual

A E2 criou validação e testes de coerência, mas **não criou um gerador destrutivo de `produto-*.html`**.

A página individual continua carregando conteúdo editorial próprio, por exemplo:

- introdução e leitura do produto;
- ficha técnica;
- pontos de atenção;
- fontes técnicas;
- CTAs da página;
- alternativas Related.

O validador E2 cruza pelo menos estas invariantes com a fonte:

1. existe exatamente uma página correspondente a cada `id`;
2. não existe página órfã;
3. a página declara o mesmo `data-product-id`;
4. o `<h1>` corresponde a `nome`;
5. o `linkAfiliado` canônico aparece na página.

Outras auditorias de `npm run check` também verificam referências, SEO, imagens, Related e instrumentação.

> **ATENÇÃO:** passar no cruzamento E2 não transforma o conteúdo editorial em gerado. Revise visualmente a página quando alterar conteúdo individual.

## 9. Link DeWalt pendente → produto identificado

A fila atual possui uma fonte manual e um derivado:

- **FONTE MANUAL:** `scripts/fila-links-2026-08-16.txt`;
- **GERADO:** `data/dewalt-pendentes.js`.

O gerador considera como pendentes as linhas da seção atual da fila que correspondem ao padrão `PENDENTE` seguido do link aceito pelo script. O arquivo gerado deixa explícito que esses links **não representam produtos identificados**.

### Fluxo real

1. Pegue um link pendente da fonte manual.
2. Identifique manualmente o produto real, modelo, categoria e imagem. O repositório atual não possui automação que faça essa identificação por você.
3. Verifique se o produto já existe no catálogo para não criar duplicidade.
4. Se for um produto novo, siga integralmente **Adicionar produto**: fonte canônica + imagem + página individual + build/check.
5. Se já existir, trate a informação como manutenção do produto existente e valide o link correto sem duplicar o cadastro.
6. Somente depois da identificação e da manutenção do produto, altere a linha correspondente na **fonte manual da fila** para que ela deixe de corresponder ao padrão de pendência.
7. Rode `npm run build:dewalt-queue` ou o build completo.
8. Rode `npm run check` e confirme que a contagem de pendentes mudou somente pelo item resolvido.

### Limitação atual

Não existe no código atual um status automatizado de “resolvido” com reconciliação produto ↔ fila. A identificação e a retirada da condição de pendência são manuais; o build apenas transforma a fonte da fila em `data/dewalt-pendentes.js`.

> **NÃO FAÇA:** não remova o item diretamente de `data/dewalt-pendentes.js`; ele voltará no próximo build se continuar pendente na fonte.

## 10. Validação

### Comandos reais

Para reconstruir o site antes da revisão:

```bash
npm run build:site
```

Validação final obrigatória:

```bash
npm run check
```

### O que `npm run check` protege, em linguagem simples

A validação atual executa, em cadeia:

- testes e auditoria do escopo Related;
- build completo do site;
- testes E2 de adicionar, editar, remover, Oferta ON e Oferta OFF em fixtures temporárias;
- validação operacional entre fonte, mobile, Catálogo, Ofertas, Home, payloads e páginas individuais;
- testes da jornada mobile;
- testes da instrumentação comercial M1, M2.1, M3.1 e M2.2;
- auditoria estrita do site e SEO (Search Engine Optimization / otimização para mecanismos de busca);
- `wrangler deploy --dry-run`, que valida o pacote Cloudflare **sem publicar**.

**VALIDAÇÃO OBRIGATÓRIA:** se `npm run check` falhar, não publique e não faça merge até entender e corrigir a causa.

## 11. Publicação

O fluxo normal é:

**alteração → branch → commit → Pull Request (PR) → CI → revisão → merge em `main` → Cloudflare Workers Builds automático**

CI significa *Continuous Integration* (Integração Contínua). No GitHub, o workflow de validação roda `npm ci`, `npm run check` e verifica arquivos essenciais.

A publicação de produção é feita pelo Cloudflare Workers Builds conectado à `main`.

> **NÃO FAÇA:** não rode deploy manual no fluxo normal de manutenção de catálogo.

## 12. Rollback seguro

### Antes do merge

Se a alteração ainda estiver em uma PR, corrija a própria branch ou feche a PR. Não existe motivo para mexer em produção.

### Depois do merge

Se uma alteração problemática já chegou à `main`:

1. identifique o commit ou merge que introduziu o problema;
2. crie uma alteração de **revert** pelo Git/GitHub, em vez de editar produção diretamente;
3. abra uma PR do revert;
4. deixe o CI executar `npm run check`;
5. revise;
6. mergeie o revert somente se a validação passar.

Quando o GitHub oferecer a ação **Revert** para a PR mergeada, ela é a opção mais simples para criar a reversão revisável. Para commits simples, `git revert <sha>` é o mecanismo Git equivalente.

> **ATENÇÃO:** não faça “rollback” editando HTML, Worker ou assets diretamente em produção. A `main` precisa continuar representando o estado publicado.
