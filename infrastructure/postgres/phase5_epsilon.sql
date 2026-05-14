-- =============================================================
-- Boli.pk — Phase 5 Schema Updates (EPSILON)
-- =============================================================

ALTER SYSTEM SET log_min_duration_statement = 100;  -- Log queries > 100ms
ALTER SYSTEM SET log_statement = 'all';             -- Log all SQL
ALTER SYSTEM SET log_duration = on;
SELECT pg_reload_conf();

CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID,
    event_type VARCHAR(50) NOT NULL,
    user_id UUID,
    old_value TEXT,
    new_value TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);
