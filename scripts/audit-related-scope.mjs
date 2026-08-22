import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXACT_CTA = 'VER OFERTA ↗';
const RELATED_CLASS = 'related-actions';
const ACTION_TAGS = new Set(['a', 'button']);
const RAW_TEXT_TAGS = new Set(['script', 'style', 'textarea', 'title']);
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

function findTagEnd(html, start) {
  let quote = null;
  for (let i = start + 1; i < html.length; i += 1) {
    const ch = html[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '>') {
      return i;
    }
  }
  return -1;
}

function classTokens(raw) {
  const match = raw.match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
  if (!match) return new Set();
  return new Set((match[1] ?? match[2] ?? match[3] ?? '').split(/\s+/).filter(Boolean));
}

function scanDocument(html) {
  const tokens = [];
  const textSegments = [];
  const errors = [];
  let cursor = 0;

  while (cursor < html.length) {
    const start = html.indexOf('<', cursor);
    if (start < 0) {
      if (cursor < html.length) textSegments.push({ start: cursor, end: html.length, text: html.slice(cursor) });
      break;
    }

    if (start > cursor) textSegments.push({ start: cursor, end: start, text: html.slice(cursor, start) });

    if (html.startsWith('<!--', start)) {
      const end = html.indexOf('-->', start + 4);
      if (end < 0) {
        errors.push(`comentário HTML sem fechamento em ${start}`);
        break;
      }
      cursor = end + 3;
      continue;
    }

    const end = findTagEnd(html, start);
    if (end < 0) {
      errors.push(`tag HTML sem fechamento em ${start}`);
      break;
    }

    const raw = html.slice(start, end + 1);
    const match = raw.match(/^<\s*(\/?)\s*([A-Za-z][\w:-]*)\b/);
    if (!match) {
      cursor = end + 1;
      continue;
    }

    const closing = Boolean(match[1]);
    const name = match[2].toLowerCase();
    const selfClosing = !closing && (/\/\s*>$/.test(raw) || VOID_TAGS.has(name));
    const classes = closing ? new Set() : classTokens(raw);

    if (!closing && /\bclass\s*=/.test(raw) && raw.includes(RELATED_CLASS) && !classes.has(RELATED_CLASS)) {
      errors.push(`classe ${RELATED_CLASS} não pôde ser reconhecida estruturalmente em ${start}`);
    }

    tokens.push({ start, end: end + 1, name, closing, selfClosing, classes });
    cursor = end + 1;

    if (!closing && !selfClosing && RAW_TEXT_TAGS.has(name)) {
      const re = new RegExp(`<\\/\\s*${name}\\s*>`, 'ig');
      re.lastIndex = cursor;
      const rawClose = re.exec(html);
      if (!rawClose) {
        errors.push(`<${name}> sem fechamento em ${start}`);
        break;
      }
      tokens.push({
        start: rawClose.index,
        end: rawClose.index + rawClose[0].length,
        name,
        closing: true,
        selfClosing: false,
        classes: new Set(),
      });
      cursor = rawClose.index + rawClose[0].length;
    }
  }

  return { tokens, textSegments, errors };
}

function isRelevantOpen(token) {
  return ACTION_TAGS.has(token.name) || token.classes.has(RELATED_CLASS);
}

function buildIntervals(tokens) {
  const stack = [];
  const intervals = [];
  const errors = [];

  for (const token of tokens) {
    if (!token.closing && !token.selfClosing) {
      if (ACTION_TAGS.has(token.name) && stack.some((open) => ACTION_TAGS.has(open.name))) {
        errors.push(`<${token.name}> aninhado em outra ação em ${token.start}`);
      }
      stack.push(token);
      continue;
    }
    if (!token.closing) continue;

    let matchIndex = -1;
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      if (stack[i].name === token.name) {
        matchIndex = i;
        break;
      }
    }

    if (matchIndex < 0) {
      if (ACTION_TAGS.has(token.name)) errors.push(`</${token.name}> sem abertura em ${token.start}`);
      continue;
    }

    const open = stack[matchIndex];
    const crossed = stack.slice(matchIndex + 1);
    if (crossed.length > 0 && (isRelevantOpen(open) || crossed.some(isRelevantOpen))) {
      const crossedNames = crossed.map((item) => `<${item.name}>`).join(', ');
      errors.push(`nesting relevante cruzado: <${open.name}> em ${open.start} fecha sobre ${crossedNames} em ${token.start}`);
    }

    intervals.push({ open, close: token });
    stack.splice(matchIndex, 1);
  }

  for (const open of stack) {
    if (isRelevantOpen(open)) {
      errors.push(`<${open.name}> relevante sem fechamento em ${open.start}`);
    }
  }

  return { intervals, errors };
}

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&nearr;/gi, '↗')
    .replace(/&#0*8599;/gi, '↗')
    .replace(/&#x0*2197;/gi, '↗');
}

function textSegmentsInside(textSegments, interval) {
  return textSegments.filter((segment) => interval.open.end <= segment.start && segment.end <= interval.close.start);
}

function actionLabel(textSegments, interval) {
  const text = textSegmentsInside(textSegments, interval).map((segment) => segment.text).join(' ');
  return decodeEntities(text).replace(/\s+/g, ' ').trim();
}

function inside(container, interval) {
  return container.open.end <= interval.open.start && interval.close.end <= container.close.end;
}

export function classifyHtml(html) {
  const scanned = scanDocument(html);
  const built = buildIntervals(scanned.tokens);
  const ambiguities = [...scanned.errors, ...built.errors];
  const relatedIntervals = built.intervals.filter((item) => item.open.classes.has(RELATED_CLASS));
  const actionIntervals = built.intervals.filter((item) => ACTION_TAGS.has(item.open.name));

  const candidateStarts = new Set();
  for (const action of actionIntervals) {
    for (const segment of textSegmentsInside(scanned.textSegments, action)) {
      for (let offset = segment.text.indexOf(EXACT_CTA); offset >= 0; offset = segment.text.indexOf(EXACT_CTA, offset + EXACT_CTA.length)) {
        candidateStarts.add(segment.start + offset);
      }
    }
  }

  const exactOccurrences = [];
  for (const start of [...candidateStarts].sort((a, b) => a - b)) {
    const actions = actionIntervals.filter((item) => item.open.end <= start && start < item.close.start);
    if (actions.length !== 1) {
      ambiguities.push(`"${EXACT_CTA}" em ${start} pertence a ${actions.length} ações estruturais`);
      exactOccurrences.push({ start, related: null });
      continue;
    }

    const related = relatedIntervals.filter((item) => inside(item, actions[0]));
    if (related.length > 1) {
      ambiguities.push(`"${EXACT_CTA}" em ${start} pertence a ${related.length} blocos ${RELATED_CLASS}`);
      exactOccurrences.push({ start, related: null });
      continue;
    }
    exactOccurrences.push({ start, related: related.length === 1 });
  }

  const variants = [];
  for (const action of actionIntervals) {
    const label = actionLabel(scanned.textSegments, action);
    if (!/^VER\b/i.test(label) || label.length > 100) continue;
    const related = relatedIntervals.filter((item) => inside(item, action));
    if (related.length > 1) {
      ambiguities.push(`ação "${label}" em ${action.open.start} pertence a múltiplos blocos ${RELATED_CLASS}`);
      continue;
    }
    const isLiteralExact = exactOccurrences.some((item) => item.start >= action.open.end && item.start < action.close.start);
    if (!isLiteralExact) {
      variants.push({ label, related: related.length === 1, encodedExact: label === EXACT_CTA });
    }
  }

  return {
    exactOccurrences,
    variants,
    ambiguities,
    relatedBlockCount: relatedIntervals.length,
  };
}

export function auditFailures({ fileCount, exactTotal, relatedTotal, outsideTotal, ambiguousFileCount }) {
  const failures = [];
  if (fileCount === 0) failures.push('nenhum produto-*.html versionado foi encontrado');
  if (exactTotal === 0) failures.push(`nenhuma ocorrência literal comercial de "${EXACT_CTA}" foi encontrada`);
  if (outsideTotal > 0) failures.push(`${outsideTotal} ocorrência(s) literal(is) comercial(is) fora de ${RELATED_CLASS}`);
  if (ambiguousFileCount > 0) failures.push(`${ambiguousFileCount} arquivo(s) com classificação ambígua`);
  if (exactTotal !== relatedTotal + outsideTotal) {
    failures.push(`discrepância estrutural: ${exactTotal} literal(is) comercial(is) != ${relatedTotal + outsideTotal} classificada(s)`);
  }
  return failures;
}

function trackedProductFiles() {
  const output = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return output
    .split('\0')
    .filter(Boolean)
    .filter((path) => /^produto-[^/]+\.html$/.test(basename(path)))
    .sort();
}

function runAudit() {
  const files = trackedProductFiles();
  const ambiguousFiles = new Map();
  const exactFiles = [];
  const variantMap = new Map();
  let exactTotal = 0;
  let relatedTotal = 0;
  let outsideTotal = 0;
  let unresolvedTotal = 0;
  let relatedBlocks = 0;

  for (const path of files) {
    let html;
    try {
      html = readFileSync(path, 'utf8');
    } catch (error) {
      ambiguousFiles.set(path, [`falha de leitura: ${error.message}`]);
      continue;
    }

    const result = classifyHtml(html);
    relatedBlocks += result.relatedBlockCount;
    const related = result.exactOccurrences.filter((item) => item.related === true).length;
    const outside = result.exactOccurrences.filter((item) => item.related === false).length;
    const unresolved = result.exactOccurrences.filter((item) => item.related === null).length;

    exactTotal += result.exactOccurrences.length;
    relatedTotal += related;
    outsideTotal += outside;
    unresolvedTotal += unresolved;

    if (result.exactOccurrences.length > 0) {
      exactFiles.push({ path, exact: result.exactOccurrences.length, related, outside, unresolved });
    }
    if (result.ambiguities.length > 0) ambiguousFiles.set(path, result.ambiguities);

    for (const variant of result.variants) {
      const key = `${variant.label}\u0000${variant.encodedExact ? 'encoded' : 'label'}`;
      if (!variantMap.has(key)) {
        variantMap.set(key, { label: variant.label, encodedExact: variant.encodedExact, total: 0, related: 0, outside: 0, files: new Set() });
      }
      const item = variantMap.get(key);
      item.total += 1;
      if (variant.related) item.related += 1;
      else item.outside += 1;
      item.files.add(path);
    }
  }

  console.log('M3.2 RELATED SCOPE AUDIT');
  console.log(`TOTAL_PRODUTO_HTML=${files.length}`);
  console.log(`VER_OFERTA_EXATAS_REAIS=${exactTotal}`);
  console.log(`RELATED_CONFIRMADAS=${relatedTotal}`);
  console.log(`FORA_DE_RELATED=${outsideTotal}`);
  console.log(`NAO_CLASSIFICADAS=${unresolvedTotal}`);
  console.log(`BLOCOS_RELATED_RECONHECIDOS=${relatedBlocks}`);
  console.log(`ARQUIVOS_AMBIGUOS=${ambiguousFiles.size}`);
  console.log('ARQUIVOS_COM_VER_OFERTA_EXATA_REAL:');
  for (const item of exactFiles) {
    console.log(`- ${item.path}: exact=${item.exact} related=${item.related} outside=${item.outside} unresolved=${item.unresolved}`);
  }
  console.log('VARIANTES:');
  if (variantMap.size === 0) console.log('- nenhuma');
  for (const item of [...variantMap.values()].sort((a, b) => a.label.localeCompare(b.label))) {
    const suffix = item.encodedExact ? ' [forma HTML não literal]' : '';
    console.log(`- ${JSON.stringify(item.label)}${suffix}: total=${item.total} related=${item.related} outside=${item.outside} files=${[...item.files].sort().join(',')}`);
  }
  console.log('ARQUIVOS_AMBIGUOS_DETALHE:');
  if (ambiguousFiles.size === 0) console.log('- nenhum');
  for (const [path, errors] of ambiguousFiles) {
    console.log(`- ${path}`);
    for (const error of errors) console.log(`  - ${error}`);
  }

  const failures = auditFailures({
    fileCount: files.length,
    exactTotal,
    relatedTotal,
    outsideTotal,
    ambiguousFileCount: ambiguousFiles.size,
  });

  console.log('INVARIANTES:');
  console.log('- existe ao menos um produto-*.html versionado');
  console.log(`- existe ao menos uma ocorrência literal comercial real de "${EXACT_CTA}"`);
  console.log('- comments e conteúdo raw-text (script/style/textarea/title) não entram na contagem comercial');
  console.log('- toda ocorrência comercial real é conteúdo de exatamente uma ação <a>/<button>');
  console.log(`- toda ocorrência comercial real está em exatamente um contexto reconhecível e nenhuma fica fora de .${RELATED_CLASS}`);
  console.log('- nesting estrutural relevante cruzado/malformado torna o arquivo ambíguo');
  console.log('- total comercial real = related confirmadas + fora de related');

  if (failures.length > 0) {
    console.error('AUDIT_RESULT=FAIL');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('AUDIT_RESULT=PASS');
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) runAudit();
