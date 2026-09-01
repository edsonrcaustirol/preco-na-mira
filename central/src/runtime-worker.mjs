import { handleGithubOauthCentralRequest } from './github-oauth-worker.mjs';
import operationalHistoryMigration from '../migrations/0001_operational_history.sql';

let historySchemaReadyPromise = null;

export async function ensureOperationalHistorySchema(env = {}) {
  const db = env?.PNM_HISTORY_DB;
  if (!db || typeof db.exec !== 'function') return Object.freeze({ status: 'unbound' });

  if (!historySchemaReadyPromise) {
    historySchemaReadyPromise = db.exec(operationalHistoryMigration)
      .then(result => Object.freeze({ status: 'ready', result }))
      .catch(error => {
        historySchemaReadyPromise = null;
        throw error;
      });
  }

  return historySchemaReadyPromise;
}

function schemaFailureResponse() {
  return new Response(JSON.stringify({
    ok: false,
    code: 'PNM_HISTORY_SCHEMA_INIT_FAILED',
    message: 'Não foi possível inicializar o histórico operacional.',
  }), {
    status: 503,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
    },
  });
}

export async function handleCentralRuntimeRequest(request, env, options = {}) {
  try {
    await ensureOperationalHistorySchema(env);
  } catch (error) {
    console.error('PNM_HISTORY_SCHEMA_INIT_FAILED', String(error?.message || error));
    return schemaFailureResponse();
  }

  return handleGithubOauthCentralRequest(request, env, options);
}

export default {
  async fetch(request, env) {
    return handleCentralRuntimeRequest(request, env);
  },
};
