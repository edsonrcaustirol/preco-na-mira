# Preço na Mira — Manual de Funções e Operação Comercial

Este manual responde à pergunta: **“Quero mudar alguma coisa comercial no site. Onde mexo?”**

A regra principal é simples:

> **FONTE DE VERDADE DOS PRODUTOS:** `data/produtos-index.js`
>
> **NÃO FAÇA:** não edite arquivos derivados/gerados para tentar controlar Catálogo, Ofertas ou Home.

## Estado operacional de referência

Na base em que este manual foi criado:

- Catálogo: **556 produtos**;
- dados mobile: **556 produtos**;
- páginas `produto-*.html`: **556**;
- Ofertas: **30 produtos**;
- Home: **6 destaques**;
- fila DeWalt: **79 pendentes**.

Esses números são uma fotografia do momento. O procedimento correto não depende de mantê-los para sempre; após uma alteração válida, as contagens devem mudar de forma coerente.

## 1. Catálogo

### O que contém

O Catálogo representa os produtos cadastrados na fonte canônica. Hoje a fonte é:

`data/produtos-index.js`

O derivado mobile é:

`data/produtos-mobile.js`

O Catálogo estático é reconstruído pelo build a partir dos dados derivados da fonte.

### Para adicionar, editar ou remover item do Catálogo

**AÇÃO →** altere o produto na fonte canônica.

**ONDE →** `data/produtos-index.js`.

**COMO →** siga o ciclo de vida descrito em `docs/MANUAL-PRODUTOS.md`, incluindo a página individual.

**VALIDAR →**

```bash
npm run build:site
npm run check
```

> **NÃO FAÇA:** não adicione/remova card diretamente em `catalogo.html`, páginas de paginação ou `data/produtos-mobile.js` para simular uma mudança de catálogo.

## 2. Ofertas

A seleção final de Ofertas tem **30 produtos**.

O controle explícito vive no campo opcional `oferta` do produto em `data/produtos-index.js`. Existem exatamente três comportamentos operacionais:

### `oferta: true` — FORÇAR entrada

O produto precisa entrar na seleção final de 30.

Regras atuais:

- `oferta` precisa ser booleano (`true` ou `false`) quando estiver presente;
- o produto forçado precisa ter link afiliado e texto de justificativa disponível (`chamada` ou `resumo`);
- se houver mais de 30 produtos com `oferta: true`, a curadoria **falha**;
- o sistema não corta silenciosamente os forçados excedentes.

Exemplo didático de trecho de registro — os demais campos obrigatórios foram omitidos apenas para simplificar:

```js
{
  id: "produto-exemplo-a",
  nome: "Produto Exemplo A",
  // ...demais campos obrigatórios...
  oferta: true
}
```

### `oferta: false` — PROIBIR entrada

O produto fica fora da seleção de Ofertas, mesmo se outros sinais editoriais o tornariam um bom candidato.

```js
{
  id: "produto-exemplo-b",
  nome: "Produto Exemplo B",
  // ...demais campos obrigatórios...
  oferta: false
}
```

### Campo `oferta` ausente — CURADORIA AUTOMÁTICA

Sem o campo `oferta`, o produto volta ao algoritmo normal.

```js
{
  id: "produto-exemplo-c",
  nome: "Produto Exemplo C"
  // sem campo oferta; os demais campos obrigatórios continuam necessários
}
```

A curadoria automática atual prioriza critérios editoriais já existentes (`faixa`, `selo`, `destaque`), depois busca variedade por área e marca. O alvo final continua sendo 30.

### COMO COLOCAR EM OFERTAS

1. Abra `data/produtos-index.js`.
2. Localize o produto pelo `id`.
3. Adicione ou altere para:

```js
oferta: true
```

4. Não edite `ofertas.html` nem `data/produtos-ofertas.js` como owner.
5. Rode:

```bash
npm run build:site
npm run check
```

6. Confirme na saída/HTML final que o produto entrou e que continuam existindo exatamente 30 Ofertas.

### COMO RETIRAR DE OFERTAS

1. Abra `data/produtos-index.js`.
2. Localize o produto.
3. Defina:

```js
oferta: false
```

4. Rode build/check.
5. Confirme que ele não aparece na seleção final e que o algoritmo completou as 30 posições válidas.

### COMO VOLTAR PARA CURADORIA AUTOMÁTICA

1. Abra `data/produtos-index.js`.
2. Remova a propriedade `oferta` do registro — não use `null`, texto ou número.
3. Rode build/check.
4. A partir daí, a presença do produto em Ofertas volta a depender da curadoria automática.

### Quem são os derivados de Ofertas

- `ofertas.html` contém a seleção prerenderizada final após o build/refino;
- `data/produtos-ofertas.js` é o payload gerado da mesma seleção e ordem.

O validador exige que os dois coincidam.

> **VALIDAÇÃO OBRIGATÓRIA:** se Ofertas terminar com quantidade diferente de 30, se um `oferta:true` ficar fora ou um `oferta:false` entrar, o processo deve falhar.

## 3. Home / destaques

A Home exibe **6 destaques**.

### Owner real

Não existe hoje uma lista manual “Home = estes seis IDs”. A seleção nasce dos campos do produto na fonte canônica e é gerada pelo build.

O algoritmo atual considera primeiro produtos com link afiliado e algum sinal editorial entre:

- `destaque`;
- `faixa`;
- `selo`.

Na ordenação, `destaque: true` recebe prioridade; imagem útil também entra no critério. Na primeira passagem, a seleção tenta diversidade de tipo e marca; depois completa as vagas restantes se necessário.

### COMO trocar um destaque hoje

1. Abra `data/produtos-index.js`.
2. Avalie o produto que você quer promover e o atual conjunto da Home.
3. Ajuste os sinais editoriais reais do produto — principalmente `destaque` quando a intenção for priorização — sem inventar informação.
4. Se estiver retirando prioridade de um produto, revise também `faixa`/`selo`: mesmo sem `destaque`, esses campos podem mantê-lo elegível.
5. Rode `npm run build:site`.
6. Confira os **6 IDs efetivamente selecionados** na Home.
7. Rode `npm run check`.

### Importante

`destaque: true` é um **sinal de prioridade**, não um “slot fixo da Home”. O algoritmo de diversidade pode influenciar o conjunto final.

### Relação com Ofertas

Home e Ofertas compartilham dados editoriais da mesma fonte, mas têm seleções diferentes.

- `oferta: true/false` controla a curadoria final de Ofertas.
- A seleção da Home não usa `oferta` como override.
- Um produto pode ser destaque da Home sem ocupar Ofertas, e vice-versa, conforme os critérios de cada rotina.

> **NÃO FAÇA:** não edite o bloco de destaques de `index.html` para “fixar” a Home; o próximo build pode sobrescrevê-lo.

## 4. DeWalt

A área DeWalt continua existindo no site, mas não é mais o bloco prioritário no topo do Catálogo.

A fila atual tem **79 links pendentes**.

### Para que serve a fila

Ela guarda links recebidos que ainda não representam um produto identificado/publicável no catálogo.

### Owner da fila

**FONTE MANUAL:** `scripts/fila-links-2026-08-16.txt`

**GERADO:** `data/dewalt-pendentes.js`

O gerador publica no derivado as linhas da seção atual da fila que continuam correspondendo ao padrão de pendência.

### Fluxo operacional

1. escolha um link pendente na fonte manual;
2. identifique manualmente produto, modelo, categoria e imagem;
3. verifique se já existe no catálogo;
4. se for novo, siga o procedimento completo de adicionar produto;
5. se já existir, não crie duplicata; trate a manutenção do cadastro existente;
6. somente depois, altere a linha da fonte da fila para que ela deixe de ser pendente;
7. rode build/check;
8. confirme que a contagem da fila e do catálogo mudou somente como esperado.

### Limitação real

O sistema atual **não identifica automaticamente** o produto a partir do link e não possui reconciliação automática “pendente → produto”. Essa parte continua manual.

> **NÃO FAÇA:** não edite `data/dewalt-pendentes.js` para resolver um item. Ele é regenerado.

## 5. Related

Related são os blocos de alternativas/itens parecidos dentro das páginas `produto-*.html`.

Conceitualmente, cada item relacionado pode oferecer:

- **ANALISAR:** navegação interna para a página do produto relacionado;
- **CTA comercial:** saída para a loja/afiliado do produto relacionado.

### Owner real

O conteúdo Related continua embutido nas páginas individuais e tem manutenção manual relevante.

### Regra operacional

- altere Related de forma pontual e consciente na página individual;
- mantenha o produto relacionado existente e o destino correto;
- não faça replace textual em massa nas 556 páginas;
- rode `npm run check`, que contém um auditor específico para o escopo Related.

> **ATENÇÃO:** existe uma PR #35 separada para M3.2. Enquanto ela não estiver mergeada, ela **não é produção** e não deve ser usada como base deste manual nem como justificativa para alterar Related em massa.

## 6. Métricas comerciais

A instrumentação atual usa três eventos principais:

### `page_view`

Registra a visualização/carregamento de uma página identificada pelo sistema.

### `affiliate_click`

Registra um clique em link afiliado reconhecido, associado ao produto, página, loja e placement quando os dados necessários existem.

**Importante:** clique **não significa venda**. O evento prova que houve interação com o link; não prova compra, pagamento ou comissão.

### `commercial_impression`

Registra exposição comercial para os placements instrumentados atualmente (`card` e `related`). O alvo precisa ficar pelo menos 50% visível por 500 ms contínuos antes de a impressão ser registrada, com produto identificado.

**Importante:** impressão **não significa clique**. Ela mede exposição elegível, não interação.

> **NÃO FAÇA:** não altere Analytics Engine, Worker, eventos, thresholds ou instrumentação para executar uma operação de catálogo/Ofertas. Métrica e manutenção comercial são responsabilidades separadas.

## 7. O que não mexer manualmente

Para operações comuns de catálogo e curadoria, evite editar diretamente:

- `data/produtos-mobile.js` — derivado;
- `data/produtos-ofertas.js` — payload gerado;
- `data/dewalt-pendentes.js` — fila gerada;
- cards/blocos gerados de Catálogo, Ofertas e Home;
- HTML em massa das páginas de produto;
- Analytics Engine;
- secrets/tokens;
- instrumentação M1/M2.1/M3.1/M2.2;
- Worker;
- configuração de deploy para “forçar” publicação;
- produção diretamente.

### Exceção importante

`produto-<id>.html` **não é um derivado descartável**. Uma página individual pode e deve ser editada manualmente quando a operação exige manutenção editorial daquele produto. O que deve ser evitado é uma edição indiscriminada em massa.

## 8. Checklist antes de publicar

- [ ] alteração começou no owner correto
- [ ] `data/produtos-index.js` continua sendo a fonte dos produtos
- [ ] página individual foi criada/atualizada quando necessário
- [ ] nenhum ID duplicado
- [ ] nenhum link afiliado duplicado
- [ ] imagem e `imagemAlt` válidos
- [ ] Ofertas terminou com exatamente 30 itens
- [ ] Home terminou com 6 destaques
- [ ] fila DeWalt mudou somente se a operação exigia
- [ ] `npm run build:site` executado para revisão local
- [ ] `npm run check` PASS
- [ ] diff revisado; derivados não foram tratados como owner
- [ ] branch e PR criadas
- [ ] CI PASS
- [ ] merge somente após revisão
- [ ] nenhum deploy manual no fluxo normal

## 9. Tabela de decisão

| QUERO... | ONDE MEXER | O QUE RODAR | RISCO PRINCIPAL |
| --- | --- | --- | --- |
| adicionar produto | `data/produtos-index.js` + criar `produto-<id>.html` + imagem quando local | `npm run build:site` → `npm run check` | ID/link duplicado, página faltante, imagem inválida |
| editar produto | `data/produtos-index.js` e página individual quando o dado aparece nela | build → check | fonte e página divergirem |
| remover produto | fonte + referências manuais + `produto-<id>.html` | build → check | página órfã ou referência quebrada |
| colocar em Ofertas | `oferta: true` na fonte | build → check | exceder 30 forçados ou cadastro inválido |
| retirar de Ofertas | `oferta: false` na fonte | build → check | editar o derivado em vez da fonte |
| voltar à curadoria automática | remover a propriedade `oferta` da fonte | build → check | usar `null`/texto em vez de remover |
| trocar destaque Home | sinais editoriais na fonte, principalmente `destaque`; revisar `faixa`/`selo` | build → conferir 6 → check | esperar um slot fixo que não existe |
| resolver DeWalt pendente | identificar produto; manter produto na fonte; depois atualizar a fonte manual da fila | build → check | apagar apenas o derivado ou criar duplicata |
| alterar link afiliado | `linkAfiliado` na fonte + CTAs necessários da página individual | build → check | link duplicado ou página divergente |
| alterar imagem | `imagem`/`imagemAlt` na fonte + revisar página individual | build → check | asset ausente ou descrição inadequada |

## 10. Publicação e rollback em uma linha

**Publicar:** alteração → branch → commit → PR → CI → revisão → merge em `main` → Cloudflare Workers Builds automático.

**Rollback:** preferir revert do commit/merge problemático por Git/GitHub, com nova PR e CI, em vez de editar produção diretamente.

> **VALIDAÇÃO OBRIGATÓRIA:** no fluxo normal, não faça deploy manual. O workflow do GitHub valida o pacote; a publicação em produção é responsabilidade do Cloudflare Workers Builds conectado à `main`.
