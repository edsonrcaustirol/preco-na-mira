#!/usr/bin/env node
import { executeQuery, getQuery, listQueries } from './m3-1-analytics-lib.mjs';

const [command = 'list', arg = ''] = process.argv.slice(2);
if (command === 'list') console.log(JSON.stringify(listQueries(arg), null, 2));
else if (command === 'sql' && arg) console.log(getQuery(arg).sql);
else if (command === 'run' && arg) {
  const result = await executeQuery(arg, { accountId: process.env.PNM_CF_ACCOUNT_ID, apiToken: process.env.PNM_CF_ANALYTICS_TOKEN });
  console.log(JSON.stringify({ query: arg, result }, null, 2));
} else if (command === 'run-group' && ['metrics','quality'].includes(arg)) {
  for (const item of listQueries(arg)) {
    const result = await executeQuery(item.name, { accountId: process.env.PNM_CF_ACCOUNT_ID, apiToken: process.env.PNM_CF_ANALYTICS_TOKEN });
    console.log(JSON.stringify({ query: item.name, result }, null, 2));
  }
} else {
  console.error('Uso: node scripts/m3-1-analytics.mjs list [metrics|quality] | sql <nome> | run <nome> | run-group <metrics|quality>');
  process.exitCode = 2;
}
