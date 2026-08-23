#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { auditProducts, CLASSIFICATIONS, compareResults, summarize } from './lib/affiliate-integrity.mjs';

const OWNER_PATH = 'data/produtos-index.js';
const CONTRACT = 'pnm.affiliate-integrity/v1';

function parseArgs(argv) {
  const args = { ids: [], concurrency: 2, throttleMs: 400, timeoutMs: 12000, retries: 1, maxRedirects: 6 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const take = () => {
      if (i + 1 >= argv.length) throw new Error(`Valor ausente para ${arg}`);
      return argv[++i];
    };
    if (arg === '--id') args.ids.push(take());
    else if (arg === '--ids') args.ids.push(...take().split(',').map(v => v.trim()).filter(Boolean));
    else if (arg === '--input') args.input = take();
    else if (arg === '--changed-from') args.changedFrom = take();
    else if (arg === '--compare-to') args.compareTo = take();
    else if (arg === '--output') args.output = take();
    else if (arg === '--concurrency') args.concurrency = Number(take());
    else if (arg === '--throttle-ms') args.throttleMs = Number(take());
    else if (arg === '--timeout-ms') args.timeoutMs = Number(take());
    else if (arg === '--retries') args.retries = Number(take());
    else if (arg === '--max-redirects') args.maxRedirects = Number(take());
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Argumento desconhecido: ${arg}`);
  }
  args.ids = [...new Set(args.ids)];
  return args;
}

function printHelp() {
  console.error(`Uso:\n  npm run audit:affiliate-integrity -- [opções]\n\nSem filtros, audita o catálogo canônico inteiro.\n\nOpções:\n  --id <product_id>             audita um único ID (pode repetir)\n  --ids <id1,id2>               audita um lote de IDs\n  --input <arquivo.json>        audita produtos novos a partir de JSON sem alterar o owner\n  --changed-from <report.json>  audita somente IDs novos ou com linkAfiliado alterado\n  --compare-to <report.json>    inclui delta de classificações/exceções no novo relatório\n  --output <report.json>        persiste o relatório estruturado\n  --concurrency <n>             concorrência baixa (padrão: 2)\n  --throttle-ms <ms>            espera entre itens por worker (padrão: 400)\n  --timeout-ms <ms>             timeout por request (padrão: 12000)\n  --retries <n>                 retentativas transitórias (padrão: 1)\n  --max-redirects <n>           limite de redirects (padrão: 6)`);
}

async function loadCanonicalProducts(filePath = OWNER_PATH) {
  const source = await fs.readFile(filePath, 'utf8');
  const sandbox = { window: {}, self: {} };
  vm.createContext(sandbox);
  vm.runInContext(`${source}\n;globalThis.__PNM_AUDIT_PRODUCTS__ = (typeof PRODUTOS !== 'undefined' ? PRODUTOS : (window.PRODUTOS || self.PRODUTOS));`, sandbox, { timeout: 2000, filename: filePath });
  const products = sandbox.__PNM_AUDIT_PRODUCTS__;
  if (!Array.isArray(products)) throw new Error(`Não foi possível carregar array PRODUTOS de ${filePath}`);
  return products;
}

async function loadInputProducts(inputPath) {
  const parsed = JSON.parse(await fs.readFile(inputPath, 'utf8'));
  const products = Array.isArray(parsed) ? parsed : parsed.products;
  if (!Array.isArray(products)) throw new Error('--input deve conter um array JSON ou {"products": [...]}');
  return products;
}

function validateProducts(products) {
  for (const product of products) {
    for (const field of ['id', 'nome', 'marca', 'categoria', 'linkAfiliado']) {
      if (!product?.[field]) throw new Error(`Produto inválido: campo ${field} ausente em ${product?.id || '<sem id>'}`);
    }
  }
}

async function filterChangedFrom(products, reportPath) {
  if (!reportPath) return products;
  const previous = JSON.parse(await fs.readFile(reportPath, 'utf8'));
  const oldLinks = new Map((previous.results || []).map(item => [item.product_id, item.linkAfiliado]));
  return products.filter(product => oldLinks.get(product.id) !== product.linkAfiliado);
}

function filterIds(products, ids) {
  if (!ids.length) return products;
  const wanted = new Set(ids);
  const selected = products.filter(product => wanted.has(product.id));
  const found = new Set(selected.map(product => product.id));
  const missing = ids.filter(id => !found.has(id));
  if (missing.length) throw new Error(`product_id não encontrado: ${missing.join(', ')}`);
  return selected;
}

function printHuman(report) {
  const s = report.summary;
  console.error('AUDITOR DE INTEGRIDADE DOS LINKS AFILIADOS');
  console.error(`TOTAL: ${s.TOTAL}`);
  console.error(`CORRETOS: ${s.CORRETOS}`);
  console.error(`PROVÁVEIS: ${s.PROVAVEIS}`);
  console.error(`DIVERGENTES: ${s.DIVERGENTES}`);
  console.error(`INDISPONÍVEIS: ${s.INDISPONIVEIS}`);
  console.error(`DESTINO GENÉRICO: ${s.DESTINO_GENERICO}`);
  console.error(`PROBLEMAS DE LINK: ${s.PROBLEMAS_DE_LINK}`);
  console.error(`NÃO COMPROVÁVEIS: ${s.NAO_COMPROVAVEIS}`);
  const exceptions = report.results.filter(item => ![CLASSIFICATIONS.CORRETO, CLASSIFICATIONS.PROVAVEL].includes(item.classification));
  if (exceptions.length) {
    console.error('\nEXCEÇÕES:');
    for (const item of exceptions) console.error(`- ${item.product_id} | ${item.classification} | ${item.reason}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();

  let products = args.input ? await loadInputProducts(args.input) : await loadCanonicalProducts();
  validateProducts(products);
  products = await filterChangedFrom(products, args.changedFrom);
  products = filterIds(products, args.ids);

  const startedAt = new Date().toISOString();
  const results = await auditProducts(products, {
    concurrency: args.concurrency,
    throttleMs: args.throttleMs,
    network: {
      timeoutMs: args.timeoutMs,
      retries: args.retries,
      maxRedirects: args.maxRedirects,
    },
  });
  const finishedAt = new Date().toISOString();
  const previousForComparison = args.compareTo ? JSON.parse(await fs.readFile(args.compareTo, 'utf8')) : null;

  const report = {
    contract: CONTRACT,
    generatedAt: finishedAt,
    run: {
      startedAt,
      finishedAt,
      source: args.input || OWNER_PATH,
      selection: args.ids.length ? { product_ids: args.ids } : (args.changedFrom ? { changedFrom: args.changedFrom } : { all: true }),
      networkPolicy: { concurrency: args.concurrency, throttleMs: args.throttleMs, timeoutMs: args.timeoutMs, retries: args.retries, maxRedirects: args.maxRedirects },
    },
    summary: summarize(results),
    delta: previousForComparison ? compareResults(previousForComparison.results || [], results) : null,
    results,
  };

  printHuman(report);
  const json = `${JSON.stringify(report, null, 2)}\n`;
  process.stdout.write(json);
  if (args.output) {
    await fs.mkdir(path.dirname(args.output), { recursive: true });
    await fs.writeFile(args.output, json, 'utf8');
    console.error(`\nRelatório JSON: ${args.output}`);
  }
}

main().catch(error => {
  console.error(`audit:affiliate-integrity: ${error.message}`);
  process.exitCode = 1;
});
