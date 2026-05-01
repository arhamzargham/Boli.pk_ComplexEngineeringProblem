-- =============================================================
-- Boli.pk — CEP Demo Seed Data
-- All monetary values in Paisa (BIGINT). No decimals anywhere.
-- Fixed UUIDs — hex chars only (0-9, a-f). No s/l/t/m/x etc.
-- =============================================================
-- UUID prefix legend (all valid hex):
--   a0...  admin users          a1... admin wallets
--   a2...  admin kyc            a3... admin consent       a4... admin sessions
--   b0...  buyer user           b1... buyer wallet
--   b2...  buyer kyc            b3... buyer consent       b4... buyer session
--   c0...  seller user          c1... seller wallet
--   c2...  seller kyc           c3... seller consent      c4... seller session
--   d0...  listings             d1... listing images      d2... listing vettings
--   e0...  auctions             e1... transactions        e2... escrows
--   e3...  meetup sessions      e4... meetup messages     e5... disputes
--   f0...  ledger entries
-- =============================================================
-- SETTLEMENT MATH (verified zero-sum)
-- iPhone 14 Pro  bid Rs.220,000 = 22,000,000 paisa
--   buyer_total=22,440,000  buyer_fee=440,000  seller_fee=440,000
--   wht=220,000  ict=132,000  seller_net=21,340,000  platform=748,000
--   CHECK: 21,340,000+220,000+132,000+748,000 = 22,440,000 ✓
-- iPhone 13      bid Rs.150,000 = 15,000,000 paisa
--   buyer_total=15,300,000  buyer_fee=300,000  seller_fee=300,000
--   wht=150,000  ict=90,000  seller_net=14,550,000  platform=510,000
--   CHECK: 14,550,000+150,000+90,000+510,000 = 15,300,000 ✓
-- Buyer wallet:  locked=37,740,000  avail=12,260,000  total=50,000,000 ✓
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
( 'a0000000-0000-4000-8000-000000000001', 'FULL', 95, 'ADMIN', 'FULL_ACTIVE', 0, 0, 0, 'EN', '2026-01-01 09:00:00+05' ),
( 'a0000000-0000-4000-8000-000000000002', 'FULL', 95, 'ADMIN', 'FULL_ACTIVE', 0, 0, 0, 'EN', '2026-01-01 09:05:00+05' ),
( 'b0000000-0000-4000-8000-000000000001', 'FULL', 72, 'BUYER', 'FULL_ACTIVE', 0, 0, 0, 'UR', '2026-02-15 14:30:00+05' ),
( 'c0000000-0000-4000-8000-000000000001', 'FULL', 88, 'SELLER','FULL_ACTIVE', 0, 0, 2, 'EN', '2026-01-20 11:00:00+05' );

-- duress_pin = bcrypt('123456', cost=10)
UPDATE users SET
    duress_pin     = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    cnic_encrypted = '\xdeadbeef00000000deadbeef00000000deadbeef00000000deadbeef00000001'::BYTEA
WHERE user_id = 'b0000000-0000-4000-8000-000000000001';

UPDATE users SET
    duress_pin     = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    cnic_encrypted = '\xdeadbeef00000000deadbeef00000000deadbeef00000000deadbeef00000002'::BYTEA,
    ntn_encrypted  = '\xdeadbeef00000000deadbeef00000000deadbeef00000000deadbeef0000000a'::BYTEA
WHERE user_id = 'c0000000-0000-4000-8000-000000000001';

UPDATE users SET cnic_encrypted = '\xdeadbeef00000000deadbeef00000000deadbeef00000000deadbeef000000a1'::BYTEA
WHERE user_id = 'a0000000-0000-4000-8000-000000000001';

UPDATE users SET cnic_encrypted = '\xdeadbeef00000000deadbeef00000000deadbeef00000000deadbeef000000a2'::BYTEA
WHERE user_id = 'a0000000-0000-4000-8000-000000000002';

-- =============================================================
-- SECTION 2 — USER SESSIONS
-- jwt/refresh hashes are SHA-256 placeholders (VARCHAR, any chars ok)
-- =============================================================
INSERT INTO user_sessions (
    session_id, user_id, device_fingerprint, ip_address, network_bssid,
    jwt_access_token_hash, refresh_token_hash,
    access_token_expires_at, refresh_token_expires_at,
    is_active, created_at
) VALUES
( 'a4000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
  'fp-admin1-chrome-win11', '192.168.1.10', NULL,
  'a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1',
  'a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1b1',
  '2026-05-01 10:15:00+05', '2026-05-08 10:00:00+05', TRUE, '2026-05-01 10:00:00+05' ),

( 'a4000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002',
  'fp-admin2-chrome-win11', '192.168.1.11', NULL,
  'a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2',
  'a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2b2',
  '2026-05-01 10:15:00+05', '2026-05-08 10:00:00+05', TRUE, '2026-05-01 10:00:00+05' ),

( 'b4000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
  'fp-buyer-safari-ios17', '203.82.48.100', 'aa:bb:cc:dd:ee:01',
  'b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1',
  'b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1c1',
  '2026-05-01 10:15:00+05', '2026-05-08 10:00:00+05', TRUE, '2026-05-01 10:00:00+05' ),

( 'c4000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
  'fp-seller-chrome-android', '39.57.142.200', 'aa:bb:cc:dd:ee:02',
  'c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1',
  'c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1d1',
  '2026-05-01 10:15:00+05', '2026-05-08 10:00:00+05', TRUE, '2026-05-01 10:00:00+05' );

-- =============================================================
-- SECTION 3 — KYC RECORDS
-- =============================================================
INSERT INTO kyc_records (
    kyc_id, user_id, cnic_verified_at, ntn_verified_at, ntn_status,
    biometric_hash_sha256, verification_source, iban, updated_at
) VALUES
( 'a2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
  '2026-01-01 09:10:00+05', NULL, 'UNVERIFIED',
  'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  'MOCK', NULL, '2026-01-01 09:10:00+05' ),

( 'a2000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002',
  '2026-01-01 09:15:00+05', NULL, 'UNVERIFIED',
  'a2b3c4d5e6f7a2b3c4d5e6f7a2b3c4d5e6f7a2b3c4d5e6f7a2b3c4d5e6f7a2b3',
  'MOCK', NULL, '2026-01-01 09:15:00+05' ),

( 'b2000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
  '2026-02-15 14:45:00+05', NULL, 'UNVERIFIED',
  'b1c2d3e4f5a6b1c2d3e4f5a6b1c2d3e4f5a6b1c2d3e4f5a6b1c2d3e4f5a6b1c2',
  'MOCK', 'PK36SCBL0000001123456702', '2026-02-15 14:45:00+05' ),

( 'c2000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
  '2026-01-20 11:15:00+05', '2026-01-20 11:30:00+05', 'FILER',
  'c1d2e3f4a5b6c1d2e3f4a5b6c1d2e3f4a5b6c1d2e3f4a5b6c1d2e3f4a5b6c1d2',
  'MOCK', 'PK36SCBL0000001123456703', '2026-01-20 11:30:00+05' );

-- =============================================================
-- SECTION 4 — PENALTY CONSENT RECORDS
-- =============================================================
INSERT INTO penalty_consent_records (
    consent_id, user_id, policy_version,
    acknowledged_at, ip_at_consent, device_fingerprint_at_consent
) VALUES
( 'a3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
  'GPR-v1.0', '2026-01-01 09:10:00+05', '192.168.1.10',  'fp-admin1-chrome-win11' ),
( 'a3000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002',
  'GPR-v1.0', '2026-01-01 09:15:00+05', '192.168.1.11',  'fp-admin2-chrome-win11' ),
( 'b3000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
  'GPR-v1.0', '2026-02-15 14:46:00+05', '203.82.48.100', 'fp-buyer-safari-ios17' ),
( 'c3000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
  'GPR-v1.0', '2026-01-20 11:16:00+05', '39.57.142.200', 'fp-seller-chrome-android' );

-- =============================================================
-- SECTION 5 — WALLETS (INVARIANT-01 verified inline)
-- =============================================================
INSERT INTO wallets (
    wallet_id, user_id,
    available_paisa, reserved_paisa, locked_paisa,
    total_deposited_paisa, daily_escrow_exposure_paisa, updated_at
) VALUES
( 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
  0, 0, 0, 0, 0, '2026-01-01 09:00:00+05' ),
( 'a1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002',
  0, 0, 0, 0, 0, '2026-01-01 09:00:00+05' ),
-- locked=22,440,000+15,300,000=37,740,000  avail=50,000,000-37,740,000=12,260,000
-- CHECK: 12,260,000+0+37,740,000=50,000,000 ✓
( 'b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
  12260000, 0, 37740000, 50000000, 37740000, '2026-04-30 18:00:00+05' ),
-- CHECK: 8,000,000+0+0=8,000,000 ✓
( 'c1000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
  8000000, 0, 0, 8000000, 0, '2026-04-28 18:00:00+05' );

-- =============================================================
-- SECTION 6 — LISTINGS
-- Triggers fn_listing_ntn_required + fn_listing_search_vector fire on INSERT.
-- =============================================================
INSERT INTO listings (
    listing_id, seller_id, category,
    imei, make, model, storage_gb, color_variant,
    condition_rating, reserve_price_paisa, reserve_price_visible,
    category_metadata, pta_status, status,
    resubmission_count, created_at, published_at, expires_at
) VALUES
-- Listing 1: iPhone 14 Pro — VERIFIED, SOLD
( 'd0000001-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
  'SMARTPHONE', '490154203237518', 'Apple', 'iPhone 14 Pro',
  256, 'Deep Purple', 9, 20000000, TRUE,
  '{"accessories":["original box","charger"],"warranty_months":0}',
  'REGISTERED_CLEAN', 'SOLD', 0,
  '2026-04-27 10:00:00+05', '2026-04-27 11:30:00+05', '2026-05-27 11:30:00+05' ),

-- Listing 2: Samsung Galaxy S23 — PENDING_REVIEW (AI timed out → manual)
( 'd0000001-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001',
  'SMARTPHONE', '355000000000001', 'Samsung', 'Galaxy S23',
  128, 'Phantom Black', 7, 15000000, TRUE,
  '{"accessories":["charger only"]}',
  NULL, 'PENDING_REVIEW', 0,
  '2026-04-29 09:00:00+05', NULL, NULL ),

-- Listing 3: iPhone 13 — SOLD, escrow disputed
( 'd0000001-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001',
  'SMARTPHONE', '354000000000002', 'Apple', 'iPhone 13',
  128, 'Midnight', 8, 12000000, TRUE,
  '{"accessories":["charger","original box"]}',
  'REGISTERED_CLEAN', 'SOLD', 0,
  '2026-04-24 10:00:00+05', '2026-04-24 11:00:00+05', '2026-05-24 11:00:00+05' );

-- =============================================================
-- SECTION 7 — LISTING IMAGES
-- =============================================================
INSERT INTO listing_images (
    image_id, listing_id, storage_url, raw_metadata_json, uploaded_at, sort_order
) VALUES
( 'd1000001-0000-4000-8000-000000000001', 'd0000001-0000-4000-8000-000000000001',
  '/storage/listings/iphone14pro_001_clean.jpg',
  '{"gps_lat":33.6844,"gps_lng":73.0479,"device_timestamp":"2026-04-27T09:45:00+05:00","make":"Apple","model":"iPhone 14 Pro"}',
  '2026-04-27 10:05:00+05', 1 ),
( 'd1000001-0000-4000-8000-000000000002', 'd0000001-0000-4000-8000-000000000001',
  '/storage/listings/iphone14pro_002_clean.jpg',
  '{"gps_lat":33.6844,"gps_lng":73.0479,"device_timestamp":"2026-04-27T09:46:00+05:00","make":"Apple","model":"iPhone 14 Pro"}',
  '2026-04-27 10:05:30+05', 2 ),
( 'd1000001-0000-4000-8000-000000000003', 'd0000001-0000-4000-8000-000000000002',
  '/storage/listings/samsung_s23_001_clean.jpg',
  '{"gps_lat":33.7294,"gps_lng":73.0931,"device_timestamp":"2026-04-29T08:50:00+05:00","make":"Samsung","model":"Galaxy S23"}',
  '2026-04-29 09:05:00+05', 1 ),
( 'd1000001-0000-4000-8000-000000000004', 'd0000001-0000-4000-8000-000000000003',
  '/storage/listings/iphone13_001_clean.jpg',
  '{"gps_lat":33.6938,"gps_lng":73.0652,"device_timestamp":"2026-04-24T09:45:00+05:00","make":"Apple","model":"iPhone 13"}',
  '2026-04-24 10:05:00+05', 1 );

-- =============================================================
-- SECTION 8 — LISTING VETTINGS
-- classification invariant and composite_score_sum CHECKs enforced by DB.
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
-- iPhone 14 Pro: all gates pass, composite 82 → VERIFIED (>=75)
-- 35+27+20=82 ✓
( 'd2000001-0000-4000-8000-000000000001', 'd0000001-0000-4000-8000-000000000001',
  '2026-04-27 10:05:00+05', 'COMPLETED', '2026-04-27 10:05:03+05', '2026-04-27 10:05:05+05',
  1, FALSE, NULL, TRUE, 'REGISTERED_CLEAN', TRUE,
  35, 27, 20, 82, 'VERIFIED', NULL, FALSE,
  'boli-vetting-v1.0.0', NULL, NULL ),

-- Samsung S23: Gate 1 passed, timed out twice → MANUAL_REVIEW_REQUIRED
-- classification must be NULL (status != COMPLETED) ✓
( 'd2000001-0000-4000-8000-000000000002', 'd0000001-0000-4000-8000-000000000002',
  '2026-04-29 09:05:00+05', 'MANUAL_REVIEW_REQUIRED', NULL, '2026-04-29 09:05:05+05',
  2, TRUE, '2026-05-01 09:05:00+05',
  TRUE, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  'boli-vetting-v1.0.0', NULL, NULL ),

-- iPhone 13: all gates pass, composite 81 → VERIFIED
-- 36+25+20=81 ✓
( 'd2000001-0000-4000-8000-000000000003', 'd0000001-0000-4000-8000-000000000003',
  '2026-04-24 10:05:00+05', 'COMPLETED', '2026-04-24 10:05:04+05', '2026-04-24 10:05:05+05',
  1, FALSE, NULL, TRUE, 'REGISTERED_CLEAN', TRUE,
  36, 25, 20, 81, 'VERIFIED', NULL, FALSE,
  'boli-vetting-v1.0.0', NULL, NULL );

-- =============================================================
-- SECTION 9 — AUCTIONS (winner_bid_id set after bids)
-- closing_window_start auto-set by trigger fn_auction_closing_window.
-- =============================================================
INSERT INTO auctions (
    auction_id, listing_id,
    start_time, end_time, reserve_price_paisa, status,
    winner_bid_id, total_bid_count, closing_window_start,
    closed_at, cancelled_by, cancelled_at
) VALUES
( 'e0000001-0000-4000-8000-000000000001', 'd0000001-0000-4000-8000-000000000001',
  '2026-04-28 12:00:00+05', '2026-04-30 12:00:00+05', 20000000, 'CLOSED_WITH_BIDS',
  NULL, 3, '2026-04-30 11:59:00+05', '2026-04-30 12:00:00+05', NULL, NULL ),

( 'e0000001-0000-4000-8000-000000000002', 'd0000001-0000-4000-8000-000000000003',
  '2026-04-25 10:00:00+05', '2026-04-28 10:00:00+05', 12000000, 'CLOSED_WITH_BIDS',
  NULL, 2, '2026-04-28 09:59:00+05', '2026-04-28 10:00:00+05', NULL, NULL );

-- =============================================================
-- SECTION 10 — BIDS
-- =============================================================
INSERT INTO bids (
    bid_id, auction_id, bidder_id,
    amount_paisa, total_with_fee_paisa,
    status, shill_detection_flag, idempotency_key, created_at
) VALUES
-- iPhone 14 Pro winning bid: Rs.220,000 → total 22,440,000
( 'bd000001-0000-4000-8000-000000000001', 'e0000001-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001',
  22000000, 22440000, 'WINNING', FALSE,
  'f47ac10b-58cc-4372-a567-000000000001', '2026-04-30 10:45:00+05' ),

-- iPhone 13 winning bid: Rs.150,000 → total 15,300,000
( 'bd000001-0000-4000-8000-000000000002', 'e0000001-0000-4000-8000-000000000002',
  'b0000000-0000-4000-8000-000000000001',
  15000000, 15300000, 'WINNING', FALSE,
  'f47ac10b-58cc-4372-a567-000000000002', '2026-04-28 08:30:00+05' );

-- Wire winner_bid_id back onto auctions now that bids exist
UPDATE auctions SET winner_bid_id = 'bd000001-0000-4000-8000-000000000001'
WHERE auction_id = 'e0000001-0000-4000-8000-000000000001';

UPDATE auctions SET winner_bid_id = 'bd000001-0000-4000-8000-000000000002'
WHERE auction_id = 'e0000001-0000-4000-8000-000000000002';

-- =============================================================
-- SECTION 11 — TRANSACTIONS (zero-sum CHECK enforced by DB)
-- =============================================================
INSERT INTO transactions (
    transaction_id, auction_id, buyer_id, seller_id, listing_id, winning_bid_id,
    winning_bid_paisa, buyer_total_paisa,
    buyer_fee_paisa, seller_fee_paisa, wht_paisa, ict_tax_paisa,
    seller_net_paisa, platform_revenue_paisa,
    money_state, settlement_hash_sha256, created_at, updated_at
) VALUES
-- iPhone 14 Pro — S4_LOCKED
( 'e1000001-0000-4000-8000-000000000001',
  'e0000001-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000001',
  'd0000001-0000-4000-8000-000000000001',
  'bd000001-0000-4000-8000-000000000001',
  22000000, 22440000, 440000, 440000, 220000, 132000, 21340000, 748000,
  'S4_LOCKED', NULL, '2026-04-30 12:01:00+05', '2026-04-30 12:01:00+05' ),

-- iPhone 13 — S8_ESCROW_DISPUTED
( 'e1000001-0000-4000-8000-000000000002',
  'e0000001-0000-4000-8000-000000000002',
  'b0000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000001',
  'd0000001-0000-4000-8000-000000000003',
  'bd000001-0000-4000-8000-000000000002',
  15000000, 15300000, 300000, 300000, 150000, 90000, 14550000, 510000,
  'S8_ESCROW_DISPUTED', NULL, '2026-04-28 10:01:00+05', '2026-04-30 14:00:00+05' );

-- =============================================================
-- SECTION 12 — LEDGER ENTRIES (audit trail, all transaction_id=NULL)
-- Zero-sum deferred trigger skips entries where transaction_id IS NULL.
-- Hash chain: prev_hash of entry N = curr_hash of entry N-1.
-- Hashes are seed placeholders; Go recomputes real SHA-256.
-- =============================================================
INSERT INTO ledger_entries (
    entry_id, transaction_id, wallet_id, tax_account_id,
    amount_paisa, entry_type, purpose,
    previous_hash_sha256, current_hash_sha256,
    metadata, created_at
) VALUES
( 'f0000001-0000-4000-8000-000000000001', NULL,
  'b1000000-0000-4000-8000-000000000001', NULL,
  50000000, 'CREDIT', 'DEPOSIT',
  '0000000000000000000000000000000000000000000000000000000000000000',
  '1111111111111111111111111111111111111111111111111111111111111111',
  '{"funded_by":"admin","admin_id":"a0000000-0000-4000-8000-000000000001"}',
  '2026-04-27 09:00:00+05' ),

( 'f0000001-0000-4000-8000-000000000002', NULL,
  'c1000000-0000-4000-8000-000000000001', NULL,
  8000000, 'CREDIT', 'DEPOSIT',
  '1111111111111111111111111111111111111111111111111111111111111111',
  '2222222222222222222222222222222222222222222222222222222222222222',
  '{"note":"Prior sale proceeds — seed balance"}',
  '2026-04-20 10:00:00+05' ),

( 'f0000001-0000-4000-8000-000000000003', NULL,
  'b1000000-0000-4000-8000-000000000001', NULL,
  22440000, 'DEBIT', 'BID_RESERVE',
  '2222222222222222222222222222222222222222222222222222222222222222',
  '3333333333333333333333333333333333333333333333333333333333333333',
  '{"bid_id":"bd000001-0000-4000-8000-000000000001","auction_id":"e0000001-0000-4000-8000-000000000001"}',
  '2026-04-30 10:45:00+05' ),

( 'f0000001-0000-4000-8000-000000000004', NULL,
  'b1000000-0000-4000-8000-000000000001', NULL,
  15300000, 'DEBIT', 'BID_RESERVE',
  '3333333333333333333333333333333333333333333333333333333333333333',
  '4444444444444444444444444444444444444444444444444444444444444444',
  '{"bid_id":"bd000001-0000-4000-8000-000000000002","auction_id":"e0000001-0000-4000-8000-000000000002"}',
  '2026-04-28 08:30:00+05' ),

( 'f0000001-0000-4000-8000-000000000005', NULL,
  'b1000000-0000-4000-8000-000000000001', NULL,
  22440000, 'DEBIT', 'ESCROW_LOCK',
  '4444444444444444444444444444444444444444444444444444444444444444',
  '5555555555555555555555555555555555555555555555555555555555555555',
  '{"transaction_id":"e1000001-0000-4000-8000-000000000001","escrow_id":"e2000001-0000-4000-8000-000000000001"}',
  '2026-04-30 12:01:00+05' ),

( 'f0000001-0000-4000-8000-000000000006', NULL,
  'b1000000-0000-4000-8000-000000000001', NULL,
  15300000, 'DEBIT', 'ESCROW_LOCK',
  '5555555555555555555555555555555555555555555555555555555555555555',
  '6666666666666666666666666666666666666666666666666666666666666666',
  '{"transaction_id":"e1000001-0000-4000-8000-000000000002","escrow_id":"e2000001-0000-4000-8000-000000000002"}',
  '2026-04-28 10:01:00+05' );

-- =============================================================
-- SECTION 13 — ESCROWS
-- =============================================================
INSERT INTO escrows (
    escrow_id, transaction_id, amount_paisa,
    qr_seed_encrypted, qr_seed_ttl_expiry, qr_seed_hash, qr_seed_used,
    status, twopc_prepare_at, twopc_commit_at
) VALUES
( 'e2000001-0000-4000-8000-000000000001', 'e1000001-0000-4000-8000-000000000001',
  22440000, NULL, NULL, NULL, FALSE, 'LOCKED', NULL, NULL ),
( 'e2000001-0000-4000-8000-000000000002', 'e1000001-0000-4000-8000-000000000002',
  15300000, NULL, NULL, NULL, FALSE, 'DISPUTED', NULL, NULL );

-- =============================================================
-- SECTION 14 — MEETUP SESSIONS
-- =============================================================
INSERT INTO meetup_sessions (
    meetup_id, transaction_id,
    proposed_location, proposed_time,
    buyer_confirmed_at, seller_confirmed_at, confirmed_at,
    imei_scanned_at, imei_scan_result, dirbs_recheck_result,
    scanned_imei, qr_scanned_at, geolocation_at_scan,
    late_night_warning_shown, duress_activated
) VALUES
-- iPhone 14: confirmed, IMEI not yet scanned (demo ready to proceed)
( 'e3000001-0000-4000-8000-000000000001', 'e1000001-0000-4000-8000-000000000001',
  '{"lat":33.6844,"lng":73.0479,"address":"Centaurus Mall, Islamabad","placeId":"ChIJk9eEBHn9OTkRfN5xGcHi-GQ"}',
  '2026-05-01 15:00:00+05',
  '2026-04-30 14:00:00+05', '2026-04-30 15:30:00+05', '2026-04-30 15:30:00+05',
  NULL, 'PENDING', NULL, NULL, NULL, NULL, FALSE, FALSE ),

-- iPhone 13: IMEI matched, QR refused → dispute raised
-- INVARIANT-08: qr_scanned_at IS NULL ✓ (imei_scan_result=MATCH but buyer refused QR)
( 'e3000001-0000-4000-8000-000000000002', 'e1000001-0000-4000-8000-000000000002',
  '{"lat":33.7294,"lng":73.0931,"address":"Giga Mall, Islamabad","placeId":"ChIJW1aB2_j8OTkRuXOZsFPKXUg"}',
  '2026-04-29 14:00:00+05',
  '2026-04-28 16:00:00+05', '2026-04-28 17:00:00+05', '2026-04-28 17:00:00+05',
  '2026-04-29 14:15:00+05', 'MATCH', 'CLEAN',
  '354000000000002', NULL, NULL, FALSE, FALSE );

-- =============================================================
-- SECTION 15 — MEETUP MESSAGES
-- =============================================================
INSERT INTO meetup_messages (message_id, meetup_id, sender_id, content, sent_at, is_evidence)
VALUES
( 'e4000001-0000-4000-8000-000000000001', 'e3000001-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001',
  'Hi, I will be at Centaurus at 3 PM. Blue Toyota Corolla.',
  '2026-04-30 16:00:00+05', FALSE ),
( 'e4000001-0000-4000-8000-000000000002', 'e3000001-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000001',
  'Perfect, I will be near the main entrance.',
  '2026-04-30 16:05:00+05', FALSE ),
-- Evidence messages (frozen — trigger blocks further edits)
( 'e4000001-0000-4000-8000-000000000003', 'e3000001-0000-4000-8000-000000000002',
  'b0000000-0000-4000-8000-000000000001',
  'The device condition does not match the listing. Screen has deep scratches. Refusing to scan QR.',
  '2026-04-29 14:20:00+05', TRUE ),
( 'e4000001-0000-4000-8000-000000000004', 'e3000001-0000-4000-8000-000000000002',
  'c0000000-0000-4000-8000-000000000001',
  'The scratches are from the case, the screen itself is fine. This is bad faith.',
  '2026-04-29 14:22:00+05', TRUE );

-- =============================================================
-- SECTION 16 — DISPUTES
-- =============================================================
INSERT INTO disputes (
    dispute_id, transaction_id,
    raised_by, dispute_type, reason,
    evidence_frozen_at, status,
    admin_notes, resolved_at, resolver_id,
    buyer_share_pct, seller_share_pct,
    admin_response_deadline
) VALUES
( 'e5000001-0000-4000-8000-000000000001', 'e1000001-0000-4000-8000-000000000002',
  'BUYER', 'QR_REFUSAL',
  'Buyer refused QR claiming item condition mismatch. IMEI verified MATCH and DIRBS CLEAN at meetup. Seller conditionRating=8 but buyer states visible screen scratches.',
  '2026-04-29 14:25:00+05', 'OPEN',
  NULL, NULL, NULL, NULL, NULL,
  '2026-05-02 14:25:00+05' );

-- =============================================================
-- VERIFICATION BLOCKS
-- =============================================================
DO $$
DECLARE v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM wallets
    WHERE available_paisa + reserved_paisa + locked_paisa != total_deposited_paisa;
    IF v_count > 0 THEN
        RAISE EXCEPTION 'SEED: % wallet(s) violate INVARIANT-01', v_count;
    END IF;
    RAISE NOTICE 'INVARIANT-01 OK: all wallets balance';
END; $$;

DO $$
DECLARE v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM transactions
    WHERE buyer_total_paisa != seller_net_paisa + wht_paisa + ict_tax_paisa + platform_revenue_paisa;
    IF v_count > 0 THEN
        RAISE EXCEPTION 'SEED: % transaction(s) fail zero-sum', v_count;
    END IF;
    RAISE NOTICE 'INVARIANT-02 OK: all transactions zero-sum';
END; $$;

DO $$
DECLARE v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM listing_vettings
    WHERE (status = 'COMPLETED' AND classification IS NULL)
       OR (status != 'COMPLETED' AND classification IS NOT NULL);
    IF v_count > 0 THEN
        RAISE EXCEPTION 'SEED: % vetting(s) violate classification invariant', v_count;
    END IF;
    RAISE NOTICE 'Vetting classification invariant OK';
END; $$;

DO $$
DECLARE v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM meetup_sessions
    WHERE qr_scanned_at IS NOT NULL AND imei_scan_result != 'MATCH';
    IF v_count > 0 THEN
        RAISE EXCEPTION 'SEED: % meetup(s) violate INVARIANT-08', v_count;
    END IF;
    RAISE NOTICE 'INVARIANT-08 OK: IMEI-QR gate holds';
END; $$;

DO $$
BEGIN
    RAISE NOTICE '=== BOLI.PK SEED COMPLETE ===';
    RAISE NOTICE 'Users: 4  Wallets: 4  Listings: 3  Auctions: 2';
    RAISE NOTICE 'Transactions: 2 (S4_LOCKED + S8_ESCROW_DISPUTED)';
    RAISE NOTICE 'Escrows: 2  Disputes: 1 (OPEN)  Ledger: 6 entries';
END; $$;

COMMIT;
