import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const queue = fs.readFileSync(new URL('scripts/fila-links-2026-08-16.txt', root), 'utf8');
const links = queue.split(/\r?\n/).slice(43).map(line => line.match(/PENDENTE\s+(https:\/\/meli\.la\/\S+)/i)?.[1]).filter(Boolean);
const data = links.map((link, index) => ({id: index + 1, link, especial: link.includes('24zmozq')}));
fs.writeFileSync(new URL('data/dewalt-pendentes.js', root), `/* Links recebidos; não representam produtos identificados. */\nwindow.PNM_DEWALT_PENDING=${JSON.stringify(data)};\n`);
console.log(`Fila DeWalt publicada: ${data.length} links.`);
