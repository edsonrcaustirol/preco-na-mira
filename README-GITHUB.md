# Preço na Mira

Plataforma brasileira de curadoria, comparação e planejamento de compras para Casa, Gamer e Tecnologia.

## Fonte oficial e publicação

- Produção: https://preconamira.com.br/
- Repositório oficial: `edsonrcaustirol/preco-na-mira`
- Ramo de produção: `main`
- Hospedagem: Cloudflare Workers com ativos estáticos
- Implantação: automática após atualização validada do `main`

O repositório é a fonte oficial. Pacotes ZIP são apenas artefatos de entrega e não devem ser usados como uma segunda fonte do site.

## Validação

```bash
npm ci
npm run check
```

O comando executa a auditoria estática rigorosa e o empacotamento de teste do Cloudflare. O relatório detalhado é gerado em `.audit/site-audit.json`.

As páginas de administração e automação local não entram na implantação pública. A central de catálogo da geração V13 permanece somente como ferramenta legada e precisa ser modernizada antes de voltar a publicar produtos diretamente.
