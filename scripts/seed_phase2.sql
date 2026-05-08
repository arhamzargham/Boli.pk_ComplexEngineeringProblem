-- =============================================================
-- Boli.pk — Phase 2 Seed Data
-- Run with: scripts/seed_phase2.bat  OR  scripts/seed_phase2.ps1
-- Safe to run multiple times — all INSERTs use ON CONFLICT DO NOTHING
-- =============================================================
-- UUID prefixes used here (all valid hex chars 0-9, a-f):
--   a0000001-...-001  Galaxy A54 listing (may already exist from manual seed)
--   a0000002-...-002  iPhone 14 Pro listing (new ACTIVE)
--   a0000003-...-003  OnePlus 12 listing (new ACTIVE)
--   a0000004-...-004  Samsung Galaxy S23 listing (new ACTIVE)
--   b0000001-...-001  Galaxy A54 vetting
--   b0000002-...-002  iPhone 14 Pro vetting
--   b0000003-...-003  OnePlus 12 vetting
--   b0000004-...-004  Samsung Galaxy S23 vetting
--   e1000001-...-001  Galaxy A54 auction     (e1 prefix avoids conflict with Phase 1)
--   e1000002-...-002  iPhone 14 Pro auction
--   e1000003-...-003  OnePlus 12 auction
--   e1000004-...-004  Samsung Galaxy S23 auction
-- =============================================================

BEGIN;

-- =============================================================
-- LISTINGS
-- =============================================================

-- Listing 1: Samsung Galaxy A54 — ACTIVE
-- May already exist from manual Phase 1 seed; ON CONFLICT DO NOTHING is safe.
INSERT INTO listings (
    listing_id, seller_id, category,
    imei, make, model, storage_gb, color_variant,
    condition_rating, reserve_price_paisa, reserve_price_visible,
    category_metadata, pta_status, status,
    resubmission_count, created_at, published_at, expires_at
) VALUES (
    'a0000001-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000001',
    'SMARTPHONE',
    '356938035643809',
    'Samsung', 'Galaxy A54',
    128, 'Awesome Black',
    8, 8500000, TRUE,
    '{"accessories":["charger"]}',
    'REGISTERED_CLEAN', 'ACTIVE',
    0,
    '2026-05-01 10:00:00+05',
    '2026-05-01 10:30:00+05',
    '2026-05-31 10:30:00+05'
) ON CONFLICT (listing_id) DO NOTHING;

-- Listing 2: Apple iPhone 14 Pro — ACTIVE, VERIFIED (composite 86)
INSERT INTO listings (
    listing_id, seller_id, category,
    imei, make, model, storage_gb, color_variant,
    condition_rating, reserve_price_paisa, reserve_price_visible,
    category_metadata, pta_status, status,
    resubmission_count, created_at, published_at, expires_at
) VALUES (
    'a0000002-0000-4000-8000-000000000002',
    'c0000000-0000-4000-8000-000000000001',
    'SMARTPHONE',
    '353288085588918',
    'Apple', 'iPhone 14 Pro',
    256, 'Deep Purple',
    9, 27500000, TRUE,
    '{"accessories":["original box","charger","original cable"]}',
    'REGISTERED_CLEAN', 'ACTIVE',
    0,
    '2026-05-02 11:00:00+05',
    '2026-05-02 11:30:00+05',
    '2026-06-01 11:30:00+05'
) ON CONFLICT (listing_id) DO NOTHING;

-- Listing 3: OnePlus 12 — ACTIVE, REVIEWED (composite 68)
INSERT INTO listings (
    listing_id, seller_id, category,
    imei, make, model, storage_gb, color_variant,
    condition_rating, reserve_price_paisa, reserve_price_visible,
    category_metadata, pta_status, status,
    resubmission_count, created_at, published_at, expires_at
) VALUES (
    'a0000003-0000-4000-8000-000000000003',
    'c0000000-0000-4000-8000-000000000001',
    'SMARTPHONE',
    '357782069443604',
    'OnePlus', '12',
    256, 'Silky Black',
    8, 18500000, TRUE,
    '{"accessories":["charger","original box"]}',
    'REGISTERED_CLEAN', 'ACTIVE',
    0,
    '2026-05-03 09:00:00+05',
    '2026-05-03 09:30:00+05',
    '2026-06-02 09:30:00+05'
) ON CONFLICT (listing_id) DO NOTHING;

-- Listing 4: Samsung Galaxy S23 — ACTIVE, REVIEWED (composite 58), UNREGISTERED PTA
-- Intentional: demonstrates REVIEWED badge ≠ clean PTA status.
INSERT INTO listings (
    listing_id, seller_id, category,
    imei, make, model, storage_gb, color_variant,
    condition_rating, reserve_price_paisa, reserve_price_visible,
    category_metadata, pta_status, status,
    resubmission_count, created_at, published_at, expires_at
) VALUES (
    'a0000004-0000-4000-8000-000000000004',
    'c0000000-0000-4000-8000-000000000001',
    'SMARTPHONE',
    '354688057924208',
    'Samsung', 'Galaxy S23',
    128, 'Phantom Black',
    7, 15500000, TRUE,
    '{"accessories":["charger only"]}',
    'UNREGISTERED', 'ACTIVE',
    0,
    '2026-05-04 14:00:00+05',
    '2026-05-04 14:30:00+05',
    '2026-06-03 14:30:00+05'
) ON CONFLICT (listing_id) DO NOTHING;

-- =============================================================
-- LISTING VETTINGS
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

-- Galaxy A54: REVIEWED (composite 65, >= 50)
(
    'b0000001-0000-4000-8000-000000000001',
    'a0000001-0000-4000-8000-000000000001',
    '2026-05-01 10:05:00+05', 'COMPLETED', '2026-05-01 10:05:03+05',
    '2026-05-01 10:05:05+05',
    1, FALSE, NULL,
    TRUE, 'REGISTERED_CLEAN', TRUE,
    28, 22, 15, 65, 'REVIEWED',
    NULL, FALSE, 'boli-vetting-v1.0.0', NULL, NULL
),

-- iPhone 14 Pro: VERIFIED (composite 86, >= 75)
(
    'b0000002-0000-4000-8000-000000000002',
    'a0000002-0000-4000-8000-000000000002',
    '2026-05-02 11:05:00+05', 'COMPLETED', '2026-05-02 11:05:02+05',
    '2026-05-02 11:05:05+05',
    1, FALSE, NULL,
    TRUE, 'REGISTERED_CLEAN', TRUE,
    38, 28, 20, 86, 'VERIFIED',
    NULL, FALSE, 'boli-vetting-v1.0.0', NULL, NULL
),

-- OnePlus 12: REVIEWED (composite 68, >= 50 but < 75)
(
    'b0000003-0000-4000-8000-000000000003',
    'a0000003-0000-4000-8000-000000000003',
    '2026-05-03 09:05:00+05', 'COMPLETED', '2026-05-03 09:05:03+05',
    '2026-05-03 09:05:05+05',
    1, FALSE, NULL,
    TRUE, 'REGISTERED_CLEAN', TRUE,
    30, 22, 16, 68, 'REVIEWED',
    NULL, FALSE, 'boli-vetting-v1.0.0', NULL, NULL
),

-- Galaxy S23: REVIEWED (composite 58, >= 50 but < 75; UNREGISTERED PTA)
(
    'b0000004-0000-4000-8000-000000000004',
    'a0000004-0000-4000-8000-000000000004',
    '2026-05-04 14:05:00+05', 'COMPLETED', '2026-05-04 14:05:04+05',
    '2026-05-04 14:05:05+05',
    1, FALSE, NULL,
    TRUE, 'UNREGISTERED', TRUE,
    26, 18, 14, 58, 'REVIEWED',
    NULL, FALSE, 'boli-vetting-v1.0.0', NULL, NULL
)

ON CONFLICT (vetting_id) DO NOTHING;

-- =============================================================
-- AUCTIONS
-- Auction IDs use e1 prefix to avoid UUID conflicts with
-- Phase 1 seed auctions (e0000001-...) which are CLOSED_WITH_BIDS.
-- Frontend derives auction IDs via: 'e1' + listingId.slice(2)
-- =============================================================

INSERT INTO auctions (
    auction_id, listing_id,
    start_time, end_time,
    closing_window_start,
    reserve_price_paisa, status,
    total_bid_count,
    winner_bid_id, closed_at, cancelled_by, cancelled_at
) VALUES

-- Galaxy A54: ends in ~22h from now
(
    'e1000001-0000-4000-8000-000000000001',
    'a0000001-0000-4000-8000-000000000001',
    NOW() - INTERVAL '2 hours',
    NOW() + INTERVAL '22 hours',
    NOW() + INTERVAL '22 hours' - INTERVAL '5 minutes',
    8500000, 'ACTIVE',
    0,
    NULL, NULL, NULL, NULL
),

-- iPhone 14 Pro: ends in ~46h from now
(
    'e1000002-0000-4000-8000-000000000002',
    'a0000002-0000-4000-8000-000000000002',
    NOW() - INTERVAL '2 hours',
    NOW() + INTERVAL '46 hours',
    NOW() + INTERVAL '46 hours' - INTERVAL '5 minutes',
    27500000, 'ACTIVE',
    0,
    NULL, NULL, NULL, NULL
),

-- OnePlus 12: ends in ~34h from now
(
    'e1000003-0000-4000-8000-000000000003',
    'a0000003-0000-4000-8000-000000000003',
    NOW() - INTERVAL '2 hours',
    NOW() + INTERVAL '34 hours',
    NOW() + INTERVAL '34 hours' - INTERVAL '5 minutes',
    18500000, 'ACTIVE',
    0,
    NULL, NULL, NULL, NULL
),

-- Galaxy S23: ends in ~10h from now (soonest — creates urgency for demo)
(
    'e1000004-0000-4000-8000-000000000004',
    'a0000004-0000-4000-8000-000000000004',
    NOW() - INTERVAL '2 hours',
    NOW() + INTERVAL '10 hours',
    NOW() + INTERVAL '10 hours' - INTERVAL '5 minutes',
    15500000, 'ACTIVE',
    0,
    NULL, NULL, NULL, NULL
)

ON CONFLICT (auction_id) DO NOTHING;

COMMIT;

-- =============================================================
-- VERIFICATION QUERY — confirm seed succeeded
-- =============================================================
SELECT
    l.listing_id,
    l.make || ' ' || l.model                          AS device,
    l.status                                          AS listing_status,
    lv.classification                                 AS vetting,
    lv.composite_score                                AS score,
    l.pta_status,
    a.auction_id,
    a.status                                          AS auction_status,
    to_char(a.end_time, 'YYYY-MM-DD HH24:MI TZ')     AS ends_at
FROM listings l
LEFT JOIN listing_vettings lv
       ON lv.listing_id = l.listing_id
      AND lv.status = 'COMPLETED'
LEFT JOIN auctions a
       ON a.listing_id = l.listing_id
WHERE l.listing_id IN (
    'a0000001-0000-4000-8000-000000000001',
    'a0000002-0000-4000-8000-000000000002',
    'a0000003-0000-4000-8000-000000000003',
    'a0000004-0000-4000-8000-000000000004'
)
ORDER BY l.created_at;
