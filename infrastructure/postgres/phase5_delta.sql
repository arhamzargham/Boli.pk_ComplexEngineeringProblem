-- =============================================================
-- Boli.pk — Phase 5 Schema Updates (DELTA)
-- =============================================================

ALTER TABLE user_sessions
  ADD COLUMN IF NOT EXISTS otp_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS otp_attempts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS otp_last_request_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS otp_verified_at TIMESTAMP;
