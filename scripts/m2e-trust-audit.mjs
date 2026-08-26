#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const CONTRACT = 'pnm.m2e-trust-audit/v1';
const EXCLUDED = new Set(['automacao.html', 'gerenciador.html']);
const AFFILIATE_HREF = /^https:\/\/(?:meli\.la|(?:www\.)?mercadolivre\.com(?:\.br)?)(?:\/|$)/i;

export const DANGEROUS_CLAIMS = [
  { id: 'editorial-independence', re: /\bconte[uú]do independente\b/i },
  { id: 'affiliate-no-extra-cost', re: /\bsem custo (?:extra|adicional)(?: para voc[eê])?\b/i },
  { id: 'lowest-price-guaranteed', re: /\bmenor pre[cç]o garantido\b/i },
  { id: 'best-price-guaranteed', re: /\bmelhor pre[cç]o garantido\b/i },
  { id: 'price-guaranteed', re: /\bpre[cç]o garantido\b/i },
  { id: 'offer-guaranteed', re: /\boferta garantida\b/i },
  { id: 'expert-tested', re: /\btestad[oa] por (?:n[oó]s|nossos especialistas)\b/i },
  { id: 'expert-recommended', re: /\brecomendad[oa] por especialistas\b/i },
  { id: 'stock-guaranteed', re: /\bestoque garantido\b/i },
  { id: 'fake-safe', re: /\b(?:100% seguro|compra segura|site verificado)\b/i },
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
    .replace(/\s+/g, ' ')
    .trim();
}

export function findDangerousClaims(html) {
  const text = textFromHtml(html);
  return DANGEROUS_CLAIMS.filter(claim => claim.re.test(text)).map(claim => claim.id);
}

function parseAttrs(source = '') {
  const attrs = {};
  const re = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = re.exec(source))) attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  return attrs;
}

export function auditHtml(name, html) {
  const affiliateLinks = [];
  for (const match of String(html).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = parseAttrs(match[1]);
    if (!AFFILIATE_HREF.test(attrs.href || '')) continue;
    affiliateLinks.push({
      href: attrs.href,
      sponsored: /(?:^|\s)sponsored(?:\s|$)/i.test(attrs.rel || ''),
      secureExternal: /(?:^|\s)noopener(?:\s|$)/i.test(attrs.rel || '') && (attrs.target || '').toLowerCase() === '_blank',
      clearDestination: /mercado livre/i.test(textFromHtml(match[2])) || /mercado livre/i.test(attrs['aria-label'] || ''),
    });
  }
  const commercial = affiliateLinks.length > 0;
  const hasDisclosure = /data-pnm-affiliate-disclosure=(?:"m2e"|'m2e')/i.test(html)
    || (/comiss[aã]o/i.test(textFromHtml(html)) && /site de destino/i.test(textFromHtml(html)));
  const schemas = [...String(html).matchAll(/<script\b[^>]*type=(?:"application\/ld\+json"|'application\/ld\+json')[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
  return {
    name,
    commercial,
    affiliateLinks,
    hasDisclosure,
    dangerousClaims: findDangerousClaims(html),
    personSchema: schemas.some(value => /"@type"\s*:\s*"Person"/i.test(value)),
    reviewSchema: schemas.some(value => /"(?:review|aggregateRating)"\s*:/i.test(value)),
    inventedDates: /(?:Publicado em|Atualizado em|Última atualização)[^<]{0,40}\bnew Date\s*\(/i.test(html),
  };
}

export function buildReport(files) {
  const pages = files.map(file => auditHtml(path.basename(file), fs.readFileSync(file, 'utf8')));
  const links = pages.flatMap(page => page.affiliateLinks);
  const commercial = pages.filter(page => page.commercial);
  const claimRows = pages.flatMap(page => page.dangerousClaims.map(claim => ({ page: page.name, claim })));
  return {
    contract: CONTRACT,
    authoritative: false,
    generatedFrom: 'conteúdo versionado do repositório; sem trust score',
    pages: {
      total: pages.length,
      commercial: commercial.length,
      commercialWithDisclosure: commercial.filter(page => page.hasDisclosure).length,
    },
    affiliates: {
      total: links.length,
      sponsored: links.filter(link => link.sponsored).length,
      secureExternal: links.filter(link => link.secureExternal).length,
      clearDestination: links.filter(link => link.clearDestination).length,
    },
    claims: {
      unsupported: claimRows.length,
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
  if (report.claims.unsupported) errors.push(`${report.claims.unsupported} claim(s) sensível(is) não comprovado(s)`);
  if (report.affiliates.total !== report.affiliates.sponsored) errors.push('há links afiliados sem rel=sponsored');
  if (report.affiliates.total !== report.affiliates.secureExternal) errors.push('há links afiliados externos sem target=_blank + noopener');
  if (report.affiliates.total !== report.affiliates.clearDestination) errors.push('há CTA afiliado sem destino Mercado Livre claro');
  if (report.pages.commercial !== report.pages.commercialWithDisclosure) errors.push('há página comercial sem disclosure contextual');
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
    personSchema: report.schema.personPages.length,
    reviewOrRatingSchema: report.schema.reviewOrRatingPages.length,
    errors,
  }, null, 2));
  if (errors.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
