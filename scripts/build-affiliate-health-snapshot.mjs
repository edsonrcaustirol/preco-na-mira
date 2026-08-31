#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HISTORY_CONTRACT = 'pnm.central-history/v1';
const CLASSIFICATIONS = Object.freeze(['CORRETO','PROVÁVEL','DIVERGENTE','ANÚNCIO_INDISPONÍVEL','DESTINO_GENÉRICO','PROBLEMA_DE_LINK','NÃO_COMPROVÁVEL']);
const CLASS_INDEX = new Map(CLASSIFICATIONS.map((value, index) => [value, index]));
const PARTS = 4;
const GENERATED_DIR = path.join('central','src','generated');

function required(value, name) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${name} obrigatório`);
  return text;
}

function validatePayload(payload) {
  if (payload?.contract !== HISTORY_CONTRACT) throw new Error('history-payload incompatível');
  const run = payload.run || {};
  if (String(run.scope || '').toUpperCase() !== 'FULL') throw new Error('snapshot só aceita auditoria FULL');
  if (run.status !== 'SUCCESS') throw new Error(`snapshot exige FULL saudável; status=${run.status || 'ausente'}`);
  if (!Array.isArray(payload.results) || payload.results.length === 0) throw new Error('history-payload sem resultados');
  const ids = new Set();
  for (const result of payload.results) {
    const id = required(result.product_id, 'result.product_id');
    if (ids.has(id)) throw new Error(`product_id duplicado: ${id}`);
    ids.add(id);
    if (!CLASS_INDEX.has(result.classification)) throw new Error(`classificação inválida: ${result.classification}`);
    if (!/^sha256:[0-9a-f]{64}$/.test(String(result.link_fingerprint || ''))) throw new Error(`fingerprint inválido: ${id}`);
  }
  const total = Number(run.totals?.TOTAL);
  if (Number.isFinite(total) && total !== payload.results.length) throw new Error('TOTAL diverge dos resultados');
  return { run, results: payload.results };
}

function renderPart(name, rows) {
  return `export const ${name}=${JSON.stringify(rows)};\n`;
}

function renderMeta(run) {
  const meta = {
    run_id: required(run.run_id, 'run.run_id'),
    trigger: required(run.trigger, 'run.trigger'),
    scope: 'FULL',
    source_sha: required(run.source_sha, 'run.source_sha'),
    started_at: required(run.started_at, 'run.started_at'),
    finished_at: required(run.finished_at, 'run.finished_at'),
    status: 'SUCCESS',
    totals: run.totals || {},
    metadata: { ...(run.metadata || {}), source: 'github-actions-versioned-snapshot' },
  };
  return `export const SNAPSHOT_META=Object.freeze(${JSON.stringify(meta)});\n`;
}

export async function buildAffiliateHealthSnapshot({ runId = process.env.GITHUB_RUN_ID, attempt = process.env.GITHUB_RUN_ATTEMPT || '1' } = {}) {
  const normalizedRunId = String(runId || '').trim();
  const normalizedAttempt = String(attempt || '').trim();
  if (!/^[1-9][0-9]*$/.test(normalizedRunId) || !/^[1-9][0-9]*$/.test(normalizedAttempt)) throw new Error('GitHub run inválido');
  const dir = path.join('artifacts','affiliate-integrity',`run-${normalizedRunId}-attempt-${normalizedAttempt}`);
  const payload = JSON.parse(await fs.readFile(path.join(dir,'history-payload.json'),'utf8'));
  const { run, results } = validatePayload(payload);
  const rows = results.map(result => [result.product_id, result.link_fingerprint, CLASS_INDEX.get(result.classification)]);
  const chunkSize = Math.ceil(rows.length / PARTS);
  await fs.mkdir(GENERATED_DIR, { recursive: true });
  const written = [];
  for (let index = 0; index < PARTS; index += 1) {
    const file = path.join(GENERATED_DIR, `affiliate-history-snapshot-${index + 1}.mjs`);
    const chunk = rows.slice(index * chunkSize, (index + 1) * chunkSize);
    await fs.writeFile(file, renderPart(`PART_${index + 1}`, chunk), 'utf8');
    written.push(file.replaceAll('\\','/'));
  }
  const metaFile = path.join(GENERATED_DIR, 'affiliate-history-snapshot-meta.mjs');
  await fs.writeFile(metaFile, renderMeta(run), 'utf8');
  written.push(metaFile.replaceAll('\\','/'));

  const manifest = {
    contract: 'pnm.central-link-health-snapshot-build/v1',
    historyContract: HISTORY_CONTRACT,
    runId: run.run_id,
    sourceSha: run.source_sha,
    results: rows.length,
    files: written,
  };
  const artifactDir = path.join('artifacts','affiliate-integrity','snapshot');
  await fs.mkdir(artifactDir, { recursive: true });
  await fs.writeFile(path.join(artifactDir,'latest.json'), `${JSON.stringify(manifest,null,2)}\n`, 'utf8');
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildAffiliateHealthSnapshot().then(manifest => {
    console.log(JSON.stringify({snapshot:'PASS',...manifest},null,2));
  }).catch(error => {
    console.error(`affiliate-health-snapshot: ${error.message}`);
    process.exitCode = 1;
  });
}
