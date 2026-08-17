# Preço na Mira — SEO, CRO e microcopy V18.2

## CTAs de afiliado

1. **VER NO MERCADO LIVRE ↗** — padrão adotado.
2. **ABRIR OFERTA NO MERCADO LIVRE ↗**
3. **CONFERIR PREÇO NO MERCADO LIVRE ↗**
4. **VER ANÚNCIO NO MERCADO LIVRE ↗**
5. **IR PARA O MERCADO LIVRE ↗**

Evitar “Comprar agora” como CTA padrão porque o checkout não ocorre no Preço na Mira.

## Descrições de navegação

- **Universos:** Explore produtos por contexto, ambiente e tipo de uso.
- **Ofertas:** Descubra produtos em destaque e oportunidades selecionadas.
- **Catálogo:** Busque todos os produtos por marca, categoria ou nome.

## Projetos — ideias simples de compartilhamento

1. **Link importável do projeto:** compartilhar o projeto completo por Web Share/WhatsApp. A base já existe no produto.
2. **Resumo compartilhável:** texto com ambiente, itens escolhidos, pendências e progresso.
3. **Card visual do projeto:** gerar uma imagem com nome do projeto, produtos principais e progresso para Stories/WhatsApp.

## Micro-tutorial de Projetos

1. Escolha o ambiente e dê um nome ao projeto.
2. Adicione produtos, medidas e infraestrutura quando necessário.
3. Revise pendências e abra as ofertas no Mercado Livre.

## Busca da Home — opções de CRO

### Opção A — adotada
- Placeholder: **O que você quer comparar hoje?**
- Apoio: Busque produto, marca ou categoria. Compare aqui; a compra acontece no Mercado Livre.

### Opção B
- Placeholder: **Busque produto, marca ou categoria**
- Apoio: Encontre opções, compare detalhes e abra a oferta na loja parceira.

### Opção C
- Placeholder: **Qual produto você está procurando?**
- Apoio: Use a busca para chegar ao comparativo, catálogo ou oferta certa.

## Títulos editoriais com intenção de compra

1. Air Fryer de 4L vs 5L: qual tamanho vale mais a pena?
2. Robô aspirador vale a pena em apartamento pequeno?
3. JBL vs Philips: qual caixa de som escolher para festas?
4. Notebook gamer vs PC gamer: qual oferece melhor custo-benefício?
5. TV QLED vs OLED: qual tecnologia faz mais sentido para sua sala?
6. DeWalt 12V vs 20V: qual linha de ferramentas escolher?
7. Soundbar vale a pena ou caixas separadas entregam mais?
8. Cooktop de indução vale a pena? O que conferir antes da compra
9. Monitor 144 Hz vs 240 Hz: quem realmente percebe a diferença?
10. Lava e seca ou lavadora tradicional: qual escolher para pouco espaço?

## JSON-LD — Product + AggregateOffer

Usar somente quando os preços e a quantidade de ofertas forem dados reais e visíveis/confirmados. `AggregateOffer` não deve ser preenchido com valores inventados.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "{{NOME_DO_PRODUTO}}",
  "image": [
    "https://preconamira.com.br/{{CAMINHO_DA_IMAGEM}}"
  ],
  "description": "{{DESCRICAO_EDITORIAL}}",
  "sku": "{{ID_INTERNO}}",
  "brand": {
    "@type": "Brand",
    "name": "{{MARCA}}"
  },
  "offers": {
    "@type": "AggregateOffer",
    "url": "https://preconamira.com.br/{{PAGINA_DO_PRODUTO_OU_COMPARATIVO}}",
    "priceCurrency": "BRL",
    "lowPrice": {{MENOR_PRECO_REAL}},
    "highPrice": {{MAIOR_PRECO_REAL}},
    "offerCount": {{QUANTIDADE_REAL_DE_OFERTAS}}
  }
}
</script>
```

Se houver apenas uma oferta real, usar `Offer` em vez de `AggregateOffer`. Se não houver preço confiável disponível no HTML, omitir `offers` em vez de inventar preço.
