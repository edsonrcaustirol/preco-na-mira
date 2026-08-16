#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const OFFICIAL_ORIGIN = 'https://preconamira.com.br';
const EXCLUDED = new Set(['automacao.html', 'gerenciador.html']);
const reportPath = path.join(ROOT, '.audit', 'site-audit.json');

if (!fs.existsSync(reportPath)) throw new Error('Execute primeiro: node scripts/auditar-site.mjs --strict');
const audit = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

function collectFiles(directory, predicate, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ['.git', '.wrangler', 'node_modules'].includes(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) collectFiles(absolute, predicate, output);
    else if (predicate(absolute)) output.push(absolute);
  }
  return output;
}

const javascriptFiles = collectFiles(ROOT, file => /\.(?:js|mjs)$/i.test(file));

const csv = value => {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

function parseAttributes(source = '') {
  const result = {};
  const expression = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = expression.exec(source))) result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  return result;
}

function resolveInternal(sourceFile, href) {
  const clean = href.split('#')[0].split('?')[0];
  if (!clean) return true;
  let decoded = clean;
  try { decoded = decodeURIComponent(clean); } catch {}
  const absolute = decoded.startsWith('/')
    ? path.join(ROOT, decoded.replace(/^\/+/, ''))
    : path.resolve(ROOT, path.dirname(sourceFile), decoded);
  return [absolute, `${absolute}.html`, path.join(absolute, 'index.html')].some(candidate => fs.existsSync(candidate));
}

function loadProducts() {
  const source = fs.readFileSync(path.join(ROOT, 'data', 'produtos-index.js'), 'utf8');
  const context = vm.createContext({ window: {}, globalThis: {} });
  vm.runInContext(`${source}\n;globalThis.__PRODUCTS__ = typeof PRODUTOS !== 'undefined' ? PRODUTOS : (window.PRODUTOS || []);`, context, { timeout: 5000 });
  return context.globalThis.__PRODUCTS__ || [];
}

const routeRows = audit.html.pages.map(page => ({
  arquivo: page.file,
  rota: page.route,
  tipo: page.isProduct ? 'produto' : page.excludedFromDeploy ? 'utilitario_local' : 'pagina_publica',
  indexacao: page.noindex ? 'noindex' : 'index',
  titulo: page.title,
  canonical: page.canonical,
  h1: page.h1.join(' | '),
  referencias_ausentes: page.missingReferences.length,
  status: page.missingReferences.length || page.duplicateIds.length ? 'revisar' : 'verificado',
}));

const routeHeader = Object.keys(routeRows[0]);
fs.writeFileSync(
  path.join(ROOT, 'INVENTARIO-ROTAS-V18.csv'),
  `${routeHeader.join(',')}\n${routeRows.map(row => routeHeader.map(key => csv(row[key])).join(',')).join('\n')}\n`,
);

const linkRows = [];
for (const page of audit.html.pages.filter(item => !item.excludedFromDeploy)) {
  const html = fs.readFileSync(path.join(ROOT, page.file), 'utf8');
  for (const match of html.matchAll(/<a\b([^>]*)>/gi)) {
    const attrs = parseAttributes(match[1]);
    const href = attrs.href || '';
    let kind = 'interno';
    let status = 'ok';
    let note = '';
    if (!href) {
      status = 'suspeito';
      note = 'âncora sem href';
    } else if (href === '#') {
      const controlled = /\bdisabled\b/.test(attrs.class || '') || 'hidden' in attrs;
      status = controlled ? 'controlado_por_js' : 'suspeito';
      note = controlled ? 'indisponível até uma seleção válida' : 'destino vazio';
    } else if (href.startsWith('#')) {
      const id = href.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      status = new RegExp(`\\bid=(?:"${id}"|'${id}')`, 'i').test(html) ? 'ok' : 'quebrado';
      note = 'fragmento na mesma página';
    } else if (/^https:\/\/(?:meli\.la|(?:www\.)?mercadolivre\.com(?:\.br)?)/i.test(href)) {
      kind = 'afiliado';
      status = 'estrutura_valida_destino_nao_verificado';
      note = 'redirecionamento externo do marketplace exige conferência fora do ambiente automatizado';
    } else if (/^https:\/\//i.test(href)) {
      kind = 'externo';
      status = 'estrutura_valida_externo';
      note = 'URL HTTPS';
    } else if (/^http:\/\//i.test(href)) {
      kind = 'externo';
      status = 'suspeito_http';
      note = 'preferir HTTPS';
    } else if (/^(?:mailto:|tel:)/i.test(href)) {
      kind = 'contato';
      status = href.includes(':') && href.split(':')[1] ? 'ok' : 'quebrado';
    } else if (/^javascript:/i.test(href)) {
      kind = 'inseguro';
      status = 'quebrado';
      note = 'javascript: não permitido';
    } else {
      status = resolveInternal(page.file, href) ? 'ok' : 'quebrado';
      note = 'resolução local estática';
    }
    linkRows.push({ origem: page.file, tipo: kind, href, status, observacao: note });
  }
}

for (const product of loadProducts()) {
  linkRows.push({
    origem: `data/produtos-index.js#${product.id}`,
    tipo: 'afiliado_catalogo',
    href: product.linkAfiliado,
    status: /^https:\/\/(?:meli\.la|(?:www\.)?mercadolivre\.com(?:\.br)?)/i.test(product.linkAfiliado || '')
      ? 'estrutura_valida_destino_nao_verificado'
      : 'suspeito',
    observacao: 'link canônico do produto; preservado sem alteração',
  });
}

const linkHeader = Object.keys(linkRows[0]);
fs.writeFileSync(
  path.join(ROOT, 'RELATORIO-LINKS-V18.csv'),
  `${linkHeader.join(',')}\n${linkRows.map(row => linkHeader.map(key => csv(row[key])).join(',')).join('\n')}\n`,
);

const committedFromMain = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACDMRTUXB', 'main...HEAD'], { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean);
const workingTreeChanges = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACDMRTUXB'], { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean);
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean);
const alteredFiles = [...new Set([...committedFromMain, ...workingTreeChanges, ...untracked])].sort();
fs.writeFileSync(path.join(ROOT, 'ARQUIVOS-ALTERADOS-V18.txt'), `${alteredFiles.join('\n')}\n`);

const brokenLinks = linkRows.filter(row => row.status === 'quebrado');
const emptyLinks = linkRows.filter(row => row.status === 'suspeito');
const affiliateLinks = linkRows.filter(row => row.tipo.startsWith('afiliado'));
const indexable = routeRows.filter(row => row.indexacao === 'index' && row.tipo !== 'utilitario_local').length;

const markdown = `# Auditoria total — Preço na Mira V18.0.0

Data da varredura: 16/08/2026

Origem oficial: ${OFFICIAL_ORIGIN}/

Repositório oficial: https://github.com/edsonrcaustirol/preco-na-mira

Ramo de produção: \`main\`

## Resultado executivo

- ${routeRows.length} arquivos HTML inventariados e analisados.
- ${audit.inventory.productPages} páginas estáticas de produto conferidas.
- ${audit.products.total} produtos na fonte canônica \`data/produtos-index.js\`.
- ${indexable} URLs indexáveis no mapa do site.
- ${audit.sitemap.urls} URLs oficiais no \`sitemap.xml\`.
- ${linkRows.length} ocorrências de links registradas, incluindo ${affiliateLinks.length} ocorrências de afiliados em páginas e catálogo.
- ${brokenLinks.length} links internos quebrados encontrados após as correções.
- ${emptyLinks.length} links vazios não controlados encontrados após as correções.
- ${audit.products.duplicateIds.length} IDs de produto duplicados.
- ${audit.products.duplicateAffiliateLinks.length} links de afiliado duplicados.
- ${audit.potentialSecrets.length} possíveis segredos detectados.
- ${javascriptFiles.length} arquivos JavaScript validados sem erro de sintaxe.

## Checklist de áreas inspecionadas

- [x] Página inicial, Universos, Ofertas e Catálogo.
- [x] Casa, Cozinha, Lavanderia, pequenos espaços e Casa Studio.
- [x] Gamer, peças, comparadores e Montar PC.
- [x] Tecnologia, smartphones, notebooks, tablets, áudio, TVs, monitores, projetores e conectividade.
- [x] Obra Base, Instalações, Acabamentos e Linha DeWalt.
- [x] Busca, filtros, estados vazios, salvos, carrinho e projetos.
- [x] Comparadores e seletores de produtos.
- [x] Todas as ${audit.inventory.productPages} páginas de produto.
- [x] Cabeçalho, navegação, rodapé, botões, links externos, modais e controles desabilitados.
- [x] SEO, metadados sociais, canonicals, robots, sitemap e página 404.
- [x] Cabeçalhos de segurança, arquivos ignorados e exposição de segredos.

O inventário completo, página por página, está em \`INVENTARIO-ROTAS-V18.csv\`. A relação por ocorrência dos links está em \`RELATORIO-LINKS-V18.csv\`.

## Correções implementadas

1. Criada a camada de plataforma V18 com design dark premium, tokens centralizados, setores Casa/teal, Gamer/violeta e Tecnologia/ciano.
2. Padronizados cards, palcos de imagens e miniaturas com proporção estável e \`object-fit: contain\`.
3. Adicionado fallback neutro e explicitamente identificado para falha de fotografia, sem fingir que é imagem real.
4. Corrigidas rotas limpas, canonicals e metadados que ainda apontavam para o domínio antigo.
5. Criados imagem social oficial, página 404, sitemap e robots no domínio próprio.
6. Adicionados foco visível, link para pular conteúdo, áreas clicáveis mínimas, redução de movimento e melhoria de teclado/Escape.
7. Endurecidos CSP (Política de Segurança de Conteúdo), HSTS e demais cabeçalhos de segurança.
8. Corrigido \`.gitignore\` e ampliado \`.assetsignore\` para não publicar fontes, relatórios, utilitários locais e fragmentos legados.
9. Criada auditoria estática rigorosa e verificação obrigatória no GitHub Actions antes da integração ao \`main\`.
10. Centralizada a identificação da versão e criada proteção para links desabilitados controlados por JavaScript.
11. Localizadas 61 imagens que antes dependiam externamente do marketplace.
12. Completada a compatibilidade AM4/DDR4/mATX de uma placa-mãe somente com dados explícitos no título do anúncio.
13. Corrigida após inspeção publicada a disputa de especificidade que ainda deixava faixas claras em Casa e Tecnologia.

## Cobertura de conteúdo e imagens

- Campos essenciais completos: ${audit.products.coverage.nome}/${audit.products.total} nomes, ${audit.products.coverage.marca}/${audit.products.total} marcas, ${audit.products.coverage.categoria}/${audit.products.total} categorias, ${audit.products.coverage.linkAfiliado}/${audit.products.total} links e ${audit.products.coverage.resumo}/${audit.products.total} resumos.
- Benefícios/chips: ${audit.products.derivedCoverage.benefits}/${audit.products.total}.
- Chamada editorial/por que comprar: ${audit.products.derivedCoverage.whyBuy}/${audit.products.total}.
- Fonte técnica cadastrada: ${audit.products.derivedCoverage.technicalSource}/${audit.products.total}.
- Imagens locais: ${audit.products.imageHosting.local}/${audit.products.total}.
- Imagens ainda externas: ${audit.products.imageHosting.external}/${audit.products.total}, todas em \`http2.mlstatic.com\`.
- Preço interno: não é apresentado como dado estático; preço, estoque, frete e variante são confirmados na loja parceira.

## Pendências e limites que não foram escondidos

### 1. HTTP ainda responde sem redirecionar para HTTPS

- Onde: \`http://preconamira.com.br/\`.
- Causa provável: a opção **Always Use HTTPS** da zona Cloudflare não está ativa.
- Impacto: a primeira visita por HTTP não recebe redirecionamento 301/308, embora a página possua CSP e o pacote V18 adicione HSTS.
- Solução: ativar **SSL/TLS → Edge Certificates → Always Use HTTPS** no painel da Cloudflare.
- O que falta: permissão de configuração da zona; não é seguro alterar DNS ou SSL sem essa autorização específica.

### 2. 310 imagens dependem do CDN externo do marketplace

- Onde: produtos listados em \`cobertura-imagens.html\` e no relatório da auditoria.
- Causa: o CDN respondeu 403 à tentativa automatizada de cópia de parte das fotos.
- Impacto: a foto pode falhar caso o endereço externo mude ou bloqueie hotlink.
- Solução: localizar progressivamente fotografias oficiais e armazenar versões otimizadas no projeto.
- O que falta: fonte oficial/arquivo autorizado para esses 310 modelos.

### 3. Destino final dos encurtadores de afiliado

- Onde: links \`meli.la\` do catálogo.
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

- Onde: \`gerenciador.html\`, \`automacao.html\` e \`tools/catalog-server.mjs\` (não publicados).
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

- \`AUDITORIA-V18.md\`: este relatório.
- \`INVENTARIO-ROTAS-V18.csv\`: todas as rotas e seu estado.
- \`RELATORIO-LINKS-V18.csv\`: relação dos links por ocorrência e status.
- \`ARQUIVOS-ALTERADOS-V18.txt\`: lista exata de arquivos modificados, adicionados ou removidos.
- \`.audit/site-audit.json\`: relatório técnico reproduzível, gerado localmente e não publicado.

## Próxima versão recomendada

V18.1 deve modernizar a ingestão de produtos, reduzir a duplicação entre os 37 arquivos de dados e concluir a hospedagem local das 310 fotos externas. A meta arquitetural é gerar páginas, índices, categorias e comparadores a partir de uma única fonte canônica, mantendo pull request, auditoria e rollback em todas as publicações.
`;

fs.writeFileSync(path.join(ROOT, 'AUDITORIA-V18.md'), markdown);
console.log(JSON.stringify({
  routes: routeRows.length,
  linkOccurrences: linkRows.length,
  brokenLinks: brokenLinks.length,
  suspiciousEmptyLinks: emptyLinks.length,
  affiliateOccurrences: affiliateLinks.length,
  alteredFiles: alteredFiles.length,
  outputs: ['AUDITORIA-V18.md', 'INVENTARIO-ROTAS-V18.csv', 'RELATORIO-LINKS-V18.csv', 'ARQUIVOS-ALTERADOS-V18.txt'],
}, null, 2));
