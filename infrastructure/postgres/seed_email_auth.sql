-- Seed: 4 demo users with email + phone for email-based OTP auth
-- Run AFTER migration 00007_email_auth_full_profile.sql
-- Uses ON CONFLICT (user_id) DO UPDATE — safe to re-run.

BEGIN;

INSERT INTO users (
    user_id, email, phone, role, kyc_tier,
    account_status, trust_score, profile_complete, created_at
)
VALUES
  -- Seller: Arham — complete profile, active listings
  ('550e8400-e29b-41d4-a716-446655440001',
   'seller@boli.pk', '+923001234567',
   'SELLER', 'FULL', 'FULL_ACTIVE', 85, TRUE, NOW()),

  -- Buyer 1: Abdul — complete profile, pre-funded wallet, ready to bid
  ('550e8400-e29b-41d4-a716-446655440002',
   'buyer1@boli.pk', '+923211234568',
   'BUYER', 'FULL', 'FULL_ACTIVE', 90, TRUE, NOW()),

  -- Admin: Demo admin account
  ('550e8400-e29b-41d4-a716-446655440003',
   'admin@boli.pk', '+923451234569',
   'ADMIN', 'FULL', 'FULL_ACTIVE', 100, TRUE, NOW()),

  -- Buyer 2: secondary bidder — email only, profile incomplete
  ('550e8400-e29b-41d4-a716-446655440004',
   'buyer2@boli.pk', NULL,
   'BUYER', 'BASIC', 'PARTIAL_ACTIVE', 50, FALSE, NOW())

ON CONFLICT (user_id) DO UPDATE SET
  email            = EXCLUDED.email,
  phone            = EXCLUDED.phone,
  role             = EXCLUDED.role,
  kyc_tier         = EXCLUDED.kyc_tier,
  account_status   = EXCLUDED.account_status,
  trust_score      = EXCLUDED.trust_score,
  profile_complete = EXCLUDED.profile_complete;

-- Create wallets for all 4 users (idempotent).
-- INVARIANT-01: available + reserved + locked = total_deposited
-- Buyer 1: Rs. 500,000 (50,000,000 paisa)
-- Buyer 2: Rs. 100,000 (10,000,000 paisa)
-- Seller and Admin: zero balance (paid out after transactions)
INSERT INTO wallets (
    user_id, available_paisa, reserved_paisa, locked_paisa,
    total_deposited_paisa, daily_escrow_exposure_paisa, updated_at
)
VALUES
  ('550e8400-e29b-41d4-a716-446655440001',       0, 0, 0,       0, 0, NOW()),
  ('550e8400-e29b-41d4-a716-446655440002', 50000000, 0, 0, 50000000, 0, NOW()),
  ('550e8400-e29b-41d4-a716-446655440003',       0, 0, 0,       0, 0, NOW()),
  ('550e8400-e29b-41d4-a716-446655440004', 10000000, 0, 0, 10000000, 0, NOW())
ON CONFLICT (user_id) DO NOTHING;

-- KYC records for FULL-tier accounts
INSERT INTO kyc_records (
    kyc_id, user_id, cnic_verified_at, ntn_status,
    biometric_hash_sha256, verification_source, updated_at
)
VALUES
  (gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440001',
   NOW(), 'FILER',     repeat('a', 64), 'MOCK', NOW()),
  (gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440002',
   NOW(), 'NON_FILER', repeat('b', 64), 'MOCK', NOW()),
  (gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440003',
   NOW(), 'FILER',     repeat('c', 64), 'MOCK', NOW())
ON CONFLICT (user_id) DO NOTHING;

COMMIT;

-- Verification
SELECT user_id, email, phone, role, kyc_tier, profile_complete
FROM users
WHERE user_id IN (
  '550e8400-e29b-41d4-a716-446655440001',
  '550e8400-e29b-41d4-a716-446655440002',
  '550e8400-e29b-41d4-a716-446655440003',
  '550e8400-e29b-41d4-a716-446655440004'
)
ORDER BY created_at;
