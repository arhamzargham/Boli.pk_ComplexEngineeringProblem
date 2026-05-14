-- Migration: Add phone column to users for OTP-based auth
-- Pakistan phone format: +92 + 10 digits (E.164 standard)

BEGIN;

-- Add phone column with UNIQUE constraint
ALTER TABLE users
ADD COLUMN IF NOT EXISTS phone VARCHAR(15) UNIQUE;

-- Create index for fast OTP lookups by phone
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- Add constraint to enforce E.164 format: +92XXXXXXXXXX (X = digit)
ALTER TABLE users
ADD CONSTRAINT users_phone_format
CHECK (phone IS NULL OR phone ~ '^\+92[0-9]{10}$');

-- Comment for clarity
COMMENT ON COLUMN users.phone IS 'Pakistan phone number in E.164 format: +92XXXXXXXXXX. Encrypted at rest in production.';

COMMIT;
