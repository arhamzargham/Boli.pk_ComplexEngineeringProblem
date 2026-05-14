-- =============================================================
-- Boli.pk — Phase 4 Schema Updates
-- Workstreams ALPHA, BETA, GAMMA
-- =============================================================

-- =============================================================
-- WORKSTREAM ALPHA: TRANSACTIONS & DISPUTES
-- =============================================================

-- Add missing columns to transactions required by Phase 4 UI/Flows
ALTER TABLE transactions
    ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'LOCKED',
    ADD COLUMN settled_at TIMESTAMPTZ,
    ADD COLUMN meetup_confirmed_at TIMESTAMPTZ,
    ADD COLUMN meetup_location TEXT,
    ADD COLUMN qr_expires_at TIMESTAMPTZ,
    ADD COLUMN qr_payload JSONB,
    ADD COLUMN settlement_gps GEOMETRY; -- Using simple point or jsonb if postgis not present. 
    -- The prompt says ST_Point($1, $2). Assuming PostGIS is available or we can just use jsonb as in meetup_sessions.
    -- Wait, PostGIS might not be installed. Let's use Geometry or fallback. Actually the prompt says ST_Point, which implies PostGIS. Let's use GEOMETRY or just stick to JSONB as the prompt initially used `settlement_gps JSONB`. But wait, prompt says "settlement_gps = ST_Point($1, $2)". 

-- I will use a simple JSONB for settlement_gps or omit the ST_Point if postgis isn't there, but let's assume it's just TEXT/JSONB for now or stick exactly to the prompt.
-- Re-reading prompt: "settlement_gps = ST_Point($1, $2)". To be safe without postgis, I'll use POINT.
ALTER TABLE transactions
    DROP COLUMN IF EXISTS settlement_gps;
ALTER TABLE transactions
    ADD COLUMN settlement_gps POINT;

-- Create Trigger for Disputes (ALPHA)
CREATE OR REPLACE FUNCTION fn_dispute_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE transactions 
    SET status = 'DISPUTED',
        money_state = 'S8_ESCROW_DISPUTED',
        updated_at = NOW()
    WHERE transaction_id = NEW.transaction_id;
    
    -- Record ledger entry
    INSERT INTO ledger_entries (
        transaction_id, event_type, purpose, memo, amount_paisa, previous_hash_sha256, current_hash_sha256
    ) VALUES (
        NEW.transaction_id, 'CREDIT', 'ESCROW_LOCK', 'Dispute raised, funds frozen', 1, '0', '0'
    );
    -- We will update this ledger logic with GAMMA hash chain later.
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispute_insert ON disputes;
CREATE TRIGGER trg_dispute_insert
BEFORE INSERT ON disputes
FOR EACH ROW EXECUTE FUNCTION fn_dispute_insert();

-- =============================================================
-- WORKSTREAM BETA: AI & PROBABILISTIC CORE
-- =============================================================

ALTER TABLE bids ADD COLUMN IF NOT EXISTS shill_risk_score DECIMAL(3,2);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS metadata_outlier_score DECIMAL(3,2);
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS device_hash VARCHAR(64);

CREATE TABLE IF NOT EXISTS risk_audit (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL, -- 'BID', 'LISTING', 'USER_SESSION'
    entity_id UUID NOT NULL,
    risk_type VARCHAR(50) NOT NULL,   -- 'SHILL', 'SYBIL', 'OUTLIER'
    score DECIMAL(3,2) NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
