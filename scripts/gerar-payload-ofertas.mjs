import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OFFERS_TARGET = 30;
const MOBILE_DATA = path.join(ROOT, 'data', 'produtos-mobile.js');
const OFFERS_HTML = path.join(ROOT, 'ofertas.html');
const OUTPUT = path.join(ROOT, 'data', 'produtos-ofertas.js');

function readProducts(file) {
  const source = fs.readFileSync(file, 'utf8');
  const start = source.indexOf('[');
  const end = source.lastIndexOf(']');
  if (start < 0 || end <= start) throw new Error(`PRODUTOS inválido em ${path.relative(ROOT, file)}.`);
  return JSON.parse(source.slice(start, end + 1));
}

const products = readProducts(MOBILE_DATA);
const byId = new Map(products.map(product => [product.id, product]));
const html = fs.readFileSync(OFFERS_HTML, 'utf8');
const ids = [...html.matchAll(/data-pnm-product-id="([^"]+)"/g)].map(match => match[1]);

if (ids.length !== OFFERS_TARGET) {
  throw new Error(`Payload de Ofertas exige ${OFFERS_TARGET} cards prerenderizados; encontrados ${ids.length}.`);
}
if (new Set(ids).size !== ids.length) {
  throw new Error('Payload de Ofertas contém IDs duplicados na curadoria prerenderizada.');
}

const selected = ids.map(id => {
  const product = byId.get(id);
  if (!product) throw new Error(`Produto curado ausente do dataset mobile: ${id}.`);
  return product;
});

const output = `/* Gerado automaticamente por scripts/gerar-payload-ofertas.mjs a partir da curadoria prerenderizada e do derivado canônico mobile. */\nconst PRODUTOS = ${JSON.stringify(selected)};\n`;
fs.writeFileSync(OUTPUT, output);

console.log(JSON.stringify({
  source: 'data/produtos-mobile.js',
  sourceRecords: products.length,
  curatedRecords: selected.length,
  output: 'data/produtos-ofertas.js',
  outputBytes: Buffer.byteLength(output)
}, null, 2));
