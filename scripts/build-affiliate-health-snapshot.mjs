#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const runId=String(process.env.GITHUB_RUN_ID||'').trim();
const attempt=String(process.env.GITHUB_RUN_ATTEMPT||'1').trim();
if(!/^[1-9][0-9]*$/.test(runId)||!/[1-9][0-9]*/.test(attempt))throw new Error('GitHub run inválido');
const dir=path.join('artifacts','affiliate-integrity',`run-${runId}-attempt-${attempt}`);
const report=JSON.parse(await fs.readFile(path.join(dir,'report.json'),'utf8'));
const execution=JSON.parse(await fs.readFile(path.join(dir,'execution.json'),'utf8'));
if(report?.contract!=='pnm.affiliate-integrity/v1'||!Array.isArray(report.results))throw new Error('report incompatível');
if(execution?.contract!=='pnm.affiliate-integrity-execution/v1')throw new Error('execution incompatível');
const snapshot={
  contract:'pnm.central-link-health-snapshot/v1',
  sourceContract:report.contract,
  capturedAt:new Date().toISOString(),
  run:{
    runId:String(execution.run?.id||runId),
    attempt:Number(execution.run?.attempt||attempt),
    trigger:String(execution.run?.event||''),
    scope:String(execution.run?.scope||'full').toUpperCase(),
    sourceSha:String(execution.run?.sourceSha||''),
    startedAt:execution.run?.startedAt||report.run?.startedAt||null,
    finishedAt:execution.run?.finishedAt||report.run?.finishedAt||report.generatedAt||null,
    status:'SUCCESS',
  },
  summary:report.summary||{},
  results:report.results,
};
await fs.mkdir(path.join('artifacts','affiliate-integrity','snapshot'),{recursive:true});
await fs.writeFile(path.join('artifacts','affiliate-integrity','snapshot','latest.json'),`${JSON.stringify(snapshot,null,2)}\n`,'utf8');
console.log(JSON.stringify({snapshot:'PASS',runId:snapshot.run.runId,scope:snapshot.run.scope,results:snapshot.results.length},null,2));
