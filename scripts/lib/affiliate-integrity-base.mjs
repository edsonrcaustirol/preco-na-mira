import { setTimeout as sleep } from 'node:timers/promises';

export const CLASSIFICATIONS = Object.freeze({
  CORRETO: 'CORRETO',
  PROVAVEL: 'PROVÁVEL',
  DIVERGENTE: 'DIVERGENTE',
  ANUNCIO_INDISPONIVEL: 'ANÚNCIO_INDISPONÍVEL',
  DESTINO_GENERICO: 'DESTINO_GENÉRICO',
  PROBLEMA_DE_LINK: 'PROBLEMA_DE_LINK',
  NAO_COMPROVAVEL: 'NÃO_COMPROVÁVEL',
});

const BLOCK_STATUSES = new Set([401, 403, 407, 418, 429]);
const UNAVAILABLE_STATUSES = new Set([404, 410]);
const TRANSIENT_STATUSES = new Set([408, 425, 500, 502, 503, 504]);
const STRONG_TYPES = ['voltage', 'power', 'capacity', 'size', 'quantity'];
const STOPWORDS = new Set([
  'a','as','o','os','de','da','das','do','dos','e','em','com','para','por','um','uma',
  'the','and','for','com','sem','kit','novo','nova','produto','original','mercado','livre',
]);

export function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9+,./"″-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function canonicalSpec(value) {
  return normalizeText(value).replace(/\s+/g, '');
}

export function extractStrongAttributes(text = '') {
  const normalized = normalizeText(text);
  const attributes = {
    voltage: [], power: [], capacity: [], size: [], quantity: [],
  };

  if (/\bbivolt\b/.test(normalized)) attributes.voltage.push('bivolt');
  for (const match of normalized.matchAll(/\b(100|110|115|120|127|220|230|240)\s*v\b/g)) {
    attributes.voltage.push(`${match[1]}v`);
  }
  for (const match of normalized.matchAll(/\b(\d+(?:[.,]\d+)?)\s*(kw|w)(?:\s*rms)?\b/g)) {
    const n = Number(match[1].replace(',', '.'));
    const watts = match[2] === 'kw' ? n * 1000 : n;
    attributes.power.push(`${watts}w`);
  }
  for (const match of normalized.matchAll(/\b(\d+(?:[.,]\d+)?)\s*(tb|gb|mah|ah|ml|l|litro|litros)\b/g)) {
    attributes.capacity.push(canonicalSpec(`${match[1]}${match[2]}`));
  }
  for (const match of normalized.matchAll(/\b(\d+(?:[.,]\d+)?)\s*(mm|cm|m|pol|polegada|polegadas|"|″)\b/g)) {
    attributes.size.push(canonicalSpec(`${match[1]}${match[2]}`));
  }
  for (const match of normalized.matchAll(/\b(\d+)\s*(unidade|unidades|peca|pecas)\b/g)) {
    attributes.quantity.push(`${match[1]}un`);
  }
  for (const match of normalized.matchAll(/\b(?:kit|jogo|pack|pacote)\s*(?:com|de)?\s*(\d+)\b/g)) {
    attributes.quantity.push(`${match[1]}un`);
  }

  for (const type of STRONG_TYPES) attributes[type] = unique(attributes[type]);
  return attributes;
}

export function extractModelCandidates(text = '') {
  const raw = String(text);
  const tokens = raw.match(/[A-Za-z0-9][A-Za-z0-9._/-]{2,}/g) || [];
  return unique(tokens
    .map(token => normalizeText(token).replace(/\s/g, ''))
    .filter(token => /[a-z]/.test(token) && /\d/.test(token))
    .filter(token => !/^\d+(?:[.,]\d+)?(?:w|kw|v|l|ml|gb|tb|mah|ah|cm|mm)$/.test(token))
    .filter(token => token.length >= 4));
}

function meaningfulNameTokens(product) {
  const brand = normalizeText(product.marca || '');
  return unique(normalizeText(product.nome || '')
    .split(' ')
    .filter(token => token.length >= 3)
    .filter(token => !STOPWORDS.has(token))
    .filter(token => token !== brand)
    .filter(token => !/^\d+$/.test(token)));
}

export function buildExpectedIdentity(product) {
  const source = [
    product.nome,
    product.marca,
    product.categoria,
    product.resumo,
    product.chamada,
    ...(Array.isArray(product.chips) ? product.chips : []),
  ].filter(Boolean).join(' ');

  return {
    brand: normalizeText(product.marca || ''),
    normalizedName: normalizeText(product.nome || ''),
    nameTokens: meaningfulNameTokens(product),
    models: extractModelCandidates(product.nome || ''),
    attributes: extractStrongAttributes(source),
  };
}

export function buildObservedIdentity(resolution) {
  const text = [resolution.title, resolution.description, resolution.finalUrl].filter(Boolean).join(' ');
  return {
    text: normalizeText(text),
    models: extractModelCandidates([resolution.title, resolution.description].filter(Boolean).join(' ')),
    attributes: extractStrongAttributes([resolution.title, resolution.description].filter(Boolean).join(' ')),
  };
}

function intersection(a, b) {
  const set = new Set(b);
  return a.filter(v => set.has(v));
}

function conflictsFor(expected, observed) {
  const conflicts = [];
  for (const type of STRONG_TYPES) {
    const e = expected.attributes[type] || [];
    const o = observed.attributes[type] || [];
    if (e.length && o.length && intersection(e, o).length === 0) {
      conflicts.push({ type, expected: e, observed: o });
    }
  }

  if (expected.models.length && observed.models.length && intersection(expected.models, observed.models).length === 0) {
    conflicts.push({ type: 'model', expected: expected.models, observed: observed.models });
  }
  return conflicts;
}

function matchedAttributes(expected, observed) {
  const matches = [];
  for (const type of STRONG_TYPES) {
    const values = intersection(expected.attributes[type] || [], observed.attributes[type] || []);
    if (values.length) matches.push({ type, values });
  }
  return matches;
}

function detectBlocked(resolution) {
  if (BLOCK_STATUSES.has(resolution.status)) return true;
  const text = normalizeText(`${resolution.title || ''} ${resolution.description || ''} ${resolution.bodySnippet || ''}`);
  return /captcha|access denied|acesso negado|verifique que voce e humano|nao sou um robo|robot check|security check|bloqueio de seguranca/.test(text);
}

function hasUnavailableMarker(resolution) {
  const text = normalizeText(`${resolution.title || ''} ${resolution.description || ''} ${resolution.bodySnippet || ''}`);
  return /anuncio (?:pausado|finalizado|indisponivel)|produto indisponivel|nao esta mais disponivel|publicacao pausada|publicacao finalizada/.test(text);
}

export function detectDestinationType(urlValue = '') {
  try {
    const url = new URL(urlValue);
    const host = url.hostname.toLowerCase();
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (host === 'meli.la' || host.endsWith('.meli.la')) return 'REDIRECIONADOR_MELI';
    if (host.includes('mercadolivre.com') || host.includes('mercadolibre.com')) {
      const generic = path === '/' || /^\/(?:ofertas|categorias|lista|search|login|ajuda)(?:\/|$)/i.test(path);
      return generic ? 'MERCADO_LIVRE_GENERICO' : 'MERCADO_LIVRE_PRODUTO';
    }
    return path === '/' ? 'EXTERNO_GENERICO' : 'EXTERNO';
  } catch {
    return 'DESCONHECIDO';
  }
}

export function classifyProduct(product, resolution) {
  const base = {
    destinationType: detectDestinationType(resolution.finalUrl || product.linkAfiliado),
    evidence: { expected: buildExpectedIdentity(product), observed: null, matches: {}, conflicts: [] },
  };

  if (resolution.error) {
    const hardLinkErrors = new Set(['INVALID_URL', 'REDIRECT_LOOP', 'REDIRECT_LIMIT', 'INVALID_REDIRECT']);
    if (hardLinkErrors.has(resolution.error.kind)) {
      return { ...base, classification: CLASSIFICATIONS.PROBLEMA_DE_LINK, reason: resolution.error.message || resolution.error.kind };
    }
    return { ...base, classification: CLASSIFICATIONS.NAO_COMPROVAVEL, reason: `Falha externa/ambiental: ${resolution.error.kind}` };
  }

  if (detectBlocked(resolution)) {
    return { ...base, classification: CLASSIFICATIONS.NAO_COMPROVAVEL, reason: `Destino bloqueou ou desafiou a verificação (HTTP ${resolution.status || 'n/d'}).` };
  }
  if (hasUnavailableMarker(resolution) || (UNAVAILABLE_STATUSES.has(resolution.status) && base.destinationType === 'MERCADO_LIVRE_PRODUTO')) {
    return { ...base, classification: CLASSIFICATIONS.ANUNCIO_INDISPONIVEL, reason: `Anúncio indisponível/encerrado (HTTP ${resolution.status || 'n/d'}).` };
  }
  if (UNAVAILABLE_STATUSES.has(resolution.status)) {
    return { ...base, classification: CLASSIFICATIONS.PROBLEMA_DE_LINK, reason: `Destino não encontrado (HTTP ${resolution.status}) antes de um anúncio identificável.` };
  }
  if (resolution.status >= 500) {
    return { ...base, classification: CLASSIFICATIONS.NAO_COMPROVAVEL, reason: `Falha transitória do destino (HTTP ${resolution.status}).` };
  }
  if (resolution.status >= 400) {
    return { ...base, classification: CLASSIFICATIONS.PROBLEMA_DE_LINK, reason: `Resposta HTTP ${resolution.status} sem evidência de bloqueio transitório.` };
  }
  if (base.destinationType === 'MERCADO_LIVRE_GENERICO' || base.destinationType === 'EXTERNO_GENERICO') {
    return { ...base, classification: CLASSIFICATIONS.DESTINO_GENERICO, reason: 'O redirecionamento terminou em página genérica, não em um anúncio identificável.' };
  }
  if (base.destinationType === 'EXTERNO') {
    return { ...base, classification: CLASSIFICATIONS.PROBLEMA_DE_LINK, reason: 'O link afiliado terminou fora do Mercado Livre, sem bloqueio externo identificável.' };
  }

  const expected = base.evidence.expected;
  const observed = buildObservedIdentity(resolution);
  const conflicts = conflictsFor(expected, observed);
  const attrMatches = matchedAttributes(expected, observed);
  const modelMatches = intersection(expected.models, observed.models);
  const brandMatch = Boolean(expected.brand && observed.text.includes(expected.brand));
  const tokenMatches = expected.nameTokens.filter(token => observed.text.includes(token));
  const tokenCoverage = expected.nameTokens.length ? tokenMatches.length / expected.nameTokens.length : 0;
  const exactNameMatch = Boolean(expected.normalizedName && observed.text.includes(expected.normalizedName));

  base.evidence = {
    expected,
    observed,
    matches: { brand: brandMatch, models: modelMatches, attributes: attrMatches, nameTokens: tokenMatches, nameTokenCoverage: tokenCoverage, exactName: exactNameMatch },
    conflicts,
  };

  if (conflicts.length) {
    const kinds = conflicts.map(c => c.type).join(', ');
    return { ...base, classification: CLASSIFICATIONS.DIVERGENTE, reason: `Atributo forte divergente: ${kinds}.` };
  }

  if (exactNameMatch || (modelMatches.length > 0 && (brandMatch || attrMatches.length > 0 || tokenCoverage >= 0.5))) {
    return { ...base, classification: CLASSIFICATIONS.CORRETO, reason: exactNameMatch ? 'Nome canônico identificado no destino sem divergências fortes.' : 'Modelo identificado com evidência adicional compatível e sem divergências fortes.' };
  }

  if (brandMatch && tokenMatches.length >= 2 && tokenCoverage >= 0.6) {
    return { ...base, classification: CLASSIFICATIONS.PROVAVEL, reason: 'Identidade provável por marca e múltiplos termos distintivos, sem prova forte suficiente para CORRETO.' };
  }

  return { ...base, classification: CLASSIFICATIONS.NAO_COMPROVAVEL, reason: `HTTP ${resolution.status || 'n/d'} sem evidência de identidade suficiente.` };
}

function extractMeta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return decodeBasicEntities(match[1]);
  }
  return '';
}

function decodeBasicEntities(value = '') {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractTitle(html = '') {
  const og = extractMeta(html, 'og:title');
  if (og) return og;
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeBasicEntities(match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()) : '';
}

function extractDescription(html = '') {
  return extractMeta(html, 'description') || extractMeta(html, 'og:description');
}

async function fetchOnce(url, { timeoutMs, userAgent }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'user-agent': userAgent,
        'accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
        'accept-language': 'pt-BR,pt;q=0.9',
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveAffiliateUrl(startUrl, options = {}) {
  const config = {
    timeoutMs: 12000,
    retries: 1,
    maxRedirects: 6,
    retryDelayMs: 700,
    userAgent: 'PrecoNaMira-AffiliateIntegrityAuditor/1.0',
    ...options,
  };

  let current;
  try {
    current = new URL(startUrl).toString();
  } catch {
    return { finalUrl: startUrl, redirectChain: [], status: null, error: { kind: 'INVALID_URL', message: 'URL afiliada inválida.' } };
  }

  const seen = new Set();
  const redirectChain = [];

  for (let redirects = 0; redirects <= config.maxRedirects; redirects += 1) {
    if (seen.has(current)) {
      return { finalUrl: current, redirectChain, status: null, error: { kind: 'REDIRECT_LOOP', message: 'Loop de redirects detectado.' } };
    }
    seen.add(current);

    let response;
    let lastError;
    for (let attempt = 0; attempt <= config.retries; attempt += 1) {
      try {
        response = await fetchOnce(current, config);
        if (!TRANSIENT_STATUSES.has(response.status) || attempt === config.retries) break;
      } catch (error) {
        lastError = error;
        if (attempt === config.retries) break;
      }
      await sleep(config.retryDelayMs);
    }

    if (!response) {
      const kind = lastError?.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR';
      return { finalUrl: current, redirectChain, status: null, error: { kind, message: lastError?.message || kind } };
    }

    const location = response.headers.get('location');
    redirectChain.push({ url: current, status: response.status, location });

    if (response.status >= 300 && response.status < 400 && location) {
      if (redirects === config.maxRedirects) {
        return { finalUrl: current, redirectChain, status: response.status, error: { kind: 'REDIRECT_LIMIT', message: `Limite de ${config.maxRedirects} redirects excedido.` } };
      }
      try {
        current = new URL(location, current).toString();
      } catch {
        return { finalUrl: current, redirectChain, status: response.status, error: { kind: 'INVALID_REDIRECT', message: 'Header Location inválido.' } };
      }
      continue;
    }

    let html = '';
    const contentType = response.headers.get('content-type') || '';
    if (/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      try { html = await response.text(); } catch { html = ''; }
    }

    return {
      finalUrl: current,
      redirectChain,
      status: response.status,
      title: extractTitle(html),
      description: extractDescription(html),
      bodySnippet: normalizeText(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).slice(0, 4000),
      error: null,
    };
  }

  return { finalUrl: current, redirectChain, status: null, error: { kind: 'REDIRECT_LIMIT', message: 'Limite de redirects excedido.' } };
}

export async function auditProduct(product, options = {}) {
  const resolver = options.resolver || resolveAffiliateUrl;
  const checkedAt = new Date().toISOString();
  const resolution = await resolver(product.linkAfiliado, options.network || {});
  const classified = classifyProduct(product, resolution);
  return {
    product_id: product.id,
    nome: product.nome,
    marca: product.marca,
    categoria: product.categoria,
    linkAfiliado: product.linkAfiliado,
    finalUrl: resolution.finalUrl || null,
    redirectChain: resolution.redirectChain || [],
    httpStatus: resolution.status ?? null,
    destinationType: classified.destinationType,
    evidence: classified.evidence,
    classification: classified.classification,
    reason: classified.reason,
    checkedAt,
  };
}

export async function auditProducts(products, options = {}) {
  const concurrency = Math.max(1, Number(options.concurrency || 2));
  const throttleMs = Math.max(0, Number(options.throttleMs ?? 400));
  const results = new Array(products.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= products.length) return;
      results[index] = await auditProduct(products[index], options);
      if (throttleMs) await sleep(throttleMs);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, products.length || 1) }, () => worker()));
  return results;
}

export function compareResults(previousResults = [], currentResults = []) {
  const previous = new Map(previousResults.map(item => [item.product_id, item]));
  const current = new Map(currentResults.map(item => [item.product_id, item]));
  const healthy = new Set([CLASSIFICATIONS.CORRETO, CLASSIFICATIONS.PROVAVEL]);
  const classificationChanges = [];
  const newExceptions = [];
  const resolvedExceptions = [];

  for (const [id, item] of current) {
    const before = previous.get(id);
    if (!before) {
      if (!healthy.has(item.classification)) newExceptions.push({ product_id: id, from: null, to: item.classification });
      continue;
    }
    if (before.classification !== item.classification) {
      classificationChanges.push({ product_id: id, from: before.classification, to: item.classification });
      if (healthy.has(before.classification) && !healthy.has(item.classification)) newExceptions.push({ product_id: id, from: before.classification, to: item.classification });
      if (!healthy.has(before.classification) && healthy.has(item.classification)) resolvedExceptions.push({ product_id: id, from: before.classification, to: item.classification });
    }
  }

  return {
    newProducts: [...current.keys()].filter(id => !previous.has(id)),
    missingProducts: [...previous.keys()].filter(id => !current.has(id)),
    classificationChanges,
    newExceptions,
    resolvedExceptions,
  };
}

export function summarize(results) {
  const summary = {
    TOTAL: results.length,
    CORRETOS: 0,
    PROVAVEIS: 0,
    DIVERGENTES: 0,
    INDISPONIVEIS: 0,
    DESTINO_GENERICO: 0,
    PROBLEMAS_DE_LINK: 0,
    NAO_COMPROVAVEIS: 0,
  };
  for (const item of results) {
    if (item.classification === CLASSIFICATIONS.CORRETO) summary.CORRETOS += 1;
    else if (item.classification === CLASSIFICATIONS.PROVAVEL) summary.PROVAVEIS += 1;
    else if (item.classification === CLASSIFICATIONS.DIVERGENTE) summary.DIVERGENTES += 1;
    else if (item.classification === CLASSIFICATIONS.ANUNCIO_INDISPONIVEL) summary.INDISPONIVEIS += 1;
    else if (item.classification === CLASSIFICATIONS.DESTINO_GENERICO) summary.DESTINO_GENERICO += 1;
    else if (item.classification === CLASSIFICATIONS.PROBLEMA_DE_LINK) summary.PROBLEMAS_DE_LINK += 1;
    else if (item.classification === CLASSIFICATIONS.NAO_COMPROVAVEL) summary.NAO_COMPROVAVEIS += 1;
  }
  summary.SAUDAVEIS = summary.CORRETOS + summary.PROVAVEIS;
  summary.PRECISAM_ATENCAO = summary.DIVERGENTES + summary.INDISPONIVEIS + summary.DESTINO_GENERICO + summary.PROBLEMAS_DE_LINK;
  return summary;
}
