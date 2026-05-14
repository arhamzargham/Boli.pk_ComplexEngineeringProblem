-- Seed test users with Pakistani phone numbers for demo
-- Phone format: +92 + 10 digits (E.164)
-- Run AFTER migration 00006_add_phone_to_users.sql

BEGIN;

-- Insert 4 test users (idempotent)
INSERT INTO users (user_id, phone, role, kyc_tier, account_status, trust_score, created_at)
VALUES
  -- Seller: Arham (seller with active listings)
  ('550e8400-e29b-41d4-a716-446655440001', '+923001234567', 'SELLER', 'FULL', 'FULL_ACTIVE', 85, NOW()),

  -- Buyer 1: Abdul (funded wallet, KYC FULL, ready to bid)
  ('550e8400-e29b-41d4-a716-446655440002', '+923211234568', 'BUYER', 'FULL', 'FULL_ACTIVE', 90, NOW()),

  -- Admin: Demo admin account
  ('550e8400-e29b-41d4-a716-446655440003', '+923451234569', 'ADMIN', 'FULL', 'FULL_ACTIVE', 100, NOW()),

  -- Buyer 2: Secondary buyer (for multi-user auction demo)
  ('550e8400-e29b-41d4-a716-446655440004', '+923001234570', 'BUYER', 'BASIC', 'PARTIAL_ACTIVE', 50, NOW())

ON CONFLICT (user_id) DO UPDATE SET
  phone = EXCLUDED.phone;

-- Update phone for any user whose phone is still null (idempotent)
UPDATE users SET phone = '+923001234567' WHERE user_id = '550e8400-e29b-41d4-a716-446655440001' AND phone IS NULL;
UPDATE users SET phone = '+923211234568' WHERE user_id = '550e8400-e29b-41d4-a716-446655440002' AND phone IS NULL;
UPDATE users SET phone = '+923451234569' WHERE user_id = '550e8400-e29b-41d4-a716-446655440003' AND phone IS NULL;
UPDATE users SET phone = '+923001234570' WHERE user_id = '550e8400-e29b-41d4-a716-446655440004' AND phone IS NULL;

-- Create wallets for all 4 test users.
-- INVARIANT: available + reserved + locked = total_deposited (CLAUDE.md INVARIANT-01)
-- Seller gets 0 — paid out after sales
-- Buyer 1 gets Rs. 500,000 (50,000,000 paisa) — funded for auction bidding
-- Admin gets 0
-- Buyer 2 gets Rs. 100,000 (10,000,000 paisa) — secondary bidder
INSERT INTO wallets (user_id, available_paisa, reserved_paisa, locked_paisa, total_deposited_paisa, daily_escrow_exposure_paisa, updated_at)
VALUES
  ('550e8400-e29b-41d4-a716-446655440001',       0,  0, 0,       0, 0, NOW()),
  ('550e8400-e29b-41d4-a716-446655440002', 50000000,  0, 0, 50000000, 0, NOW()),
  ('550e8400-e29b-41d4-a716-446655440003',       0,  0, 0,       0, 0, NOW()),
  ('550e8400-e29b-41d4-a716-446655440004', 10000000,  0, 0, 10000000, 0, NOW())
ON CONFLICT (user_id) DO NOTHING;

-- Create KYC records for FULL-tier accounts (required for listing above Rs.100k)
INSERT INTO kyc_records (kyc_id, user_id, cnic_verified_at, ntn_status, biometric_hash_sha256, verification_source, updated_at)
VALUES
  (gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440001', NOW(), 'FILER',     repeat('a', 64), 'MOCK', NOW()),
  (gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440002', NOW(), 'NON_FILER', repeat('b', 64), 'MOCK', NOW()),
  (gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440003', NOW(), 'FILER',     repeat('c', 64), 'MOCK', NOW())
ON CONFLICT (user_id) DO NOTHING;

COMMIT;

-- Verification query
SELECT user_id, phone, role, kyc_tier, account_status
FROM users
WHERE user_id IN (
  '550e8400-e29b-41d4-a716-446655440001',
  '550e8400-e29b-41d4-a716-446655440002',
  '550e8400-e29b-41d4-a716-446655440003',
  '550e8400-e29b-41d4-a716-446655440004'
)
ORDER BY created_at;
