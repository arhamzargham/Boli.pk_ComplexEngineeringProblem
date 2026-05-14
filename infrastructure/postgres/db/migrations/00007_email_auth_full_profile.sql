-- Migration: Email-based auth + full user profile columns
-- Email is the primary auth identifier. Phone is KYC profile data.
-- Safe to run if 00006_add_phone_to_users.sql was already applied.

BEGIN;

-- Add email column (primary auth identifier)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Partial unique index: enforces uniqueness only on non-null emails
-- (existing rows have NULL — no conflict)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
    ON users(email) WHERE email IS NOT NULL;

-- Phone column may already exist from migration 00006
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(15);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone
    ON users(phone) WHERE phone IS NOT NULL;

-- Profile completion flag
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN NOT NULL DEFAULT FALSE;

-- Phone format constraint — guarded so it doesn't fail if 00006 added it already
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_phone_format'
    ) THEN
        ALTER TABLE users
        ADD CONSTRAINT users_phone_format
        CHECK (phone IS NULL OR phone ~ '^\+92[0-9]{10}$');
    END IF;
END$$;

-- Comments
COMMENT ON COLUMN users.email IS 'Primary authentication identifier — user registers/logs in with this.';
COMMENT ON COLUMN users.phone IS 'Pakistan phone in E.164 format (+92XXXXXXXXXX). Collected post-email-verification via KYC.';
COMMENT ON COLUMN users.profile_complete IS 'TRUE when user has completed full KYC (phone + CNIC). Controls bid/list access.';

COMMIT;
