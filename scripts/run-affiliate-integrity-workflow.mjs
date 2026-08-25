#!/usr/bin/env node

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUDIT_SCRIPT = path.join(ROOT, 'scripts', 'audit-affiliate-integrity.mjs');

export const EXECUTION_CONTRACT = 'pnm.affiliate-integrity-execution/v1';
export const REPORT_CONTRACT = 'pnm.affiliate-integrity/v1';
export const EXECUTOR_SCOPES = Object.freeze(['full', 'product', 'batch', 'input']);

const PRODUCT_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;
const SHA_RE = /^[0-9a-f]{40}$/i;
const POSITIVE_INTEGER_RE = /^[1-9][0-9]*$/;

function text(value) {
  return String(value ?? '').trim();
}

function requirePositiveInteger(value, name) {
  const normalized = text(value);
  if (!POSITIVE_INTEGER_RE.test(normalized)) throw new Error(`${name} inválido`);
  return normalized;
}

function validateProductId(value) {
  const id = text(value);
  if (!PRODUCT_ID_RE.test(id)) throw new Error(`product_id inválido: ${id || '<vazio>'}`);
  return id;
}

export function parseProductIds(value) {
  const raw = text(value);
  if (!raw) return [];
  const ids = [...new Set(raw.split(',').map(part => validateProductId(part)))];
  if (ids.length > 100) throw new Error('lote excede 100 product_ids');
  return ids;
}

function parseInputJson(value) {
  const raw = text(value);
  if (!raw) throw new Error('input_json obrigatório para scope=input');
  const parsed = JSON.parse(raw);
  const products = Array.isArray(parsed) ? parsed : parsed?.products;
  if (!Array.isArray(products) || products.length === 0) throw new Error('input_json deve conter produtos');
  if (products.length > 100) throw new Error('input_json excede 100 produtos');
  return JSON.stringify(Array.isArray(parsed) ? products : { products });
}

function parseComparisonJson(value) {
  const raw = text(value);
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (parsed?.contract !== REPORT_CONTRACT || !Array.isArray(parsed?.results)) {
    throw new Error('compare_report_json incompatível com pnm.affiliate-integrity/v1');
  }
  return JSON.stringify(parsed);
}

export function buildAuditExecutionPlan(env = {}) {
  const scope = text(env.PNM_AUDIT_SCOPE || 'full');
  if (!EXECUTOR_SCOPES.includes(scope)) throw new Error(`scope inválido: ${scope || '<vazio>'}`);

  const runId = requirePositiveInteger(env.GITHUB_RUN_ID, 'GITHUB_RUN_ID');
  const runAttempt = requirePositiveInteger(env.GITHUB_RUN_ATTEMPT || '1', 'GITHUB_RUN_ATTEMPT');
  const sourceSha = text(env.GITHUB_SHA);
  if (!SHA_RE.test(sourceSha)) throw new Error('GITHUB_SHA inválido');
  const eventName = text(env.GITHUB_EVENT_NAME);
  if (!['workflow_dispatch', 'workflow_call', 'schedule'].includes(eventName)) throw new Error('GITHUB_EVENT_NAME não permitido');
  const ref = text(env.GITHUB_REF);
  if (!ref || ref.length > 240) throw new Error('GITHUB_REF inválido');

  const productIdRaw = text(env.PNM_AUDIT_PRODUCT_ID);
  const productIdsRaw = text(env.PNM_AUDIT_PRODUCT_IDS);
  const inputJsonRaw = text(env.PNM_AUDIT_INPUT_JSON);
  const compareJson = parseComparisonJson(env.PNM_AUDIT_COMPARE_REPORT_JSON);
  let productId = null;
  let productIds = [];
  let inputJson = null;

  if (scope === 'full') {
    if (productIdRaw || productIdsRaw || inputJsonRaw) throw new Error('scope=full não aceita seleção adicional');
  } else if (scope === 'product') {
    if (productIdsRaw || inputJsonRaw) throw new Error('scope=product aceita somente product_id');
    productId = validateProductId(productIdRaw);
  } else if (scope === 'batch') {
    if (productIdRaw || inputJsonRaw) throw new Error('scope=batch aceita somente product_ids');
    productIds = parseProductIds(productIdsRaw);
    if (productIds.length === 0) throw new Error('product_ids obrigatório para scope=batch');
  } else if (scope === 'input') {
    if (productIdRaw || productIdsRaw) throw new Error('scope=input não aceita IDs do catálogo');
    inputJson = parseInputJson(inputJsonRaw);
  }

  const runKey = `run-${runId}-attempt-${runAttempt}`;
  const artifactDir = path.posix.join('artifacts', 'affiliate-integrity', runKey);
  const reportPath = path.posix.join(artifactDir, 'report.json');
  const manifestPath = path.posix.join(artifactDir, 'execution.json');
  const inputPath = path.posix.join(artifactDir, 'input.json');
  const comparePath = path.posix.join(artifactDir, 'compare.json');
  const auditArgs = [];

  if (scope === 'product') auditArgs.push('--id', productId);
  else if (scope === 'batch') auditArgs.push('--ids', productIds.join(','));
  else if (scope === 'input') auditArgs.push('--input', inputPath);
  if (compareJson) auditArgs.push('--compare-to', comparePath);
  auditArgs.push('--output', reportPath);

  return Object.freeze({
    scope,
    runId,
    runAttempt,
    sourceSha,
    eventName,
    ref,
    productId,
    productIds: Object.freeze([...productIds]),
    inputJson,
    compareJson,
    artifactDir,
    reportPath,
    manifestPath,
    inputPath,
    comparePath,
    auditArgs: Object.freeze([...auditArgs]),
  });
}

function absolute(relativePath) {
  const resolved = path.resolve(ROOT, relativePath);
  if (!resolved.startsWith(`${ROOT}${path.sep}`)) throw new Error('caminho de artefato inválido');
  return resolved;
}

export async function executeAuditPlan(plan) {
  const artifactDir = absolute(plan.artifactDir);
  await fsp.mkdir(artifactDir, { recursive: true });
  if (plan.inputJson) await fsp.writeFile(absolute(plan.inputPath), `${plan.inputJson}\n`, 'utf8');
  if (plan.compareJson) await fsp.writeFile(absolute(plan.comparePath), `${plan.compareJson}\n`, 'utf8');

  const startedAt = new Date().toISOString();
  const child = spawnSync(process.execPath, [AUDIT_SCRIPT, ...plan.auditArgs], {
    cwd: ROOT,
    env: process.env,
    stdio: 'inherit',
    shell: false,
  });
  if (child.error) throw child.error;
  if (child.status !== 0) throw new Error(`auditor encerrou com status ${child.status}`);

  const finishedAt = new Date().toISOString();
  const report = JSON.parse(await fsp.readFile(absolute(plan.reportPath), 'utf8'));
  if (report?.contract !== REPORT_CONTRACT || !Array.isArray(report?.results)) {
    throw new Error('relatório produzido pelo L1.1 é incompatível');
  }

  const manifest = {
    contract: EXECUTION_CONTRACT,
    reportContract: REPORT_CONTRACT,
    run: {
      id: plan.runId,
      attempt: plan.runAttempt,
      event: plan.eventName,
      ref: plan.ref,
      sourceSha: plan.sourceSha,
      scope: plan.scope,
      productId: plan.productId,
      productIds: plan.productIds,
      startedAt,
      finishedAt,
    },
    report: {
      path: plan.reportPath,
      generatedAt: report.generatedAt || null,
      totalResults: report.results.length,
    },
  };
  await fsp.writeFile(absolute(plan.manifestPath), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

async function main() {
  if (!fs.existsSync(AUDIT_SCRIPT)) throw new Error('auditor L1.1 não encontrado');
  const plan = buildAuditExecutionPlan(process.env);
  const manifest = await executeAuditPlan(plan);
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(`affiliate-integrity-executor: ${error.message}`);
    process.exitCode = 1;
  });
}
