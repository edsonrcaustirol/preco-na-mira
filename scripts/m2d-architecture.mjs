#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildInventory, parseArrayFile } from './seo-inventory.mjs';

const ORIGIN = 'https://preconamira.com.br';
const ROOT = process.cwd();

function decodeHtml(value = '') {
  return String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ').replace(/&ndash;/gi, '–').replace(/&mdash;/gi, '—')
    .replace(/\s+/g, ' ').trim();
}

function stripTags(value = '') {
  return decodeHtml(String(value).replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '));
}

function attrs(markup = '') {
  const result = {};
  const re = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = re.exec(markup))) result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  return result;
}

export function slugify(value = '') {
  return String(value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function normalizeInternalRoute(value) {
  if (!value) return null;
  let input = String(value).trim();
  if (!input || input.startsWith('#') || /^(?:mailto:|tel:|javascript:|data:)/i.test(input)) return null;
  try {
    if (/^https?:\/\//i.test(input)) {
      const url = new URL(input);
      if (url.origin !== ORIGIN) return null;
      input = `${url.pathname}${url.search}`;
    }
  } catch { return null; }
  input = input.split('#')[0].split('?')[0];
  if (!input) input = '/';
  if (!input.startsWith('/')) input = `/${input}`;
  input = input.replace(/\/index\.html$/i, '/').replace(/\.html$/i, '');
  if (input.length > 1) input = input.replace(/\/+$/, '');
  return input;
}

export function computeDepth(adjacency, sources) {
  const depth = new Map();
  const queue = [];
  for (const source of sources) {
    if (!adjacency.has(source) || depth.has(source)) continue;
    depth.set(source, 0);
    queue.push(source);
  }
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const source = queue[cursor];
    const nextDepth = depth.get(source) + 1;
    for (const target of adjacency.get(source) || []) {
      if (!adjacency.has(target) || depth.has(target)) continue;
      depth.set(target, nextDepth);
      queue.push(target);
    }
  }
  return depth;
}

export function inspectAnchors(html, sourceRoute, knownRoutes) {
  const broken = [];
  const selfLinks = [];
  const emptyAnchors = [];
  const wrongHostLinks = [];
  const queryInternalLinks = [];

  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const values = attrs(match[1]);
    const href = String(values.href || '').trim();
    if (!href) continue;

    if (/^https?:\/\//i.test(href)) {
      try {
        const url = new URL(href);
        if (/(?:^|\.)preconamira\.com\.br$/i.test(url.hostname) && url.origin !== ORIGIN) wrongHostLinks.push(href);
      } catch { /* ignored */ }
    }

    let parsed;
    try { parsed = new URL(href, ORIGIN); } catch { parsed = null; }
    if (parsed?.origin === ORIGIN && parsed.search) queryInternalLinks.push(href);

    const route = normalizeInternalRoute(href);
    if (!route) continue;
    if (!knownRoutes.has(route)) broken.push({ href, route });
    if (route === sourceRoute) selfLinks.push(href);

    const visible = stripTags(match[2]);
    const aria = String(values['aria-label'] || '').trim();
    const imageAlt = [...match[2].matchAll(/<img\b([^>]*)>/gi)].map(item => attrs(item[1]).alt || '').join(' ').trim();
    if (!visible && !aria && !imageAlt) emptyAnchors.push(href);
  }

  return {
    broken: [...new Map(broken.map(item => [`${item.href}|${item.route}`, item])).values()],
    selfLinks: [...new Set(selfLinks)],
    emptyAnchors: [...new Set(emptyAnchors)],
    wrongHostLinks: [...new Set(wrongHostLinks)],
    queryInternalLinks: [...new Set(queryInternalLinks)],
  };
}

function counts(values) {
  const result = {};
  for (const value of values.filter(Boolean)) result[value] = (result[value] || 0) + 1;
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b, 'pt-BR')));
}

function productIdsFromPage(page, byRoute) {
  return page.outboundInternalLinks
    .map(route => byRoute.get(route))
    .filter(target => target?.type === 'PRODUTO' && target.productId)
    .map(target => target.productId);
}

function pageEvidence(page) {
  return {
    url: page.path,
    file: page.file,
    type: page.type,
    indexable: page.indexable,
    inSitemap: page.inSitemap,
    canonical: page.canonical,
    inbound: page.inboundInternalLinks,
    outbound: page.outboundInternalLinks.length,
    h1: page.h1,
    title: page.title,
    description: page.metaDescription,
  };
}

export function analyzeArchitecture(rootDir = ROOT) {
  const root = path.resolve(rootDir);
  const inventory = buildInventory(root);
  const pages = inventory.pages;
  const byRoute = new Map(pages.map(page => [page.path, page]));
  const knownRoutes = new Set(byRoute.keys());
  const owner = parseArrayFile(path.join(root, 'data', 'produtos-index.js'));
  const ownerById = new Map(owner.map(product => [String(product.id), product]));
  const ownerCategories = [...new Set(owner.map(product => String(product.categoria || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const ownerCategoryCounts = counts(owner.map(product => String(product.categoria || '').trim()));
  const categoryPages = pages.filter(page => page.type === 'CATEGORIA');
  const journeyPages = pages.filter(page => page.type === 'PROJETOS/JORNADAS');
  const productPages = pages.filter(page => page.type === 'PRODUTO');

  const categoryRouteByOwner = new Map();
  for (const category of ownerCategories) {
    const route = `/${slugify(category)}`;
    if (byRoute.get(route)?.type === 'CATEGORIA') categoryRouteByOwner.set(category, route);
  }

  const categories = categoryPages.map(page => {
    const ids = productIdsFromPage(page, byRoute);
    const linkedProducts = ids.map(id => ownerById.get(id)).filter(Boolean);
    const linkedCategories = counts(linkedProducts.map(product => String(product.categoria || '').trim()));
    const directOwnerCategories = ownerCategories.filter(category => `/${slugify(category)}` === page.path);
    const directOwnerCategory = directOwnerCategories.length === 1 ? directOwnerCategories[0] : null;
    return {
      ...pageEvidence(page),
      ownerCategory: directOwnerCategory,
      ownerMembership: directOwnerCategory ? ownerCategoryCounts[directOwnerCategory] || 0 : null,
      ownerMembershipSource: directOwnerCategory ? 'data/produtos-index.js:categoria + slug exato' : null,
      linkedProducts: ids.length,
      linkedOwnerCategories: linkedCategories,
      statusEvidence: page.indexable ? 'INDEXÁVEL' : 'NÃO_INDEXÁVEL',
    };
  });

  const journeys = journeyPages.map(page => {
    const ids = productIdsFromPage(page, byRoute);
    const linkedProducts = ids.map(id => ownerById.get(id)).filter(Boolean);
    return {
      ...pageEvidence(page),
      linkedProducts: ids.length,
      linkedOwnerCategories: counts(linkedProducts.map(product => String(product.categoria || '').trim())),
      statusEvidence: page.indexable ? 'INDEXÁVEL' : 'NÃO_INDEXÁVEL',
    };
  });

  const orphanCandidates = inventory.orphanCandidates.map(route => {
    const page = byRoute.get(route);
    return page ? { ...pageEvidence(page), outboundTargets: page.outboundInternalLinks } : { url: route, missingFromInventory: true };
  });

  const adjacency = new Map(pages.map(page => [page.path, page.outboundInternalLinks.filter(route => knownRoutes.has(route))]));
  const depthFromHome = computeDepth(adjacency, ['/']);
  const hubRoutes = ['/', '/catalogo', '/ofertas', ...categoryPages.map(page => page.path), ...journeyPages.map(page => page.path)].filter(route => knownRoutes.has(route));
  const depthFromHubs = computeDepth(adjacency, hubRoutes);
  const depthRows = pages.filter(page => page.indexable).map(page => ({
    url: page.path,
    type: page.type,
    fromHome: depthFromHome.has(page.path) ? depthFromHome.get(page.path) : null,
    fromHub: depthFromHubs.has(page.path) ? depthFromHubs.get(page.path) : null,
    inbound: page.inboundInternalLinks,
  }));
  const finiteHomeDepths = depthRows.map(row => row.fromHome).filter(value => Number.isInteger(value));
  const finiteHubDepths = depthRows.map(row => row.fromHub).filter(value => Number.isInteger(value));

  const linkDiagnostics = [];
  for (const page of pages) {
    const html = fs.readFileSync(path.join(root, page.file), 'utf8');
    const diagnosis = inspectAnchors(html, page.path, knownRoutes);
    if (diagnosis.broken.length || diagnosis.selfLinks.length || diagnosis.emptyAnchors.length || diagnosis.wrongHostLinks.length || diagnosis.queryInternalLinks.length) {
      linkDiagnostics.push({ url: page.path, type: page.type, ...diagnosis });
    }
  }
  const brokenLinks = linkDiagnostics.flatMap(row => row.broken.map(item => ({ source: row.url, ...item })));
  const selfLinks = linkDiagnostics.flatMap(row => row.selfLinks.map(href => ({ source: row.url, href })));
  const emptyAnchors = linkDiagnostics.flatMap(row => row.emptyAnchors.map(href => ({ source: row.url, href })));
  const wrongHostLinks = linkDiagnostics.flatMap(row => row.wrongHostLinks.map(href => ({ source: row.url, href })));
  const queryInternalLinks = linkDiagnostics.flatMap(row => row.queryInternalLinks.map(href => ({ source: row.url, href })));

  const m2cMarker = /class=(?:"[^"]*\brelated-block\b|"[^"]*\brelated-grid\b|'[^']*\brelated-block\b|'[^']*\brelated-grid\b)/i;
  const relatedRows = productPages.map(page => {
    const html = fs.readFileSync(path.join(root, page.file), 'utf8');
    return {
      url: page.path,
      file: page.file,
      m2cMarker: m2cMarker.test(html),
      relatedActions: (html.match(/\bclass=(?:"[^"]*\brelated-actions\b[^"]*"|'[^']*\brelated-actions\b[^']*')/gi) || []).length,
      mercadoLivreCtas: (html.match(/VER\s+NO\s+MERCADO\s+LIVRE/gi) || []).length,
    };
  });
  const m2cMissing = relatedRows.filter(row => !row.m2cMarker);

  const productCategoryRows = productPages.map(page => {
    const product = ownerById.get(page.productId);
    const category = String(product?.categoria || '').trim();
    const categoryRoute = categoryRouteByOwner.get(category) || null;
    return {
      productId: page.productId,
      url: page.path,
      category,
      categoryRoute,
      eligible: Boolean(categoryRoute),
      linked: Boolean(categoryRoute && page.outboundInternalLinks.includes(categoryRoute)),
    };
  });
  const eligibleProductCategory = productCategoryRows.filter(row => row.eligible);
  const linkedProductCategory = eligibleProductCategory.filter(row => row.linked);

  const categoryMembershipViolations = [];
  for (const category of categories.filter(row => row.ownerCategory)) {
    const page = byRoute.get(category.url);
    for (const id of productIdsFromPage(page, byRoute)) {
      const product = ownerById.get(id);
      if (String(product?.categoria || '').trim() !== category.ownerCategory) {
        categoryMembershipViolations.push({ category: category.url, expected: category.ownerCategory, productId: id, actual: product?.categoria || '' });
      }
    }
  }

  const catalogPages = pages.filter(page => page.type === 'CATÁLOGO');
  const catalogQueryLinks = queryInternalLinks.filter(item => catalogPages.some(page => page.path === item.source));
  const sitemapText = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  const sitemapUrls = [...sitemapText.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => decodeHtml(match[1]));
  const sitemapHasParameters = sitemapUrls.some(url => {
    try { return Boolean(new URL(url).search); } catch { return false; }
  });

  return {
    contract: 'pnm.m2d-architecture/v1',
    source: 'pnm.seo-inventory/v1 + HTML estático + data/produtos-index.js',
    owner: 'data/produtos-index.js',
    summary: {
      totalUrls: inventory.summary.totalUrls,
      indexable: inventory.summary.indexable,
      urlsByType: inventory.summary.urlsByType,
      orphanCandidates: inventory.summary.orphanCandidates,
      p0: inventory.summary.priorities.P0,
      p1: inventory.summary.priorities.P1,
      p2: inventory.summary.priorities.P2,
      p3: inventory.summary.priorities.P3,
      categories: categoryPages.length,
      journeys: journeyPages.length,
      products: productPages.length,
      ownerProducts: owner.length,
    },
    orphanCandidates,
    related: {
      productPages: productPages.length,
      m2cMarkerPages: relatedRows.filter(row => row.m2cMarker).length,
      missingM2cMarkerPages: m2cMissing,
      semanticNote: 'M2C relatedPages conta páginas que possuem classe related-block/related-grid; não é contagem de páginas de produto nem do total de CTAs do auditor oficial M3.2.',
    },
    ownerCategories: ownerCategoryCounts,
    categories,
    journeys,
    intentions: {
      evidenceSources: ['categoria do owner', 'landings de categoria existentes', 'jornadas/projetos existentes', 'links internos existentes'],
      newIntentLandingsCreated: 0,
      decision: 'Nenhuma intenção nova é inferida automaticamente por este auditor.',
    },
    graph: {
      hubs: hubRoutes,
      indexableWithoutInbound: depthRows.filter(row => row.inbound === 0 && row.url !== '/').map(row => row.url),
      unreachableFromHome: depthRows.filter(row => row.fromHome === null).map(row => row.url),
      unreachableFromAnyHub: depthRows.filter(row => row.fromHub === null).map(row => row.url),
      maxDepthFromHome: finiteHomeDepths.length ? Math.max(...finiteHomeDepths) : null,
      maxDepthFromHubs: finiteHubDepths.length ? Math.max(...finiteHubDepths) : null,
      rows: depthRows,
    },
    internalLinking: {
      productToCategory: {
        eligible: eligibleProductCategory.length,
        linked: linkedProductCategory.length,
        missing: eligibleProductCategory.filter(row => !row.linked),
        ineligibleNoLanding: productCategoryRows.filter(row => !row.eligible).map(row => ({ productId: row.productId, category: row.category })),
      },
      categoryToProduct: {
        membershipViolations: categoryMembershipViolations,
      },
      journeyToProduct: journeys.map(row => ({ journey: row.url, linkedProducts: row.linkedProducts, linkedOwnerCategories: row.linkedOwnerCategories })),
      productToJourney: {
        measuredOnly: true,
        note: 'Nenhum backlink é criado sem associação objetiva versionada.',
      },
      brokenLinks,
      selfLinks,
      emptyAnchors,
      wrongHostLinks,
    },
    facetedNavigation: {
      catalogInternalQueryLinks: catalogQueryLinks,
      sitemapHasParameters,
      risk: catalogQueryLinks.length ? 'REVISAR' : 'SEM_EVIDÊNCIA_DE_EXPLOSÃO_POR_LINKS_HTML',
    },
    guardrailCandidates: {
      brokenInternalLinks: brokenLinks.length,
      wrongHostInternalLinks: wrongHostLinks.length,
      emptyInternalAnchors: emptyAnchors.length,
      categoryMembershipViolations: categoryMembershipViolations.length,
      orphanCandidates: orphanCandidates.length,
    },
  };
}

function runCli() {
  const report = analyzeArchitecture(process.cwd());
  const outputDir = path.join(process.cwd(), '.audit');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'm2d-architecture.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    contract: report.contract,
    owner: report.owner,
    summary: report.summary,
    orphanCandidates: report.orphanCandidates,
    related: report.related,
    ownerCategories: report.ownerCategories,
    categories: report.categories,
    journeys: report.journeys,
    graph: {
      hubs: report.graph.hubs,
      indexableWithoutInbound: report.graph.indexableWithoutInbound,
      unreachableFromHome: report.graph.unreachableFromHome,
      unreachableFromAnyHub: report.graph.unreachableFromAnyHub,
      maxDepthFromHome: report.graph.maxDepthFromHome,
      maxDepthFromHubs: report.graph.maxDepthFromHubs,
    },
    productToCategory: {
      eligible: report.internalLinking.productToCategory.eligible,
      linked: report.internalLinking.productToCategory.linked,
      missingCount: report.internalLinking.productToCategory.missing.length,
      ineligibleNoLandingCount: report.internalLinking.productToCategory.ineligibleNoLanding.length,
    },
    guardrailCandidates: report.guardrailCandidates,
    facetedNavigation: report.facetedNavigation,
    output: '.audit/m2d-architecture.json',
  }, null, 2));
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) runCli();
