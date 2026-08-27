#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const CONTRACT = 'pnm.m2e-trust-audit/v1';
const EXCLUDED = new Set(['automacao.html', 'gerenciador.html']);
const AFFILIATE_HREF = /^https:\/\/(?:meli\.la|(?:www\.)?mercadolivre\.com(?:\.br)?)(?:\/|$)/i;

export const DANGEROUS_CLAIMS = [
  { id: 'editorial-independence', type: 'autoridade-editorial', re: /\bconte[uú]do independente\b/i },
  { id: 'affiliate-no-extra-cost', type: 'afiliado-custo', re: /\bsem custo (?:extra|adicional)(?: para voc[eê])?\b/i },
  { id: 'lowest-price-guaranteed', type: 'preco-absoluto', re: /\bmenor pre[cç]o garantido\b/i },
  { id: 'best-price-guaranteed', type: 'preco-absoluto', re: /\bmelhor pre[cç]o garantido\b/i },
  { id: 'price-guaranteed', type: 'preco-absoluto', re: /\bpre[cç]o garantido\b/i },
  { id: 'offer-guaranteed', type: 'oferta-absoluta', re: /\boferta garantida\b/i },
  { id: 'expert-tested', type: 'experiencia', re: /\btestad[oa] por (?:n[oó]s|nossos especialistas)\b/i },
  { id: 'expert-recommended', type: 'autoridade', re: /\brecomendad[oa] por especialistas\b/i },
  { id: 'stock-guaranteed', type: 'estoque-absoluto', re: /\bestoque garantido\b/i },
  { id: 'fake-safe', type: 'seguranca-absoluta', re: /\b(?:100% seguro|compra segura|site verificado)\b/i },
];

function walkHtml(root = ROOT) {
  return fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.html') && !EXCLUDED.has(entry.name))
    .map(entry => path.join(root, entry.name));
}

export function textFromHtml(html) {
  return String(html || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&rarr;|&#8594;/gi, '→')
    .replace(/\s+/g, ' ')
    .trim();
}

function claimSnippet(text, re, radius = 90) {
  const match = text.match(re);
  if (!match || match.index == null) return '';
  const start = Math.max(0, match.index - radius);
  const end = Math.min(text.length, match.index + match[0].length + radius);
  return text.slice(start, end).trim();
}

export function findDangerousClaimOccurrences(html) {
  const text = textFromHtml(html);
  return DANGEROUS_CLAIMS.flatMap(claim => {
    if (!claim.re.test(text)) return [];
    return [{
      claim: claim.id,
      type: claim.type,
      snippet: claimSnippet(text, claim.re),
      context: 'texto visível da página',
      classification: 'AMBÍGUO',
      action: 'REVISAR_ORIGEM_E_EVIDENCIA',
    }];
  });
}

export function findDangerousClaims(html) {
  return findDangerousClaimOccurrences(html).map(row => row.claim);
}

function parseAttrs(source = '') {
  const attrs = {};
  const re = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = re.exec(source))) attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  return attrs;
}

export function auditHtml(name, html) {
  const source = String(html || '');
  const visibleText = textFromHtml(source);
  const affiliateLinks = [];
  for (const match of source.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = parseAttrs(match[1]);
    if (!AFFILIATE_HREF.test(attrs.href || '')) continue;
    affiliateLinks.push({
      href: attrs.href,
      sponsored: /(?:^|\s)sponsored(?:\s|$)/i.test(attrs.rel || ''),
      secureExternal: /(?:^|\s)noopener(?:\s|$)/i.test(attrs.rel || '') && (attrs.target || '').toLowerCase() === '_blank',
      elementDestinationExplicit: /mercado livre/i.test(textFromHtml(match[2])) || /mercado livre/i.test(attrs['aria-label'] || ''),
    });
  }

  const commercial = affiliateLinks.length > 0;
  const hasDisclosure = /data-pnm-affiliate-disclosure=(?:"m2e"|'m2e')/i.test(source)
    || (/comiss[aã]o/i.test(visibleText) && /site de destino/i.test(visibleText));
  const namesMarketplace = /\bmercado livre\b/i.test(visibleText);
  const explainsExternalPurchase = /\b(?:compra|comprar)\b[\s\S]{0,120}\b(?:site de destino|mercado livre|marketplace)\b/i.test(visibleText)
    || /\b(?:site de destino|mercado livre|marketplace)\b[\s\S]{0,120}\b(?:compra|comprar)\b/i.test(visibleText);
  const explicitExternalDestination = commercial && hasDisclosure && namesMarketplace && explainsExternalPurchase;
  const schemas = [...source.matchAll(/<script\b[^>]*type=(?:"application\/ld\+json"|'application\/ld\+json')[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]);

  return {
    name,
    commercial,
    affiliateLinks,
    hasDisclosure,
    namesMarketplace,
    explainsExternalPurchase,
    explicitExternalDestination,
    dangerousClaims: findDangerousClaims(source),
    dangerousClaimOccurrences: findDangerousClaimOccurrences(source),
    personSchema: schemas.some(value => /"@type"\s*:\s*"Person"/i.test(value)),
    reviewSchema: schemas.some(value => /"(?:review|aggregateRating)"\s*:/i.test(value)),
    inventedDates: /(?:Publicado em|Atualizado em|Última atualização)[^<]{0,40}\bnew Date\s*\(/i.test(source),
  };
}

export function buildReport(files) {
  const pages = files.map(file => auditHtml(path.basename(file), fs.readFileSync(file, 'utf8')));
  const links = pages.flatMap(page => page.affiliateLinks);
  const commercial = pages.filter(page => page.commercial);
  const claimRows = pages.flatMap(page => page.dangerousClaimOccurrences.map(row => ({ page: page.name, ...row })));
  const semanticGroups = [...new Set(claimRows.map(row => row.claim))].sort();
  return {
    contract: CONTRACT,
    authoritative: false,
    generatedFrom: 'conteúdo versionado do repositório; sem trust score',
    pages: {
      total: pages.length,
      commercial: commercial.length,
      commercialWithDisclosure: commercial.filter(page => page.hasDisclosure).length,
      commercialWithExplicitDestination: commercial.filter(page => page.explicitExternalDestination).length,
    },
    affiliates: {
      total: links.length,
      sponsored: links.filter(link => link.sponsored).length,
      secureExternal: links.filter(link => link.secureExternal).length,
      elementDestinationExplicit: links.filter(link => link.elementDestinationExplicit).length,
      coveredByExplicitPageContext: commercial
        .filter(page => page.explicitExternalDestination)
        .reduce((sum, page) => sum + page.affiliateLinks.length, 0),
    },
    claims: {
      unsupported: claimRows.length,
      semanticGroups,
      occurrences: claimRows,
    },
    schema: {
      personPages: pages.filter(page => page.personSchema).map(page => page.name),
      reviewOrRatingPages: pages.filter(page => page.reviewSchema).map(page => page.name),
    },
  };
}

export function validateReport(report) {
  const errors = [];
  if (report.claims.unsupported) errors.push(`${report.claims.unsupported} claim(s) sensível(is) não resolvido(s)`);
  if (report.affiliates.total !== report.affiliates.sponsored) errors.push('há links afiliados sem rel=sponsored');
  if (report.affiliates.total !== report.affiliates.secureExternal) errors.push('há links afiliados externos sem target=_blank + noopener');
  if (report.pages.commercial !== report.pages.commercialWithDisclosure) errors.push('há página comercial sem disclosure contextual');
  if (report.pages.commercial !== report.pages.commercialWithExplicitDestination) errors.push('há página comercial sem destino externo suficientemente explícito');
  if (report.schema.personPages.length) errors.push('Person schema exige revisão factual humana');
  if (report.schema.reviewOrRatingPages.length) errors.push('review/rating schema exige evidência verificável');
  return errors;
}

function main() {
  const report = buildReport(walkHtml());
  const errors = validateReport(report);
  fs.mkdirSync(path.join(ROOT, '.audit'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, '.audit', 'm2e-trust-audit.json'), `${JSON.stringify({ ...report, status: errors.length ? 'FAIL' : 'PASS', errors }, null, 2)}\n`);
  console.log(JSON.stringify({
    contract: report.contract,
    status: errors.length ? 'FAIL' : 'PASS',
    pages: report.pages,
    affiliates: report.affiliates,
    unsupportedClaims: report.claims.unsupported,
    semanticGroups: report.claims.semanticGroups,
    claimOccurrences: report.claims.occurrences,
    personSchema: report.schema.personPages.length,
    reviewOrRatingSchema: report.schema.reviewOrRatingPages.length,
    errors,
  }, null, 2));
  if (errors.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
