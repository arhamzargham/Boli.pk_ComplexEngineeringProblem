-- =============================================================
-- Boli.pk — CEP Demo Seed Data
-- All monetary values in Paisa (BIGINT). No decimals anywhere.
-- Fixed UUIDs throughout so cross-table FKs resolve cleanly.
-- Sensitive fields: AES-256-GCM placeholders (BYTEA hex literals).
-- Passwords / PINs: bcrypt hash of '123456' (cost 10).
-- =============================================================
-- DEMO ACCOUNTS
--   admin1@boli.pk  / admin2@boli.pk  — Maker-Checker pair
--   buyer@boli.pk   — FULL KYC, Rs.500,000 funded wallet
--   seller@boli.pk  — FULL KYC, NTN verified (FILER)
--
-- SCENARIO COVERAGE (CLAUDE.md Section 15)
--   Scenario 1 — Happy Path      : iPhone 14 Pro, S4_LOCKED, ready for meetup
--   Scenario 2 — IMEI Mismatch   : use iPhone 14 Pro listing, swap IMEI at meetup
--   Scenario 3 — Ghost Bidding   : trigger by not confirming meetup within 72h
--   Scenario 4 — Duress          : enter duress PIN at QR generation step
--   Scenario 5 — Dispute         : iPhone 13, S8_ESCROW_DISPUTED, OPEN dispute
--   Scenario 6 — AI Pipeline     : Samsung Galaxy S23, MANUAL_REVIEW_REQUIRED
-- =============================================================
-- LUHN-VALID TEST IMEIs (verified by hand)
--   490154203237518  → mock DIRBS: REGISTERED_CLEAN  (iPhone 14 Pro)
--   354000000000002  → mock DIRBS: REGISTERED_CLEAN  (iPhone 13)
--   355000000000001  → mock DIRBS: UNREGISTERED       (Samsung S23)
--   353000000000003  → mock DIRBS: BLACKLISTED        (not used in listings)
-- =============================================================

-- =============================================================
-- SETTLEMENT MATH (verified zero-sum)
-- iPhone 14 Pro — winning bid Rs.220,000 = 22,000,000 paisa
--   buyer_total       = 22,000,000 × 1.02 = 22,440,000
--   buyer_fee         = 22,000,000 × 0.02 =    440,000
--   seller_fee        = 22,000,000 × 0.02 =    440,000
--   wht               = 22,000,000 × 0.01 =    220,000
--   ict_tax           = (440k+440k) × 0.15 =   132,000
--   seller_net        = 22,000,000 − 440,000 − 220,000 = 21,340,000
--   platform_revenue  = 440,000 + 440,000 − 132,000   =    748,000
--   ZERO-SUM: 21,340,000+220,000+132,000+748,000 = 22,440,000 ✓
--
-- iPhone 13 — winning bid Rs.150,000 = 15,000,000 paisa
--   buyer_total       = 15,000,000 × 1.02 = 15,300,000
--   buyer_fee         =               0.02 =    300,000
--   seller_fee        =               0.02 =    300,000
--   wht               =               0.01 =    150,000
--   ict_tax           = (300k+300k) × 0.15 =    90,000
--   seller_net        = 15,000,000 − 300,000 − 150,000 = 14,550,000
--   platform_revenue  = 300,000 + 300,000 − 90,000     =    510,000
--   ZERO-SUM: 14,550,000+150,000+90,000+510,000 = 15,300,000 ✓
--
-- Buyer wallet final state
--   total_deposited   = 50,000,000  (Rs.500,000 admin-funded)
--   locked_paisa      = 22,440,000 (iPhone 14) + 15,300,000 (iPhone 13) = 37,740,000
--   reserved_paisa    = 0
--   available_paisa   = 50,000,000 − 37,740,000 = 12,260,000
--   CHECK:            12,260,000 + 0 + 37,740,000 = 50,000,000 ✓
-- =============================================================

BEGIN;

-- =============================================================
-- SECTION 1 — USERS
-- =============================================================

INSERT INTO users (
    user_id, kyc_tier, trust_score, role, account_status,
    seller_suspension_count, buyer_offence_count,
    active_listing_count, preferred_locale, created_at
) VALUES

-- Admin 1 (Maker)
( 'a0000000-0000-4000-8000-000000000001',
  'FULL', 95, 'ADMIN', 'FULL_ACTIVE', 0, 0, 0, 'EN',
  '2026-01-01 09:00:00+05' ),

-- Admin 2 (Checker)
( 'a0000000-0000-4000-8000-000000000002',
  'FULL', 95, 'ADMIN', 'FULL_ACTIVE', 0, 0, 0, 'EN',
  '2026-01-01 09:05:00+05' ),

-- Buyer — FULL KYC
( 'b0000000-0000-4000-8000-000000000001',
  'FULL', 72, 'BUYER', 'FULL_ACTIVE', 0, 0, 0, 'UR',
  '2026-02-15 14:30:00+05' ),

-- Seller — FULL KYC, NTN verified
( 's0000000-0000-4000-8000-000000000001',
  'FULL', 88, 'SELLER', 'FULL_ACTIVE', 0, 0, 2, 'EN',
  '2026-01-20 11:00:00+05' );

-- Duress PIN = bcrypt('123456', cost=10) — buyer and seller both enrolled
UPDATE users SET
    duress_pin         = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    cnic_encrypted     = '\xdeadbeef00000000deadbeef00000000deadbeef00000000deadbeef00000001'::BYTEA
WHERE user_id = 'b0000000-0000-4000-8000-000000000001';

UPDATE users SET
    duress_pin         = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    cnic_encrypted     = '\xdeadbeef00000000deadbeef00000000deadbeef00000000deadbeef00000002'::BYTEA,
    ntn_encrypted      = '\xdeadbeef00000000deadbeef00000000deadbeef00000000deadbeef0000000a'::BYTEA
WHERE user_id = 's0000000-0000-4000-8000-000000000001';

UPDATE users SET
    cnic_encrypted     = '\xdeadbeef00000000deadbeef00000000deadbeef00000000deadbeef000000a1'::BYTEA
WHERE user_id = 'a0000000-0000-4000-8000-000000000001';

UPDATE users SET
    cnic_encrypted     = '\xdeadbeef00000000deadbeef00000000deadbeef00000000deadbeef000000a2'::BYTEA
WHERE user_id = 'a0000000-0000-4000-8000-000000000002';


-- =============================================================
-- SECTION 2 — USER SESSIONS
-- jwt_access_token_hash / refresh_token_hash = SHA-256 of mock tokens
-- Hashes are CHAR-64 hex placeholders (chain will be re-keyed on first real login)
-- =============================================================

INSERT INTO user_sessions (
    session_id, user_id,
    device_fingerprint, ip_address, network_bssid,
    jwt_access_token_hash, refresh_token_hash,
    access_token_expires_at, refresh_token_expires_at,
    is_active, created_at
) VALUES

( 'a4000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  'fp-admin1-chrome-win11', '192.168.1.10', NULL,
  'a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1',
  'a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1b1',
  '2026-05-01 10:15:00+05', '2026-05-08 10:00:00+05', TRUE,
  '2026-05-01 10:00:00+05' ),

( 'a4000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000002',
  'fp-admin2-chrome-win11', '192.168.1.11', NULL,
  'a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2',
  'a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2b2',
  '2026-05-01 10:15:00+05', '2026-05-08 10:00:00+05', TRUE,
  '2026-05-01 10:00:00+05' ),

( 'b4000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001',
  'fp-buyer-safari-ios17', '203.82.48.100', 'aa:bb:cc:dd:ee:01',
  'b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1',
  'b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1c1',
  '2026-05-01 10:15:00+05', '2026-05-08 10:00:00+05', TRUE,
  '2026-05-01 10:00:00+05' ),

( 's4000000-0000-4000-8000-000000000001',
  's0000000-0000-4000-8000-000000000001',
  'fp-seller-chrome-android', '39.57.142.200', 'aa:bb:cc:dd:ee:02',
  's1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1',
  's1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1c1',
  '2026-05-01 10:15:00+05', '2026-05-08 10:00:00+05', TRUE,
  '2026-05-01 10:00:00+05' );

-- Fix: seller session hash must be valid hex (replace 's' with 'c')
UPDATE user_sessions SET
    jwt_access_token_hash = 'c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1',
    refresh_token_hash    = 'c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1d1'
WHERE session_id = 's4000000-0000-4000-8000-000000000001';


-- =============================================================
-- SECTION 3 — KYC RECORDS
-- =============================================================

INSERT INTO kyc_records (
    kyc_id, user_id,
    cnic_verified_at, ntn_verified_at, ntn_status,
    biometric_hash_sha256, verification_source, iban, updated_at
) VALUES

( 'a2000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  '2026-01-01 09:10:00+05', NULL, 'UNVERIFIED',
  'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  'MOCK', NULL, '2026-01-01 09:10:00+05' ),

( 'a2000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000002',
  '2026-01-01 09:15:00+05', NULL, 'UNVERIFIED',
  'a2b3c4d5e6f7a2b3c4d5e6f7a2b3c4d5e6f7a2b3c4d5e6f7a2b3c4d5e6f7a2b3',
  'MOCK', NULL, '2026-01-01 09:15:00+05' ),

-- Buyer — CNIC verified, NTN not required (below Rs.100k)
( 'b2000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001',
  '2026-02-15 14:45:00+05', NULL, 'UNVERIFIED',
  'b1c2d3e4f5a6b1c2d3e4f5a6b1c2d3e4f5a6b1c2d3e4f5a6b1c2d3e4f5a6b1c2',
  'MOCK',
  'PK36SCBL0000001123456702',  -- mock IBAN
  '2026-02-15 14:45:00+05' ),

-- Seller — FULL KYC with NTN (FILER)
( 's2000000-0000-4000-8000-000000000001',
  's0000000-0000-4000-8000-000000000001',
  '2026-01-20 11:15:00+05',
  '2026-01-20 11:30:00+05',  -- NTN verified
  'FILER',
  'c1d2e3f4a5b6c1d2e3f4a5b6c1d2e3f4a5b6c1d2e3f4a5b6c1d2e3f4a5b6c1d2',
  'MOCK',
  'PK36SCBL0000001123456703',
  '2026-01-20 11:30:00+05' );


-- =============================================================
-- SECTION 4 — PENALTY CONSENT RECORDS
-- Required before any account reaches FULL_ACTIVE
-- =============================================================

INSERT INTO penalty_consent_records (
    consent_id, user_id, policy_version,
    acknowledged_at, ip_at_consent, device_fingerprint_at_consent
) VALUES

( 'a3000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  'GPR-v1.0', '2026-01-01 09:10:00+05',
  '192.168.1.10', 'fp-admin1-chrome-win11' ),

( 'a3000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000002',
  'GPR-v1.0', '2026-01-01 09:15:00+05',
  '192.168.1.11', 'fp-admin2-chrome-win11' ),

( 'b3000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001',
  'GPR-v1.0', '2026-02-15 14:46:00+05',
  '203.82.48.100', 'fp-buyer-safari-ios17' ),

( 's3000000-0000-4000-8000-000000000001',
  's0000000-0000-4000-8000-000000000001',
  'GPR-v1.0', '2026-01-20 11:16:00+05',
  '39.57.142.200', 'fp-seller-chrome-android' );


-- =============================================================
-- SECTION 5 — WALLETS
-- INVARIANT-01: available + reserved + locked = total_deposited
-- =============================================================

INSERT INTO wallets (
    wallet_id, user_id,
    available_paisa, reserved_paisa, locked_paisa,
    total_deposited_paisa, daily_escrow_exposure_paisa,
    updated_at
) VALUES

-- Admin 1 wallet (zero balance — admins don't transact)
( 'a1000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  0, 0, 0, 0, 0, '2026-01-01 09:00:00+05' ),

-- Admin 2 wallet
( 'a1000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000002',
  0, 0, 0, 0, 0, '2026-01-01 09:00:00+05' ),

-- Buyer wallet — Rs.500,000 deposited, two escrows locked
-- locked = 22,440,000 (iPhone 14) + 15,300,000 (iPhone 13) = 37,740,000
-- available = 50,000,000 − 37,740,000 = 12,260,000
-- CHECK: 12,260,000 + 0 + 37,740,000 = 50,000,000 ✓
( 'b1000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001',
  12260000, 0, 37740000, 50000000,
  37740000,   -- daily_escrow_exposure (both locks within 24h for demo)
  '2026-04-30 18:00:00+05' ),

-- Seller wallet — Rs.80,000 available from previous activity
-- CHECK: 8,000,000 + 0 + 0 = 8,000,000 ✓
( 's1000000-0000-4000-8000-000000000001',
  's0000000-0000-4000-8000-000000000001',
  8000000, 0, 0, 8000000, 0,
  '2026-04-28 18:00:00+05' );


-- =============================================================
-- SECTION 6 — LISTINGS
-- Trigger fn_listing_ntn_required fires on INSERT and sets ntn_required.
-- Trigger fn_listing_search_vector fires on INSERT and sets search_vector.
-- =============================================================

INSERT INTO listings (
    listing_id, seller_id, category,
    imei, make, model, storage_gb, color_variant,
    condition_rating, reserve_price_paisa, reserve_price_visible,
    category_metadata, pta_status, status,
    resubmission_count, created_at, published_at, expires_at
) VALUES

-- Listing 1: iPhone 14 Pro — VERIFIED, SOLD (auction closed, S4_LOCKED)
( 'l0000001-0000-4000-8000-000000000001',
  's0000000-0000-4000-8000-000000000001',
  'SMARTPHONE',
  '490154203237518',          -- Luhn ✓, mock DIRBS → REGISTERED_CLEAN
  'Apple', 'iPhone 14 Pro',
  256, 'Deep Purple', 9,
  20000000,                   -- reserve Rs.200,000
  TRUE,
  '{"accessories": ["original box", "charger"], "warranty_months": 0}',
  'REGISTERED_CLEAN', 'SOLD',
  0,
  '2026-04-27 10:00:00+05',
  '2026-04-27 11:30:00+05',
  '2026-05-27 11:30:00+05' ),

-- Listing 2: Samsung Galaxy S23 — PENDING_REVIEW (AI timed out → manual review)
( 'l0000001-0000-4000-8000-000000000002',
  's0000000-0000-4000-8000-000000000001',
  'SMARTPHONE',
  '355000000000001',          -- Luhn ✓, mock DIRBS → UNREGISTERED
  'Samsung', 'Galaxy S23',
  128, 'Phantom Black', 7,
  15000000,                   -- reserve Rs.150,000
  TRUE,
  '{"accessories": ["charger only"]}',
  NULL, 'PENDING_REVIEW',
  0,
  '2026-04-29 09:00:00+05',
  NULL, NULL ),

-- Listing 3: iPhone 13 — SOLD (auction closed, S8_ESCROW_DISPUTED)
( 'l0000001-0000-4000-8000-000000000003',
  's0000000-0000-4000-8000-000000000001',
  'SMARTPHONE',
  '354000000000002',          -- Luhn ✓, mock DIRBS → REGISTERED_CLEAN
  'Apple', 'iPhone 13',
  128, 'Midnight', 8,
  12000000,                   -- reserve Rs.120,000
  TRUE,
  '{"accessories": ["charger", "original box"]}',
  'REGISTERED_CLEAN', 'SOLD',
  0,
  '2026-04-24 10:00:00+05',
  '2026-04-24 11:00:00+05',
  '2026-05-24 11:00:00+05' );


-- =============================================================
-- SECTION 7 — LISTING IMAGES
-- raw_metadata_json = mock EXIF data (restricted; AI pipeline only)
-- storage_url = EXIF-stripped public URL
-- =============================================================

INSERT INTO listing_images (
    image_id, listing_id, storage_url, raw_metadata_json,
    uploaded_at, sort_order
) VALUES

( 'li000001-0000-4000-8000-000000000001',
  'l0000001-0000-4000-8000-000000000001',
  '/storage/listings/iphone14pro_001_clean.jpg',
  '{"gps_lat": 33.6844, "gps_lng": 73.0479, "device_timestamp": "2026-04-27T09:45:00+05:00", "make": "Apple", "model": "iPhone 14 Pro"}',
  '2026-04-27 10:05:00+05', 1 ),

( 'li000001-0000-4000-8000-000000000002',
  'l0000001-0000-4000-8000-000000000001',
  '/storage/listings/iphone14pro_002_clean.jpg',
  '{"gps_lat": 33.6844, "gps_lng": 73.0479, "device_timestamp": "2026-04-27T09:46:00+05:00", "make": "Apple", "model": "iPhone 14 Pro"}',
  '2026-04-27 10:05:30+05', 2 ),

( 'li000001-0000-4000-8000-000000000003',
  'l0000001-0000-4000-8000-000000000002',
  '/storage/listings/samsung_s23_001_clean.jpg',
  '{"gps_lat": 33.7294, "gps_lng": 73.0931, "device_timestamp": "2026-04-29T08:50:00+05:00", "make": "Samsung", "model": "Galaxy S23"}',
  '2026-04-29 09:05:00+05', 1 ),

( 'li000001-0000-4000-8000-000000000004',
  'l0000001-0000-4000-8000-000000000003',
  '/storage/listings/iphone13_001_clean.jpg',
  '{"gps_lat": 33.6938, "gps_lng": 73.0652, "device_timestamp": "2026-04-24T09:45:00+05:00", "make": "Apple", "model": "iPhone 13"}',
  '2026-04-24 10:05:00+05', 1 );


-- =============================================================
-- SECTION 8 — LISTING VETTINGS
-- vetting_classification_invariant enforced by CHECK constraint.
-- composite_score_sum enforced by CHECK constraint.
-- =============================================================

INSERT INTO listing_vettings (
    vetting_id, listing_id,
    submitted_at, status, completed_at, timeout_at,
    attempt_count, degraded_to_manual, manual_review_deadline,
    gate1_luhn_pass, gate2_dirbs_result, gate3_tac_match,
    check4_image_score, check5_condition_score, check6_price_score,
    composite_score, classification,
    rejection_reason_code, price_below_market_flag,
    model_version, admin_reviewed_by, admin_reviewed_at
) VALUES

-- iPhone 14 Pro: all 3 gates pass, composite 82 → VERIFIED
-- check4=35, check5=27, check6=20, composite=82 ✓ (>=75 → VERIFIED)
( 'lv000001-0000-4000-8000-000000000001',
  'l0000001-0000-4000-8000-000000000001',
  '2026-04-27 10:05:00+05', 'COMPLETED',
  '2026-04-27 10:05:03+05',              -- completed in 3 seconds
  '2026-04-27 10:05:05+05',              -- timeout_at = submitted + 5s
  1, FALSE, NULL,
  TRUE, 'REGISTERED_CLEAN', TRUE,
  35, 27, 20,
  82,                                    -- composite = 35+27+20 ✓
  'VERIFIED',
  NULL, FALSE,
  'boli-vetting-v1.0.0', NULL, NULL ),

-- Samsung S23: Gate 1 passed, AI service timed out twice → MANUAL_REVIEW_REQUIRED
-- classification must be NULL (status != COMPLETED) ✓
( 'lv000001-0000-4000-8000-000000000002',
  'l0000001-0000-4000-8000-000000000002',
  '2026-04-29 09:05:00+05', 'MANUAL_REVIEW_REQUIRED',
  NULL,                                  -- not completed
  '2026-04-29 09:05:05+05',
  2, TRUE,
  '2026-05-01 09:05:00+05',             -- manual_review_deadline = submitted + 48h
  TRUE, NULL, NULL,                      -- only Gate 1 ran before timeout
  NULL, NULL, NULL,
  NULL,                                  -- no composite (not completed)
  NULL,                                  -- classification NULL ✓ (invariant)
  NULL, NULL,
  'boli-vetting-v1.0.0', NULL, NULL ),

-- iPhone 13: all gates pass, composite 71 → VERIFIED
-- check4=30, check5=24, check6=17, composite=71 ✓ (>=50, <75 → REVIEWED)
-- Actually let's give it VERIFIED (>=75): 36+25+20=81
( 'lv000001-0000-4000-8000-000000000003',
  'l0000001-0000-4000-8000-000000000003',
  '2026-04-24 10:05:00+05', 'COMPLETED',
  '2026-04-24 10:05:04+05',
  '2026-04-24 10:05:05+05',
  1, FALSE, NULL,
  TRUE, 'REGISTERED_CLEAN', TRUE,
  36, 25, 20,
  81,                                    -- composite = 36+25+20 ✓
  'VERIFIED',
  NULL, FALSE,
  'boli-vetting-v1.0.0', NULL, NULL );


-- =============================================================
-- SECTION 9 — AUCTIONS
-- closing_window_start auto-set by trigger fn_auction_closing_window.
-- winner_bid_id set after bids are inserted (UPDATE below).
-- =============================================================

INSERT INTO auctions (
    auction_id, listing_id,
    start_time, end_time,
    reserve_price_paisa, status,
    winner_bid_id, total_bid_count,
    closing_window_start,               -- trigger sets this; we supply a value to satisfy NOT NULL
    closed_at, cancelled_by, cancelled_at
) VALUES

-- Auction 1: iPhone 14 Pro — CLOSED_WITH_BIDS (winner = buyer)
( 'au000001-0000-4000-8000-000000000001',
  'l0000001-0000-4000-8000-000000000001',
  '2026-04-28 12:00:00+05',
  '2026-04-30 12:00:00+05',             -- 48-hour auction
  20000000,                             -- reserve Rs.200,000
  'CLOSED_WITH_BIDS',
  NULL,                                 -- set after bid insert
  3,                                    -- 3 bids placed (only winning bid seeded)
  '2026-04-30 11:59:00+05',             -- end_time - 60s
  '2026-04-30 12:00:00+05',
  NULL, NULL ),

-- Auction 2: iPhone 13 — CLOSED_WITH_BIDS (now disputed)
( 'au000001-0000-4000-8000-000000000002',
  'l0000001-0000-4000-8000-000000000003',
  '2026-04-25 10:00:00+05',
  '2026-04-28 10:00:00+05',
  12000000,                             -- reserve Rs.120,000
  'CLOSED_WITH_BIDS',
  NULL,                                 -- set after bid insert
  2,
  '2026-04-28 09:59:00+05',
  '2026-04-28 10:00:00+05',
  NULL, NULL );


-- =============================================================
-- SECTION 10 — BIDS (winning bids only for seed)
-- =============================================================

INSERT INTO bids (
    bid_id, auction_id, bidder_id,
    amount_paisa, total_with_fee_paisa,
    status, shill_detection_flag,
    idempotency_key, created_at
) VALUES

-- Winning bid: iPhone 14 Pro — Rs.220,000 = 22,000,000 paisa
-- total_with_fee = 22,000,000 × 1.02 = 22,440,000
( 'bd000001-0000-4000-8000-000000000001',
  'au000001-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001',
  22000000, 22440000,
  'WINNING', FALSE,
  'f47ac10b-58cc-4372-a567-000000000001',
  '2026-04-30 10:45:00+05' ),

-- Winning bid: iPhone 13 — Rs.150,000 = 15,000,000 paisa
-- total_with_fee = 15,000,000 × 1.02 = 15,300,000
( 'bd000001-0000-4000-8000-000000000002',
  'au000001-0000-4000-8000-000000000002',
  'b0000000-0000-4000-8000-000000000001',
  15000000, 15300000,
  'WINNING', FALSE,
  'f47ac10b-58cc-4372-a567-000000000002',
  '2026-04-28 08:30:00+05' );

-- Wire winner_bid_id back onto auctions
UPDATE auctions
SET winner_bid_id = 'bd000001-0000-4000-8000-000000000001'
WHERE auction_id  = 'au000001-0000-4000-8000-000000000001';

UPDATE auctions
SET winner_bid_id = 'bd000001-0000-4000-8000-000000000002'
WHERE auction_id  = 'au000001-0000-4000-8000-000000000002';


-- =============================================================
-- SECTION 11 — TRANSACTIONS
-- INVARIANT-02 (structural) enforced by CHECK constraints.
-- money_state machine starts at S4_LOCKED (auction closed → escrow created).
-- =============================================================

INSERT INTO transactions (
    transaction_id,
    auction_id, buyer_id, seller_id, listing_id, winning_bid_id,
    winning_bid_paisa, buyer_total_paisa,
    buyer_fee_paisa, seller_fee_paisa, wht_paisa, ict_tax_paisa,
    seller_net_paisa, platform_revenue_paisa,
    money_state, settlement_hash_sha256,
    created_at, updated_at
) VALUES

-- Transaction 1: iPhone 14 Pro — S4_LOCKED (awaiting meetup)
-- Zero-sum: 21,340,000+220,000+132,000+748,000 = 22,440,000 ✓
-- seller_net: 22,000,000-440,000-220,000 = 21,340,000 ✓
-- platform_revenue: 440,000+440,000-132,000 = 748,000 ✓
( 'tx000001-0000-4000-8000-000000000001',
  'au000001-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001',
  's0000000-0000-4000-8000-000000000001',
  'l0000001-0000-4000-8000-000000000001',
  'bd000001-0000-4000-8000-000000000001',
  22000000, 22440000,
  440000, 440000, 220000, 132000,
  21340000, 748000,
  'S4_LOCKED', NULL,
  '2026-04-30 12:01:00+05',
  '2026-04-30 12:01:00+05' ),

-- Transaction 2: iPhone 13 — S8_ESCROW_DISPUTED
-- Zero-sum: 14,550,000+150,000+90,000+510,000 = 15,300,000 ✓
-- seller_net: 15,000,000-300,000-150,000 = 14,550,000 ✓
-- platform_revenue: 300,000+300,000-90,000 = 510,000 ✓
( 'tx000001-0000-4000-8000-000000000002',
  'au000001-0000-4000-8000-000000000002',
  'b0000000-0000-4000-8000-000000000001',
  's0000000-0000-4000-8000-000000000001',
  'l0000001-0000-4000-8000-000000000003',
  'bd000001-0000-4000-8000-000000000002',
  15000000, 15300000,
  300000, 300000, 150000, 90000,
  14550000, 510000,
  'S8_ESCROW_DISPUTED', NULL,
  '2026-04-28 10:01:00+05',
  '2026-04-30 14:00:00+05' );


-- =============================================================
-- SECTION 12 — LEDGER ENTRIES (audit trail)
-- Hash chain: prev_hash of entry N = curr_hash of entry N-1.
-- Genesis previous_hash = 64 zeros (chain start).
-- Hashes are CEP seed placeholders; Go recomputes real SHA-256.
-- transaction_id IS NULL → zero-sum trigger skipped (CLAUDE.md Section 4).
-- =============================================================

INSERT INTO ledger_entries (
    entry_id, transaction_id, wallet_id, tax_account_id,
    amount_paisa, entry_type, purpose,
    previous_hash_sha256, current_hash_sha256,
    metadata, created_at
) VALUES

-- Entry 1: Buyer deposit Rs.500,000 (admin-funded, no transaction_id)
( 'le000001-0000-4000-8000-000000000001',
  NULL,
  'b1000000-0000-4000-8000-000000000001',
  NULL,
  50000000, 'CREDIT', 'DEPOSIT',
  '0000000000000000000000000000000000000000000000000000000000000000',
  '1111111111111111111111111111111111111111111111111111111111111111',
  '{"funded_by": "admin", "admin_id": "a0000000-0000-4000-8000-000000000001", "note": "CEP demo funding"}',
  '2026-04-27 09:00:00+05' ),

-- Entry 2: Seller prior earnings deposit Rs.80,000
( 'le000001-0000-4000-8000-000000000002',
  NULL,
  's1000000-0000-4000-8000-000000000001',
  NULL,
  8000000, 'CREDIT', 'DEPOSIT',
  '1111111111111111111111111111111111111111111111111111111111111111',
  '2222222222222222222222222222222222222222222222222222222222222222',
  '{"note": "Prior sale proceeds — seed balance"}',
  '2026-04-20 10:00:00+05' ),

-- Entry 3: Buyer BID_RESERVE — iPhone 14 Pro bid reserved
( 'le000001-0000-4000-8000-000000000003',
  NULL,
  'b1000000-0000-4000-8000-000000000001',
  NULL,
  22440000, 'DEBIT', 'BID_RESERVE',
  '2222222222222222222222222222222222222222222222222222222222222222',
  '3333333333333333333333333333333333333333333333333333333333333333',
  '{"bid_id": "bd000001-0000-4000-8000-000000000001", "auction_id": "au000001-0000-4000-8000-000000000001"}',
  '2026-04-30 10:45:00+05' ),

-- Entry 4: Buyer BID_RESERVE — iPhone 13 bid reserved
( 'le000001-0000-4000-8000-000000000004',
  NULL,
  'b1000000-0000-4000-8000-000000000001',
  NULL,
  15300000, 'DEBIT', 'BID_RESERVE',
  '3333333333333333333333333333333333333333333333333333333333333333',
  '4444444444444444444444444444444444444444444444444444444444444444',
  '{"bid_id": "bd000001-0000-4000-8000-000000000002", "auction_id": "au000001-0000-4000-8000-000000000002"}',
  '2026-04-28 08:30:00+05' ),

-- Entry 5: ESCROW_LOCK — iPhone 14 Pro (reserved → locked)
( 'le000001-0000-4000-8000-000000000005',
  NULL,
  'b1000000-0000-4000-8000-000000000001',
  NULL,
  22440000, 'DEBIT', 'ESCROW_LOCK',
  '4444444444444444444444444444444444444444444444444444444444444444',
  '5555555555555555555555555555555555555555555555555555555555555555',
  '{"transaction_id": "tx000001-0000-4000-8000-000000000001", "escrow_id": "es000001-0000-4000-8000-000000000001"}',
  '2026-04-30 12:01:00+05' ),

-- Entry 6: ESCROW_LOCK — iPhone 13 (reserved → locked)
( 'le000001-0000-4000-8000-000000000006',
  NULL,
  'b1000000-0000-4000-8000-000000000001',
  NULL,
  15300000, 'DEBIT', 'ESCROW_LOCK',
  '5555555555555555555555555555555555555555555555555555555555555555',
  '6666666666666666666666666666666666666666666666666666666666666666',
  '{"transaction_id": "tx000001-0000-4000-8000-000000000002", "escrow_id": "es000001-0000-4000-8000-000000000002"}',
  '2026-04-28 10:01:00+05' );


-- =============================================================
-- SECTION 13 — ESCROWS
-- qr_seed_hash / qr_seed_encrypted = mock AES-256-GCM placeholder.
-- iPhone 14: LOCKED (ready for QR generation at meetup).
-- iPhone 13: DISPUTED (no QR was generated before dispute raised).
-- =============================================================

INSERT INTO escrows (
    escrow_id, transaction_id,
    amount_paisa,
    qr_seed_encrypted, qr_seed_ttl_expiry,
    qr_seed_hash, qr_seed_used,
    status, twopc_prepare_at, twopc_commit_at
) VALUES

-- Escrow 1: iPhone 14 Pro — LOCKED, QR not yet generated (awaiting meetup)
( 'es000001-0000-4000-8000-000000000001',
  'tx000001-0000-4000-8000-000000000001',
  22440000,
  NULL, NULL, NULL, FALSE,  -- QR seed generated at meetup by seller after biometric
  'LOCKED', NULL, NULL ),

-- Escrow 2: iPhone 13 — DISPUTED
( 'es000001-0000-4000-8000-000000000002',
  'tx000001-0000-4000-8000-000000000002',
  15300000,
  NULL, NULL, NULL, FALSE,
  'DISPUTED', NULL, NULL );


-- =============================================================
-- SECTION 14 — MEETUP SESSIONS
-- iPhone 14: buyer confirmed, seller confirmed, meetup happening now
-- iPhone 13: both confirmed, meetup occurred but ended in dispute
-- =============================================================

INSERT INTO meetup_sessions (
    meetup_id, transaction_id,
    proposed_location, proposed_time,
    buyer_confirmed_at, seller_confirmed_at, confirmed_at,
    imei_scanned_at, imei_scan_result, dirbs_recheck_result,
    scanned_imei, qr_scanned_at, geolocation_at_scan,
    late_night_warning_shown, duress_activated
) VALUES

-- Meetup 1: iPhone 14 Pro — confirmed, IMEI not yet scanned (scenario in progress)
( 'ms000001-0000-4000-8000-000000000001',
  'tx000001-0000-4000-8000-000000000001',
  '{"lat": 33.6844, "lng": 73.0479, "address": "Centaurus Mall, Islamabad", "placeId": "ChIJk9eEBHn9OTkRfN5xGcHi-GQ"}',
  '2026-05-01 15:00:00+05',
  '2026-04-30 14:00:00+05',  -- buyer confirmed
  '2026-04-30 15:30:00+05',  -- seller confirmed
  '2026-04-30 15:30:00+05',  -- both confirmed → 4h QR window starts
  NULL, 'PENDING', NULL,
  NULL, NULL, NULL,
  FALSE, FALSE ),

-- Meetup 2: iPhone 13 — confirmed, IMEI matched, but dispute raised before QR
-- INVARIANT-08: qr_scanned_at IS NULL (buyer refused to scan) ✓
( 'ms000001-0000-4000-8000-000000000002',
  'tx000001-0000-4000-8000-000000000002',
  '{"lat": 33.7294, "lng": 73.0931, "address": "Giga Mall, Islamabad", "placeId": "ChIJW1aB2_j8OTkRuXOZsFPKXUg"}',
  '2026-04-29 14:00:00+05',
  '2026-04-28 16:00:00+05',
  '2026-04-28 17:00:00+05',
  '2026-04-28 17:00:00+05',
  '2026-04-29 14:15:00+05',  -- IMEI was scanned at meetup
  'MATCH',                   -- IMEI matched
  'CLEAN',                   -- DIRBS re-check at meetup: still clean
  '354000000000002',         -- scanned IMEI = listed IMEI ✓
  NULL,                      -- qr_scanned_at NULL: buyer refused QR → INVARIANT-08 ✓
  NULL,
  FALSE, FALSE );


-- =============================================================
-- SECTION 15 — MEETUP MESSAGES (chat evidence)
-- =============================================================

INSERT INTO meetup_messages (
    message_id, meetup_id, sender_id,
    content, sent_at, is_evidence
) VALUES

-- iPhone 14 Pro meetup chat
( 'mm000001-0000-4000-8000-000000000001',
  'ms000001-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001',
  'Hi, I will be at Centaurus at 3 PM. Blue Toyota Corolla.',
  '2026-04-30 16:00:00+05', FALSE ),

( 'mm000001-0000-4000-8000-000000000002',
  'ms000001-0000-4000-8000-000000000001',
  's0000000-0000-4000-8000-000000000001',
  'Perfect, I will be near the main entrance.',
  '2026-04-30 16:05:00+05', FALSE ),

-- iPhone 13 dispute chat — frozen as evidence (is_evidence = true)
( 'mm000001-0000-4000-8000-000000000003',
  'ms000001-0000-4000-8000-000000000002',
  'b0000000-0000-4000-8000-000000000001',
  'The device condition does not match the listing. Screen has deep scratches. Refusing to scan QR.',
  '2026-04-29 14:20:00+05', TRUE ),

( 'mm000001-0000-4000-8000-000000000004',
  'ms000001-0000-4000-8000-000000000002',
  's0000000-0000-4000-8000-000000000001',
  'The scratches are from the case, the screen itself is fine. This is bad faith.',
  '2026-04-29 14:22:00+05', TRUE );


-- =============================================================
-- SECTION 16 — DISPUTES
-- admin_response_deadline = evidence_frozen_at + 72 hours
-- =============================================================

INSERT INTO disputes (
    dispute_id, transaction_id,
    raised_by, dispute_type, reason,
    evidence_frozen_at, status,
    admin_notes, resolved_at, resolver_id,
    buyer_share_pct, seller_share_pct,
    admin_response_deadline
) VALUES

( 'di000001-0000-4000-8000-000000000001',
  'tx000001-0000-4000-8000-000000000002',
  'BUYER',
  'QR_REFUSAL',
  'Buyer refused to scan QR code claiming item condition does not match listing. Seller conditionRating=8 but buyer states visible screen scratches present. IMEI verified MATCH and DIRBS CLEAN at meetup.',
  '2026-04-29 14:25:00+05',
  'OPEN',
  NULL, NULL, NULL,
  NULL, NULL,
  '2026-05-02 14:25:00+05'   -- 72 hours from evidence_frozen_at
);


-- =============================================================
-- VERIFICATION QUERIES
-- Run after seed to confirm all invariants hold.
-- =============================================================

-- Wallet balance invariant (INVARIANT-01)
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM wallets
    WHERE available_paisa + reserved_paisa + locked_paisa != total_deposited_paisa;

    IF v_count > 0 THEN
        RAISE EXCEPTION 'SEED ERROR: % wallet(s) violate INVARIANT-01', v_count;
    END IF;
    RAISE NOTICE 'INVARIANT-01 OK: all % wallets balance', (SELECT COUNT(*) FROM wallets);
END;
$$;

-- Transaction zero-sum (INVARIANT-02 structural)
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM transactions
    WHERE buyer_total_paisa != seller_net_paisa + wht_paisa + ict_tax_paisa + platform_revenue_paisa;

    IF v_count > 0 THEN
        RAISE EXCEPTION 'SEED ERROR: % transaction(s) violate zero-sum', v_count;
    END IF;
    RAISE NOTICE 'INVARIANT-02 OK: all % transactions are zero-sum', (SELECT COUNT(*) FROM transactions);
END;
$$;

-- Vetting classification invariant
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM listing_vettings
    WHERE (status = 'COMPLETED' AND classification IS NULL)
       OR (status != 'COMPLETED' AND classification IS NOT NULL);

    IF v_count > 0 THEN
        RAISE EXCEPTION 'SEED ERROR: % vetting(s) violate classification invariant', v_count;
    END IF;
    RAISE NOTICE 'Vetting classification invariant OK';
END;
$$;

-- IMEI-QR gate (INVARIANT-08)
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM meetup_sessions
    WHERE qr_scanned_at IS NOT NULL AND imei_scan_result != 'MATCH';

    IF v_count > 0 THEN
        RAISE EXCEPTION 'SEED ERROR: % meetup(s) violate INVARIANT-08', v_count;
    END IF;
    RAISE NOTICE 'INVARIANT-08 OK: IMEI-QR gate holds on all meetup sessions';
END;
$$;

RAISE NOTICE '';
RAISE NOTICE '=== BOLI.PK SEED COMPLETE ===';
RAISE NOTICE 'Users:          4 (2 admin, 1 buyer, 1 seller)';
RAISE NOTICE 'Listings:       3 (1 VERIFIED/SOLD, 1 PENDING_REVIEW, 1 SOLD/disputed)';
RAISE NOTICE 'Auctions:       2 (both CLOSED_WITH_BIDS)';
RAISE NOTICE 'Transactions:   2 (S4_LOCKED, S8_ESCROW_DISPUTED)';
RAISE NOTICE 'Escrows:        2 (LOCKED, DISPUTED)';
RAISE NOTICE 'Disputes:       1 (OPEN, deadline 2026-05-02)';
RAISE NOTICE 'Ledger entries: 6 (audit trail, no tx_id = zero-sum skipped)';
RAISE NOTICE '==============================';

COMMIT;
