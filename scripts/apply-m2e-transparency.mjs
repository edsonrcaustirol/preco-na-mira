#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const EXCLUDED = new Set(['automacao.html', 'gerenciador.html']);
const AFFILIATE_LINK = /<a\b(?=[^>]*\bhref=(?:"https:\/\/(?:meli\.la|(?:www\.)?mercadolivre\.com(?:\.br)?)[^"]*"|'https:\/\/(?:meli\.la|(?:www\.)?mercadolivre\.com(?:\.br)?)[^']*'))[^>]*>/i;

const TOPBAR = '<div class="topbar" data-pnm-trust="m2e">O Preço na Mira organiza e apresenta produtos para facilitar a descoberta. Alguns links podem gerar comissão de afiliado em compras elegíveis.</div>';
const DISCLOSURE = '<div class="affiliate-note" data-pnm-affiliate-disclosure="m2e">Alguns links desta página são de afiliado. Uma compra elegível no site de destino pode gerar comissão para o Preço na Mira. A compra acontece no site de destino; preço, estoque, entrega e condições finais são definidos pelo vendedor ou marketplace e devem ser confirmados antes da compra.</div>';

export function applyTransparency(input) {
  let html = String(input || '');

  html = html.replace(
    /<div class="topbar">\s*Conte[uú]do independente\s*•\s*Alguns links podem gerar comiss[aã]o de afiliado,?\s*sem custo (?:extra|adicional)(?: para voc[eê])?\.?\s*<\/div>/gi,
    TOPBAR,
  );
  html = html.replace(
    /<div class="topbar">\s*Conte[uú]do independente\s*•\s*Alguns links podem gerar comiss[aã]o de afiliado\.?\s*<\/div>/gi,
    TOPBAR,
  );
  html = html.replace(/VER OFERTA ATUAL\s*↗/gi, 'VER NO MERCADO LIVRE ↗');

  html = html.replace(
    /<div class="affiliate-note"(?:\s+data-pnm-affiliate-disclosure=(?:"m2e"|'m2e'))?>[\s\S]*?<\/div>/gi,
    DISCLOSURE,
  );

  if (AFFILIATE_LINK.test(html) && !/data-pnm-affiliate-disclosure=(?:"m2e"|'m2e')/i.test(html)) {
    const block = `<div class="container pnm-affiliate-disclosure-wrap">${DISCLOSURE}</div>`;
    if (/<\/main>/i.test(html)) html = html.replace(/<\/main>/i, `${block}</main>`);
    else html = html.replace(/<\/body>/i, `${block}</body>`);
  }

  return html;
}

function main() {
  const files = fs.readdirSync(ROOT, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.html') && !EXCLUDED.has(entry.name))
    .map(entry => path.join(ROOT, entry.name));
  let changed = 0;
  let commercial = 0;
  for (const file of files) {
    const original = fs.readFileSync(file, 'utf8');
    if (AFFILIATE_LINK.test(original)) commercial += 1;
    const next = applyTransparency(original);
    if (next !== original) {
      fs.writeFileSync(file, next);
      changed += 1;
    }
  }
  console.log(JSON.stringify({ contract: 'pnm.m2e-transparency/v1', files: files.length, commercial, changed }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
