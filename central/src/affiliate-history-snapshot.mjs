import { PART_1 } from './generated/affiliate-history-snapshot-1.mjs';
import { PART_2 } from './generated/affiliate-history-snapshot-2.mjs';
import { PART_3 } from './generated/affiliate-history-snapshot-3.mjs';
import { PART_4 } from './generated/affiliate-history-snapshot-4.mjs';

const CLASSES = Object.freeze(['CORRETO','PROVÁVEL','DIVERGENTE','ANÚNCIO_INDISPONÍVEL','DESTINO_GENÉRICO','PROBLEMA_DE_LINK','NÃO_COMPROVÁVEL']);
const RUN = Object.freeze({
  run_id:'33294484400-1',
  trigger:'schedule',
  scope:'FULL',
  source_sha:'af24f5477a89ed048e5f5f3c47da45aef45ef4c9',
  started_at:'2026-08-30T05:20:54.489Z',
  finished_at:'2026-08-30T05:25:05.196Z',
  status:'SUCCESS',
  totals_json:JSON.stringify({TOTAL:596,CORRETOS:308,PROVAVEIS:123,DIVERGENTES:32,INDISPONIVEIS:23,DESTINO_GENERICO:0,PROBLEMAS_DE_LINK:1,NAO_COMPROVAVEIS:109,SAUDAVEIS:431,PRECISAM_ATENCAO:56}),
  metadata_json:JSON.stringify({monitorContract:'pnm.affiliate-integrity-monitor/v1',evaluationReason:'COMPLETE_CONTRACT_RESULT_SET',source:'github-actions-versioned-snapshot'}),
});

const ERRONEOUS_SEED_ID = 'rejunte-epoxi-super-facil-1kg-quartzolit-1kg-varias-cores';
const CORRECTIONS = Object.freeze([
  ['rejunte-epoxi-super-facil-1kg-quartzolit-varias-cores','sha256:926b751a9afe20151e8861ebf53c7f04a964b51849c89e59e49b48561fe6f875',0],
]);

const rows = [...PART_1,...PART_2,...PART_3,...PART_4]
  .filter(([productId]) => productId !== ERRONEOUS_SEED_ID)
  .concat(CORRECTIONS);
const results = rows.map(([product_id,link_fingerprint,classIndex]) => Object.freeze({
  run_id:RUN.run_id,
  product_id,
  audited_link:null,
  link_fingerprint,
  classification:CLASSES[classIndex],
  reason:null,
  checked_at:RUN.finished_at,
  evidence_json:null,
  trigger:RUN.trigger,
  scope:RUN.scope,
  status:RUN.status,
  source_sha:RUN.source_sha,
  started_at:RUN.started_at,
  finished_at:RUN.finished_at,
}));

export const CENTRAL_AFFILIATE_HISTORY_SNAPSHOT = Object.freeze({
  contract:'pnm.central-history/v1',
  source:'github-actions-versioned-snapshot',
  recentRuns:Object.freeze([RUN]),
  latestHealthyFull:RUN,
  results:Object.freeze(results),
  events:Object.freeze([]),
});
