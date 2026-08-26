export const CENTRAL_NEW_PRODUCT_CONTRACT = 'pnm.central-new-product-preparation/v1';
export const CENTRAL_NEW_PRODUCT_BATCH_CONTRACT = 'pnm.central-new-product-batch/v1';
export const NEW_PRODUCT_PROVENANCE = Object.freeze({ AUTOMATIC: 'AUTOMÁTICO', SUGGESTED: 'SUGERIDO', HUMAN: 'HUMANO', BLOCKING: 'BLOQUEANTE' });
export const NEW_PRODUCT_REQUIRED_FIELDS = Object.freeze(['id', 'nome', 'marca', 'categoria', 'imagem', 'imagemAlt', 'linkAfiliado', 'loja', 'resumo']);

export function analyzeNewProductInput(input = {}, products = []) {
  const P = { AUTOMATIC: 'AUTOMÁTICO', SUGGESTED: 'SUGERIDO', HUMAN: 'HUMANO', BLOCKING: 'BLOQUEANTE' };
  const text = value => String(value ?? '').trim();
  const slug = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 96);
  const parseMercadoLivreUrl = raw => {
    const original = text(raw);
    if (!original) return { ok: false, original, code: 'LINK_REQUIRED', normalized: null, comparisonKey: null, host: null };
    let url;
    try { url = new URL(original); } catch { return { ok: false, original, code: 'INVALID_URL', normalized: null, comparisonKey: null, host: null }; }
    const protocol = url.protocol.toLowerCase();
    const host = url.hostname.toLowerCase();
    const allowedHost = host === 'meli.la' || host === 'mercadolivre.com.br' || host.endsWith('.mercadolivre.com.br');
    if (!['http:', 'https:'].includes(protocol) || !allowedHost || url.username || url.password || url.port) {
      return { ok: false, original, code: 'UNSUPPORTED_MERCADO_LIVRE_URL', normalized: null, comparisonKey: null, host };
    }
    url.protocol = protocol;
    url.hostname = host;
    const normalized = url.href;
    const identityUrl = new URL(normalized);
    identityUrl.hash = '';
    for (const key of [...identityUrl.searchParams.keys()]) {
      const normalizedKey = key.toLowerCase();
      if (normalizedKey.startsWith('utm_') || [
        'tracking', 'tracking_id', 'matt_tool', 'matt_word', 'matt_source', 'matt_campaign',
        'matt_adgroup', 'matt_match_type', 'matt_network', 'matt_device', 'matt_creative',
        'matt_keyword', 'matt_adposition',
      ].includes(normalizedKey)) identityUrl.searchParams.delete(key);
    }
    identityUrl.searchParams.sort();
    return {
      ok: true,
      original,
      code: null,
      normalized,
      comparisonKey: identityUrl.href,
      host,
      shortUrl: host === 'meli.la',
    };
  };

  const catalog = Array.isArray(products) ? products : [];
  const link = parseMercadoLivreUrl(input.linkAfiliado ?? input.link ?? '');
  const existingByLink = link.ok ? catalog.find(product => parseMercadoLivreUrl(product?.linkAfiliado).comparisonKey === link.comparisonKey) || null : null;
  const suppliedId = text(input.id);
  const suggestedId = suppliedId || slug(input.nome);
  const idCollision = suppliedId ? catalog.find(product => text(product?.id) === suppliedId) || null : null;
  const errors = [];
  const warnings = [];
  const pending = [];
  const blocking = [];

  if (!link.ok) {
    errors.push({ field: 'linkAfiliado', code: link.code, message: link.code === 'LINK_REQUIRED' ? 'Cole um link do Mercado Livre.' : 'Link inválido ou fora dos hosts Mercado Livre permitidos.' });
    blocking.push({ field: 'linkAfiliado', provenance: P.BLOCKING, message: 'Link válido do Mercado Livre é obrigatório.' });
  } else if (link.normalized.startsWith('http://')) {
    warnings.push({ field: 'linkAfiliado', code: 'HTTP_LINK', message: 'Link HTTP preservado sem alteração automática; revise antes de futura publicação.' });
  }
  if (existingByLink) blocking.push({ field: 'linkAfiliado', provenance: P.BLOCKING, code: 'DUPLICATE_LINK', message: `Link já pertence a ${text(existingByLink.nome) || text(existingByLink.id)}.`, existingProduct: { id: text(existingByLink.id), nome: text(existingByLink.nome) } });
  if (idCollision) blocking.push({ field: 'id', provenance: P.BLOCKING, code: 'DUPLICATE_ID', message: `ID já pertence a ${text(idCollision.nome) || text(idCollision.id)}.`, existingProduct: { id: text(idCollision.id), nome: text(idCollision.nome) } });

  const values = {
    id: suppliedId || suggestedId,
    nome: text(input.nome),
    marca: text(input.marca),
    categoria: text(input.categoria),
    imagem: text(input.imagem),
    imagemAlt: text(input.imagemAlt),
    linkAfiliado: link.ok ? link.normalized : text(input.linkAfiliado ?? input.link),
    loja: link.ok ? 'Mercado Livre' : '',
    resumo: text(input.resumo),
    selo: text(input.selo),
    oferta: input.oferta === true,
    destaque: input.destaque === true,
  };

  for (const field of ['nome', 'marca', 'categoria', 'imagem', 'imagemAlt', 'resumo']) {
    if (!values[field]) pending.push({ field, provenance: P.HUMAN, message: `${field} depende de preenchimento/revisão humana.` });
  }
  if (!values.id) {
    pending.push({ field: 'id', provenance: P.HUMAN, message: 'ID depende de preenchimento humano.' });
  } else if (!suppliedId) {
    pending.push({ field: 'id', provenance: P.SUGGESTED, code: 'CONFIRM_SUGGESTED_ID', message: 'ID sugerido exige confirmação humana antes de avançar.' });
  }

  const fields = {
    linkAfiliado: { value: values.linkAfiliado, provenance: link.ok ? P.AUTOMATIC : P.BLOCKING, note: link.ok ? 'Normalizado estruturalmente sem remover query/hash/tracking do valor publicado.' : 'Link ainda inválido.' },
    loja: { value: values.loja, provenance: link.ok ? P.AUTOMATIC : P.BLOCKING, note: link.ok ? 'Derivado do host Mercado Livre validado.' : 'Pendente de link válido.' },
    id: { value: values.id, provenance: suppliedId ? P.HUMAN : suggestedId ? P.SUGGESTED : P.HUMAN, note: suppliedId ? 'Informado pelo operador.' : suggestedId ? 'Sugestão derivada do nome; requer confirmação humana.' : 'Pendente.' },
    nome: { value: values.nome, provenance: P.HUMAN },
    marca: { value: values.marca, provenance: P.HUMAN },
    categoria: { value: values.categoria, provenance: P.HUMAN },
    imagem: { value: values.imagem, provenance: P.HUMAN },
    imagemAlt: { value: values.imagemAlt, provenance: P.HUMAN },
    resumo: { value: values.resumo, provenance: P.HUMAN },
    selo: { value: values.selo, provenance: P.HUMAN },
    oferta: { value: values.oferta, provenance: P.HUMAN },
    destaque: { value: values.destaque, provenance: P.HUMAN },
  };

  const previewRecord = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== '' && value !== undefined));
  const requiredFields = ['id', 'nome', 'marca', 'categoria', 'imagem', 'imagemAlt', 'linkAfiliado', 'loja', 'resumo'];
  for (const field of requiredFields) {
    if (!text(values[field]) && !pending.some(item => item.field === field)) {
      pending.push({ field, provenance: P.HUMAN, message: `${field} é obrigatório para futura validação E2.` });
    }
  }

  const duplicateObjective = Boolean(existingByLink || idCollision);
  let state = 'PRONTO';
  let why = 'Dados preparatórios completos e sem conflito objetivo; ainda não publicado.';
  if (duplicateObjective) {
    state = 'DUPLICADO';
    why = 'Conflito objetivo com produto existente no owner.';
  } else if (blocking.length || errors.length) {
    state = 'BLOQUEADO';
    why = blocking[0]?.message || errors[0]?.message || 'Há bloqueio objetivo.';
  } else if (pending.length) {
    state = 'REVISÃO';
    why = `${pending.length} campo(s) exigem preenchimento ou confirmação humana.`;
  }

  return {
    contract: 'pnm.central-new-product-preparation/v1',
    state,
    canAdvance: state === 'PRONTO',
    canAdvanceText: state === 'PRONTO' ? 'SIM' : 'NÃO',
    why,
    publicationState: 'NÃO PUBLICADO',
    link,
    duplicate: existingByLink ? { objective: true, product: { id: text(existingByLink.id), nome: text(existingByLink.nome) } } : { objective: false, product: null },
    idCollision: idCollision ? { objective: true, product: { id: text(idCollision.id), nome: text(idCollision.nome) } } : { objective: false, product: null },
    fields,
    errors,
    warnings,
    pending,
    blocking,
    previewRecord,
    conceptualDiff: { operation: '+ novo registro', record: previewRecord, applicablePatch: false },
    l11: { contract: 'pnm.affiliate-integrity/v1', browserDispatch: false, message: 'Validação completa continua sob autoridade do L1.1; esta análise não publica.' },
    publicationEnabled: false,
    publicationMessage: 'Análise e preview não publicam nem alteram o owner.',
  };
}

export function analyzeNewProductBatch(input = '', products = []) {
  const P = { BLOCKING: 'BLOQUEANTE' };
  const text = value => String(value ?? '').trim();
  const entries = Array.isArray(input)
    ? input.map(value => typeof value === 'string' ? { linkAfiliado: value } : { ...(value || {}) })
    : text(input)
      ? String(input).split(/\r?\n/).map(value => value.trim()).filter(Boolean).map(linkAfiliado => ({ linkAfiliado }))
      : [];

  const errors = [];
  if (!entries.length) errors.push({ code: 'BATCH_EMPTY', message: 'Cole pelo menos um link para analisar o lote.' });

  const seenLinks = new Map();
  const seenIds = new Map();
  const items = entries.map((entry, index) => {
    let result = analyzeNewProductInput(entry, products);
    const conflicts = [];
    const linkKey = result.link?.ok ? result.link.comparisonKey : null;
    const suppliedId = text(entry.id);

    if (linkKey) {
      if (seenLinks.has(linkKey)) {
        conflicts.push({ type: 'LINK', firstLine: seenLinks.get(linkKey), currentLine: index + 1 });
      } else {
        seenLinks.set(linkKey, index + 1);
      }
    }
    if (suppliedId) {
      if (seenIds.has(suppliedId)) {
        conflicts.push({ type: 'ID', firstLine: seenIds.get(suppliedId), currentLine: index + 1 });
      } else {
        seenIds.set(suppliedId, index + 1);
      }
    }

    if (conflicts.length) {
      const message = `Duplicado dentro do lote; conflita com a linha ${conflicts[0].firstLine}.`;
      result = {
        ...result,
        state: 'DUPLICADO',
        canAdvance: false,
        canAdvanceText: 'NÃO',
        why: message,
        batchDuplicate: { objective: true, conflicts },
        blocking: [...result.blocking, { field: conflicts[0].type === 'ID' ? 'id' : 'linkAfiliado', provenance: P.BLOCKING, code: 'DUPLICATE_IN_BATCH', message }],
      };
    } else {
      result = { ...result, batchDuplicate: { objective: false, conflicts: [] } };
    }

    return {
      line: index + 1,
      input: entry,
      state: result.state,
      canAdvance: result.canAdvanceText,
      why: result.why,
      result,
    };
  });

  const summary = {
    total: items.length,
    prontos: items.filter(item => item.state === 'PRONTO').length,
    revisao: items.filter(item => item.state === 'REVISÃO').length,
    bloqueados: items.filter(item => item.state === 'BLOQUEADO').length,
    duplicados: items.filter(item => item.state === 'DUPLICADO').length,
  };
  const canAdvance = items.length > 0 && items.every(item => item.state === 'PRONTO');
  const state = errors.length ? 'BLOQUEADO' : canAdvance ? 'PRONTO' : 'REVISÃO';

  return {
    contract: 'pnm.central-new-product-batch/v1',
    state,
    canAdvance,
    canAdvanceText: canAdvance ? 'SIM' : 'NÃO',
    why: errors[0]?.message || (canAdvance ? 'Todos os itens estão prontos para a próxima etapa preparatória.' : 'O lote contém itens que exigem revisão, bloqueio ou tratamento de duplicidade.'),
    errors,
    items,
    summary,
    preview: items.map(item => ({ line: item.line, state: item.state, record: item.result.previewRecord })),
    conceptualDiff: {
      operation: '+ lote de novos registros',
      records: items.map(item => ({ line: item.line, state: item.state, record: item.result.previewRecord })),
      applicablePatch: false,
    },
    publicationEnabled: false,
    publicationMessage: 'ANÁLISE != PUBLICAÇÃO. Nenhum item é publicado automaticamente.',
  };
}
