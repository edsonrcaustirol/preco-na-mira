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
  {
    id: 'ipec-al4-max-para-casa-inteligente',
    source: 'produto-ipec-al4-max.html',
    target: 'casa-inteligente',
    criterion: 'A própria página e o Product JSON-LD classificam o Ipec AL4 Max em Casa inteligente; o link transforma essa categoria factual em navegação rastreável.',
    needle: '<div class="side-item"><strong>Categoria</strong>Casa inteligente</div>',
    replacement: '<div class="side-item"><strong>Categoria</strong><a href="casa-inteligente">Casa inteligente</a></div>',
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

function pagePath(kind, page) {
  return page <= 1 ? kind : `${kind}-pagina-${page}`;
}

export function paginationTargets(page, totalPages) {
  const pages = new Set([1, totalPages]);

  for (let current = Math.max(1, page - 3); current <= Math.min(totalPages, page + 3); current += 1) {
    pages.add(current);
  }

  for (let distance = 5; distance < totalPages; distance *= 2) {
    const backward = page - distance;
    const forward = page + distance;
    if (backward >= 1) pages.add(backward);
    if (forward <= totalPages) pages.add(forward);
  }

  return [...pages].sort((a, b) => a - b);
}

export function applyPaginationBoundaries(html, kind, label) {
  const pattern = /<span class="pnm-seo-pages">[\s\S]*?<\/span><span class="pnm-seo-page-status">Página (\d+) de (\d+)<\/span>/;
  const match = html.match(pattern);
  if (!match) return { html, changed: false, state: 'no-pagination' };

  const page = Number(match[1]);
  const totalPages = Number(match[2]);
  if (!Number.isInteger(page) || !Number.isInteger(totalPages) || page < 1 || totalPages < page) {
    throw new Error(`${kind}: status de paginação inválido: ${match[1]} de ${match[2]}.`);
  }

  const links = paginationTargets(page, totalPages)
    .map(current => current === page
      ? `<strong aria-current="page">${current}</strong>`
      : `<a href="${pagePath(kind, current)}" aria-label="${label} — página ${current}">${current}</a>`)
    .join('');
  const replacement = `<span class="pnm-seo-pages">${links}</span><span class="pnm-seo-page-status">Página ${page} de ${totalPages}</span>`;
  const next = html.replace(pattern, replacement);
  return { html: next, changed: next !== html, state: next === html ? 'already-present' : 'expanded' };
}

function applyPaginationArchitecture(root) {
  const details = [];
  let changedFiles = 0;
  for (const { kind, label } of [{ kind: 'catalogo', label: 'Catálogo' }, { kind: 'ofertas', label: 'Ofertas' }]) {
    const matcher = new RegExp(`^${kind}(?:-pagina-\\d+)?\\.html$`);
    for (const name of fs.readdirSync(root).filter(file => matcher.test(file)).sort()) {
      const file = path.join(root, name);
      const original = fs.readFileSync(file, 'utf8');
      const result = applyPaginationBoundaries(original, kind, label);
      if (result.changed) {
        fs.writeFileSync(file, result.html);
        changedFiles += 1;
      }
      details.push({ source: name, state: result.state });
    }
  }
  return { changedFiles, details };
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

  const pagination = applyPaginationArchitecture(root);
  changedFiles += pagination.changedFiles;
  return {
    contract: 'pnm.m2d-internal-linking/v3',
    changedFiles,
    details,
    pagination: {
      strategy: 'local-radius-3-plus-exponential-jumps-5x2^n',
      changedFiles: pagination.changedFiles,
      pages: pagination.details.length,
      details: pagination.details,
    },
  };
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) console.log(JSON.stringify(applyInternalLinks(process.cwd()), null, 2));
