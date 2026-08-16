#!/usr/bin/env node

import fs from 'node:fs';
import vm from 'node:vm';

const files = [
  'data/produtos-gamer.js',
  'data/produtos-gamerhub.js',
  'data/produtos-index.js',
  'data/produtos-montar-pc.js',
];

const confirmed = {
  'placa-mae-asus-p-amd-am4-b550m-plus-tuf-gaming-4xddr4-matx': {
    socket: 'AM4',
    memory: 'DDR4',
    formFactor: 'mATX',
    confidence: 'confirmed-in-listing-title',
  },
};

function load(file) {
  const context = vm.createContext({ globalThis: {} });
  vm.runInContext(`${fs.readFileSync(file, 'utf8')}\n;globalThis.__products = PRODUTOS;`, context, { filename: file });
  return context.globalThis.__products;
}

for (const file of files) {
  const products = load(file);
  for (const [id, compat] of Object.entries(confirmed)) {
    const product = products.find(item => item.id === id);
    if (!product) throw new Error(`${file}: produto ${id} não encontrado`);
    product.compat = compat;
  }
  fs.writeFileSync(file, `const PRODUTOS = ${JSON.stringify(products)};\n`);
}

console.log(`Compatibilidade confirmada sincronizada em ${files.length} arquivos.`);
