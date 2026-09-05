#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();

export const INTERNAL_LINK_RULES = [
  {
    id: 'universo-casa-para-ambientes',
    source: 'universo-casa.html',
    target: 'ambiente-casa',
    criterion: 'A landing Universo Casa já declara a etapa Ambientes como ativa; ambiente-casa é o hub existente dessa etapa.',
    needle: '<a class="ghost" href="pequenos-espacos">📐 PEQUENOS ESPAÇOS</a>',
    replacement: '<a class="ghost" href="pequenos-espacos">📐 PEQUENOS ESPAÇOS</a><a class="ghost" href="ambiente-casa">🏠 AMBIENTES</a>',
  },
  {
    id: 'pequenos-espacos-para-comparador',
    source: 'pequenos-espacos.html',
    target: 'comparativo-compactos',
    criterion: 'comparativo-compactos declara explicitamente o contexto Pequenos Espaços e comparação por mesma função.',
    needle: '<a class="ps-btn" href="catalogo">ABRIR CATÁLOGO</a>',
    replacement: '<a class="ps-btn" href="catalogo">ABRIR CATÁLOGO</a>\n<a class="ps-btn" href="comparativo-compactos">ABRIR COMPARADOR</a>',
  },
  {
    id: 'guias-para-guia-fones',
    source: 'guias.html',
    target: 'guia-fones',
    criterion: 'guias é o índice editorial dos guias existentes; guia-fones já é uma landing indexável de guia de compra.',
    needle: '<a class="guide-card" href="monitor-para-ps5"><small>MONITORES • CONSOLE</small><h2>Monitor para PS5: 1440p, 4K, 120 Hz e HDMI 2.1</h2><p>Entenda o que o console realmente pode aproveitar antes de pagar por especificações que ficarão ociosas.</p><b>LER GUIA →</b></a>',
    replacement: '<a class="guide-card" href="guia-fones"><small>ÁUDIO</small><h2>Como escolher fone de ouvido</h2><p>Formato, uso, ANC, chamadas, bateria e ecossistema antes de comparar modelos.</p><b>LER GUIA →</b></a><a class="guide-card" href="monitor-para-ps5"><small>MONITORES • CONSOLE</small><h2>Monitor para PS5: 1440p, 4K, 120 Hz e HDMI 2.1</h2><p>Entenda o que o console realmente pode aproveitar antes de pagar por especificações que ficarão ociosas.</p><b>LER GUIA →</b></a>',
  },
  {
    id: 'cinema-para-setup-tv-soundbar',
    source: 'cinema-em-casa.html',
    target: 'setup-tv-soundbar',
    criterion: 'setup-tv-soundbar é uma experiência existente de TV + soundbar e já referencia Cinema em Casa como experiência expandida.',
    needle: '<li>Compartilhe o setup para revisar depois ou mandar para outra pessoa opinar.</li>\n          </ul>',
    replacement: '<li>Compartilhe o setup para revisar depois ou mandar para outra pessoa opinar.</li>\n          </ul>\n          <p><a class="btn btn-dark" href="setup-tv-soundbar">ABRIR SETUP TV + SOUNDBAR →</a></p>',
  },
];

function hrefPattern(target) {
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\bhref=(?:"/?${escaped}"|'/?${escaped}')`, 'i');
}

export function applyRule(html, rule) {
  if (hrefPattern(rule.target).test(html)) {
    return { html, changed: false, state: 'already-present' };
  }
  const occurrences = html.split(rule.needle).length - 1;
  if (occurrences !== 1) {
    throw new Error(`${rule.id}: âncora estrutural esperada exatamente 1 vez; encontrada ${occurrences}.`);
  }
  const next = html.replace(rule.needle, rule.replacement);
  if (!hrefPattern(rule.target).test(next)) {
    throw new Error(`${rule.id}: transformação não produziu link para ${rule.target}.`);
  }
  return { html: next, changed: true, state: 'inserted' };
}

export function applyInternalLinks(rootDir = ROOT) {
  const root = path.resolve(rootDir);
  const details = [];
  let changedFiles = 0;

  for (const rule of INTERNAL_LINK_RULES) {
    const file = path.join(root, rule.source);
    if (!fs.existsSync(file)) throw new Error(`${rule.id}: source ausente: ${rule.source}.`);
    const original = fs.readFileSync(file, 'utf8');
    const result = applyRule(original, rule);
    if (result.changed) {
      fs.writeFileSync(file, result.html);
      changedFiles += 1;
    }
    details.push({
      id: rule.id,
      source: rule.source,
      target: `/${rule.target}`,
      criterion: rule.criterion,
      state: result.state,
    });
  }

  return { contract: 'pnm.m2d-internal-linking/v1', changedFiles, details };
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) console.log(JSON.stringify(applyInternalLinks(process.cwd()), null, 2));
