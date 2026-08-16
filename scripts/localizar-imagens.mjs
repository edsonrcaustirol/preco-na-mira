#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, 'assets', 'produtos-localizados');
const TEMP = path.join(ROOT, '.audit', 'downloads');
const CONCURRENCY = Math.max(1, Math.min(24, Number(process.env.PNM_IMAGE_CONCURRENCY || 16)));

function loadProducts() {
  const file = path.join(ROOT, 'data', 'produtos-index.js');
  const context = vm.createContext({ window: {}, globalThis: {} });
  const code = fs.readFileSync(file, 'utf8');
  vm.runInContext(`${code}\n;globalThis.__PRODUCTS__ = PRODUTOS;`, context, { filename: file, timeout: 5000 });
  return context.globalThis.__PRODUCTS__ || [];
}

function imageExtension(buffer) {
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return 'webp';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length >= 6 && /^GIF8[79]a$/.test(buffer.subarray(0, 6).toString())) return 'gif';
  return '';
}

function curl(url, destination) {
  return new Promise((resolve, reject) => {
    const child = spawn('curl', [
      '--fail', '--location', '--silent', '--show-error',
      '--retry', '1', '--retry-all-errors', '--connect-timeout', '8', '--max-time', '24',
      '--output', destination, url,
    ], { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'] });
    let error = '';
    child.stderr.on('data', chunk => { error += chunk; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(error.trim() || `curl saiu com código ${code}`)));
  });
}

async function download(product) {
  const existing = fs.readdirSync(OUTPUT).find(name => name.startsWith(`${product.id}.`));
  if (existing) {
    const relative = `assets/produtos-localizados/${existing}`;
    return { id: product.id, source: product.imagem, relative, bytes: fs.statSync(path.join(ROOT, relative)).size, reused: true };
  }
  const tempFile = path.join(TEMP, `${product.id}.download`);
  await curl(product.imagem, tempFile);
  const buffer = fs.readFileSync(tempFile);
  if (buffer.length < 700) throw new Error(`arquivo muito pequeno (${buffer.length} bytes)`);
  const extension = imageExtension(buffer);
  if (!extension) throw new Error('formato de imagem não reconhecido');
  const relative = `assets/produtos-localizados/${product.id}.${extension}`;
  const finalFile = path.join(ROOT, relative);
  fs.renameSync(tempFile, finalFile);
  return { id: product.id, source: product.imagem, relative, bytes: buffer.length };
}

async function pool(items, worker, limit) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      try { results[index] = { ok: true, value: await worker(items[index], index) }; }
      catch (error) { results[index] = { ok: false, item: items[index], error: error.message }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

function textFiles(dir = ROOT) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && ['.git', 'node_modules', '.audit'].includes(entry.name)) continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...textFiles(absolute));
    else if (/\.(?:html|js|json|xml|md|txt|csv)$/i.test(entry.name)) files.push(absolute);
  }
  return files;
}

const products = loadProducts();
const remote = products.filter(product => /^https?:\/\//i.test(String(product?.imagem || '')));
fs.mkdirSync(OUTPUT, { recursive: true });
fs.mkdirSync(TEMP, { recursive: true });

console.log(`Localizando ${remote.length} imagens externas com concorrência ${CONCURRENCY}...`);
const downloads = await pool(remote, download, CONCURRENCY);
const successful = downloads.filter(result => result.ok).map(result => result.value);
const failed = downloads.filter(result => !result.ok).map(result => ({ id: result.item.id, url: result.item.imagem, error: result.error }));

const replacements = new Map(successful.map(item => [item.source, item.relative]));
let changedFiles = 0;
let replacementCount = 0;
for (const file of textFiles()) {
  const original = fs.readFileSync(file, 'utf8');
  let updated = original;
  for (const [source, destination] of replacements) {
    if (!updated.includes(source)) continue;
    const parts = updated.split(source);
    replacementCount += parts.length - 1;
    updated = parts.join(destination);
  }
  if (updated !== original) {
    fs.writeFileSync(file, updated);
    changedFiles += 1;
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  requested: remote.length,
  downloaded: successful.length,
  failed,
  bytes: successful.reduce((sum, item) => sum + item.bytes, 0),
  changedFiles,
  replacementCount,
  files: successful,
};
fs.writeFileSync(path.join(ROOT, '.audit', 'localized-images.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ requested: report.requested, downloaded: report.downloaded, failed: failed.length, bytes: report.bytes, changedFiles, replacementCount, report: '.audit/localized-images.json' }, null, 2));
if (failed.length) process.exitCode = 1;
