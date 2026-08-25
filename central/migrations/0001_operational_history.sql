PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS audit_runs (
  run_id TEXT PRIMARY KEY,
  trigger TEXT NOT NULL,
  scope TEXT NOT NULL,
  source_sha TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'PARTIAL', 'FAILED')),
  totals_json TEXT NOT NULL DEFAULT '{}',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_results (
  run_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  audited_link TEXT,
  link_fingerprint TEXT NOT NULL,
  classification TEXT NOT NULL CHECK (classification IN ('CORRETO', 'PROVÁVEL', 'DIVERGENTE', 'ANÚNCIO_INDISPONÍVEL', 'DESTINO_GENÉRICO', 'PROBLEMA_DE_LINK', 'NÃO_COMPROVÁVEL')),
  reason TEXT,
  checked_at TEXT NOT NULL,
  evidence_json TEXT,
  PRIMARY KEY (run_id, product_id),
  FOREIGN KEY (run_id) REFERENCES audit_runs(run_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_events (
  event_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  product_id TEXT,
  event_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  previous_state_ref TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (run_id) REFERENCES audit_runs(run_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audit_runs_full_health
  ON audit_runs(scope, status, finished_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_results_product_checked
  ON audit_results(product_id, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_results_product_fingerprint
  ON audit_results(product_id, link_fingerprint, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_run_time
  ON audit_events(run_id, occurred_at DESC);
