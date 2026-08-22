#!/usr/bin/env node
import { executeQuery, getQuery, listQueries } from './m2-1-analytics-lib.mjs';

function usage() {
  console.log(`M2.1 — Inteligência comercial\n\nUso:\n  node scripts/m2-1-analytics.mjs list [metrics|quality]\n  node scripts/m2-1-analytics.mjs sql <nome>\n  node scripts/m2-1-analytics.mjs run <nome>\n  node scripts/m2-1-analytics.mjs run-group <metrics|quality>\n\nPara executar consultas reais:\n  PNM_CF_ACCOUNT_ID=<account_id>\n  PNM_CF_ANALYTICS_TOKEN=<token Account Analytics Read>\n\nCredenciais são lidas somente do ambiente e nunca devem ser versionadas.`);
}

const [command = 'list', arg = ''] = process.argv.slice(2);

if (command === 'list') {
  console.log(JSON.stringify(listQueries(arg), null, 2));
} else if (command === 'sql') {
  if (!arg) { usage(); process.exitCode = 2; }
  else console.log(getQuery(arg).sql);
} else if (command === 'run') {
  if (!arg) { usage(); process.exitCode = 2; }
  else {
    const result = await executeQuery(arg, {
      accountId: process.env.PNM_CF_ACCOUNT_ID,
      apiToken: process.env.PNM_CF_ANALYTICS_TOKEN,
    });
    console.log(JSON.stringify({ query: arg, result }, null, 2));
  }
} else if (command === 'run-group') {
  if (!['metrics', 'quality'].includes(arg)) { usage(); process.exitCode = 2; }
  else {
    for (const item of listQueries(arg)) {
      const result = await executeQuery(item.name, {
        accountId: process.env.PNM_CF_ACCOUNT_ID,
        apiToken: process.env.PNM_CF_ANALYTICS_TOKEN,
      });
      console.log(JSON.stringify({ query: item.name, result }, null, 2));
    }
  }
} else {
  usage();
  process.exitCode = 2;
}
