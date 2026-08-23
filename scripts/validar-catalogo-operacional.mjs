#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MOBILE_FIELDS = ['id','nome','marca','categoria','categoriaId','tipoProduto','imagem','imagemFallback','imagemAlt','imagemTipo','linkAfiliado','oferta','destaque','faixa','selo','chamada','resumo','subtipo','subtipoCasa','subtipoCozinha','subtipoLavanderia','subtipoGamer','subtipoAcessorio','subtipoObra','subtipoInstalacao','subtipoAcabamento','porteEspaco'];
const REQUIRED_FIELDS = ['id','nome','marca','categoria','imagem','imagemAlt','linkAfiliado','loja','resumo'];
const OFFER_TARGET = 30;
const HOME_TARGET = 6;

function parseArray(file) {
  if (!fs.existsSync(file)) throw new Error(`Arquivo ausente: ${file}`);
  const source = fs.readFileSync(file, 'utf8');
  const start = source.indexOf('[');
  const end = source.lastIndexOf(']');
  if (start < 0 || end <= start) throw new Error(`Array inválido: ${file}`);
  return JSON.parse(source.slice(start, end + 1));
}

function section(html, startMarker, endMarker) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker);
  if (start < 0 || end < start) throw new Error(`Marcadores ausentes: ${startMarker} / ${endMarker}`);
  return html.slice(start + startMarker.length, end);
}

function idsFromHtml(html) {
  return [...html.matchAll(/data-pnm-product-id=["']([^"']+)["']/g)].map(match => match[1]);
}

function unique(values) {
  return [...new Set(values)];
}

function duplicates(values) {
  return unique(values.filter((value, index) => values.indexOf(value) !== index));
}

function numericPageSort(a, b) {
  const number = name => Number((name.match(/-pagina-(\d+)\.html$/) || [])[1] || 1);
  return number(a) - number(b);
}

function normalizeHtmlText(value = '') {
  return String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function sameValue(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function relative(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

export function validateCatalog(rootDir = process.cwd()) {
  const ROOT = path.resolve(rootDir);
  const errors = [];
  const canonicalPath = path.join(ROOT, 'data', 'produtos-index.js');
  const mobilePath = path.join(ROOT, 'data', 'produtos-mobile.js');
  const offersPayloadPath = path.join(ROOT, 'data', 'produtos-ofertas.js');
  const dewaltPath = path.join(ROOT, 'data', 'dewalt-pendentes.js');

  let canonical = [];
  let mobile = [];
  let offersPayload = [];
  let dewalt = [];
  try { canonical = parseArray(canonicalPath); } catch (error) { errors.push(error.message); }
  try { mobile = parseArray(mobilePath); } catch (error) { errors.push(error.message); }
  try { offersPayload = parseArray(offersPayloadPath); } catch (error) { errors.push(error.message); }
  try { dewalt = parseArray(dewaltPath); } catch (error) { errors.push(error.message); }

  const canonicalIds = canonical.map(product => product?.id).filter(Boolean);
  const mobileIds = mobile.map(product => product?.id).filter(Boolean);
  const duplicateIds = duplicates(canonicalIds);
  const affiliateLinks = canonical.map(product => String(product?.linkAfiliado || '').trim()).filter(Boolean);
  const duplicateAffiliateLinks = duplicates(affiliateLinks);

  if (duplicateIds.length) errors.push(`IDs duplicados: ${duplicateIds.join(', ')}`);
  if (duplicateAffiliateLinks.length) errors.push(`Links afiliados duplicados: ${duplicateAffiliateLinks.join(', ')}`);

  for (const product of canonical) {
    for (const field of REQUIRED_FIELDS) {
      if (!String(product?.[field] ?? '').trim()) errors.push(`Campo obrigatório ausente em ${product?.id || '(sem id)'}: ${field}`);
    }
    if (product?.oferta !== undefined && typeof product.oferta !== 'boolean') {
      errors.push(`Override oferta inválido em ${product?.id || '(sem id)'}: use true ou false`);
    }
  }

  if (canonical.length !== mobile.length) errors.push(`Fonte/mobile divergem em quantidade: ${canonical.length}/${mobile.length}`);
  if (!sameValue(canonicalIds, mobileIds)) errors.push('Fonte/mobile divergem em IDs ou ordem.');
  const mobileById = new Map(mobile.map(product => [product.id, product]));
  for (const product of canonical) {
    const actual = mobileById.get(product.id);
    if (!actual) continue;
    const expected = Object.fromEntries(MOBILE_FIELDS.filter(field => product[field] !== undefined).map(field => [field, product[field]]));
    if (!sameValue(expected, actual)) errors.push(`Derivado mobile desatualizado: ${product.id}`);
  }

  const canonicalSet = new Set(canonicalIds);
  const productFiles = fs.existsSync(ROOT)
    ? fs.readdirSync(ROOT).filter(name => /^produto-.+\.html$/i.test(name) && name !== 'produto.html').sort()
    : [];
  const pageIds = productFiles.map(name => name.slice('produto-'.length, -'.html'.length));
  const pageSet = new Set(pageIds);
  const missingProductPages = canonicalIds.filter(id => !pageSet.has(id));
  const orphanProductPages = pageIds.filter(id => !canonicalSet.has(id));
  if (missingProductPages.length) errors.push(`Páginas de produto ausentes: ${missingProductPages.join(', ')}`);
  if (orphanProductPages.length) errors.push(`Páginas de produto órfãs: ${orphanProductPages.join(', ')}`);

  const canonicalById = new Map(canonical.map(product => [product.id, product]));
  for (const fileName of productFiles) {
    const id = fileName.slice('produto-'.length, -'.html'.length);
    const product = canonicalById.get(id);
    if (!product) continue;
    const html = fs.readFileSync(path.join(ROOT, fileName), 'utf8');
    const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp(`data-product-id=(?:"${escapedId}"|'${escapedId}')`).test(html)) {
      errors.push(`Página sem identidade do produto: ${fileName}`);
    }
    const h1 = normalizeHtmlText((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '');
    if (h1 !== String(product.nome || '').trim()) errors.push(`Nome da página divergente da fonte: ${fileName}`);
    const affiliate = String(product.linkAfiliado || '');
    if (affiliate && !html.includes(`href="${affiliate}"`) && !html.includes(`href='${affiliate}'`)) {
      errors.push(`Link afiliado da página divergente da fonte: ${fileName}`);
    }
  }

  const catalogFiles = fs.readdirSync(ROOT)
    .filter(name => /^catalogo(?:-pagina-\d+)?\.html$/.test(name))
    .sort(numericPageSort);
  const catalogIds = [];
  for (const fileName of catalogFiles) {
    const html = fs.readFileSync(path.join(ROOT, fileName), 'utf8');
    try {
      catalogIds.push(...idsFromHtml(section(html, '<!-- PNM:SEO:CATALOGO:START -->', '<!-- PNM:SEO:CATALOGO:END -->')));
    } catch (error) {
      errors.push(`${fileName}: ${error.message}`);
    }
  }
  if (duplicates(catalogIds).length) errors.push(`Catálogo contém IDs duplicados: ${duplicates(catalogIds).join(', ')}`);
  if (catalogIds.length !== canonicalIds.length || unique(catalogIds).some(id => !canonicalSet.has(id)) || canonicalIds.some(id => !catalogIds.includes(id))) {
    errors.push(`Catálogo diverge da fonte canônica: ${catalogIds.length}/${canonicalIds.length}`);
  }

  let offerIds = [];
  const offersHtmlPath = path.join(ROOT, 'ofertas.html');
  if (!fs.existsSync(offersHtmlPath)) errors.push('ofertas.html ausente.');
  else {
    const html = fs.readFileSync(offersHtmlPath, 'utf8');
    try { offerIds = idsFromHtml(section(html, '<!-- PNM:SEO:OFERTAS:START -->', '<!-- PNM:SEO:OFERTAS:END -->')); }
    catch (error) { errors.push(`ofertas.html: ${error.message}`); }
  }
  if (offerIds.length !== OFFER_TARGET) errors.push(`Ofertas deve ter ${OFFER_TARGET} produtos; encontrados ${offerIds.length}.`);
  if (duplicates(offerIds).length) errors.push(`Ofertas contém IDs duplicados: ${duplicates(offerIds).join(', ')}`);
  for (const id of offerIds) if (!canonicalSet.has(id)) errors.push(`Oferta ausente da fonte canônica: ${id}`);

  const payloadIds = offersPayload.map(product => product?.id).filter(Boolean);
  if (!sameValue(payloadIds, offerIds)) errors.push('data/produtos-ofertas.js diverge da ordem/seleção de ofertas.html.');

  const forcedIn = canonical.filter(product => product?.oferta === true).map(product => product.id);
  const forcedOut = canonical.filter(product => product?.oferta === false).map(product => product.id);
  for (const id of forcedIn) if (!offerIds.includes(id)) errors.push(`OFERTA ON não respeitada: ${id}`);
  for (const id of forcedOut) if (offerIds.includes(id)) errors.push(`OFERTA OFF não respeitada: ${id}`);

  let homeIds = [];
  const homePath = path.join(ROOT, 'index.html');
  if (!fs.existsSync(homePath)) errors.push('index.html ausente.');
  else {
    const html = fs.readFileSync(homePath, 'utf8');
    try { homeIds = idsFromHtml(section(html, '<!-- PNM:SEO:HOME-HIGHLIGHTS:START -->', '<!-- PNM:SEO:HOME-HIGHLIGHTS:END -->')); }
    catch (error) { errors.push(`index.html: ${error.message}`); }
  }
  if (homeIds.length !== Math.min(HOME_TARGET, canonical.length)) errors.push(`Home highlights divergentes: ${homeIds.length}/${Math.min(HOME_TARGET, canonical.length)}`);
  if (duplicates(homeIds).length) errors.push(`Home contém IDs duplicados: ${duplicates(homeIds).join(', ')}`);
  for (const id of homeIds) if (!canonicalSet.has(id)) errors.push(`Home referencia produto ausente: ${id}`);

  const summary = {
    source: relative(ROOT, canonicalPath),
    catalogProducts: catalogIds.length,
    mobileProducts: mobile.length,
    productPages: productFiles.length,
    offers: offerIds.length,
    homeHighlights: homeIds.length,
    dewaltPending: dewalt.length,
    duplicateIds: duplicateIds.length,
    duplicateAffiliateLinks: duplicateAffiliateLinks.length,
    missingProductPages: missingProductPages.length,
    orphanProductPages: orphanProductPages.length,
    forcedOffersOn: forcedIn.length,
    forcedOffersOff: forcedOut.length,
    errors,
  };

  return { ok: errors.length === 0, summary };
}

function runCli() {
  const result = validateCatalog(process.cwd());
  console.log(JSON.stringify(result.summary, null, 2));
  if (!result.ok) process.exitCode = 1;
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) runCli();
