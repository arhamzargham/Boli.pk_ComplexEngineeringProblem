-- =============================================================
-- Boli.pk — Phase 3 Seed Data
-- Run with: scripts/seed_phase3.bat  OR  scripts/seed_phase3.ps1
-- Safe to run multiple times — all INSERTs use ON CONFLICT DO NOTHING
-- =============================================================
-- UUID prefixes (all valid hex chars 0-9, a-f):
--   fa000001-...  bid idempotency keys
--   fb000001-...  winning bids for Phase 1 auctions
--   f1000002-...  transaction — iPhone 14 Pro (S4_LOCKED)
--   f1000003-...  transaction — iPhone 13     (S8_ESCROW_DISPUTED)
--   f1000005-...  transaction — demo SETTLED  (with receipt hash)
-- =============================================================
-- Settlement math verification (all BIGINT Paisa, zero-decimal):
--   iPhone 14 Pro  bid 22,000,000 paisa (Rs. 220,000)
--     buyer_total   = 22,440,000  (× 1.02)
--     buyer_fee     =    440,000  (× 0.02)
--     seller_fee    =    440,000  (× 0.02)
--     wht           =    220,000  (× 0.01)
--     ict_tax       =    132,000  ((440k+440k) × 0.15)
--     seller_net    = 21,340,000  (22,000,000 - 440,000 - 220,000)
--     platform_rev  =    748,000  (440,000 + 440,000 - 132,000)
--     zero-sum: 21,340,000+220,000+132,000+748,000 = 22,440,000 ✓
--
--   iPhone 13      bid 15,000,000 paisa (Rs. 150,000)
--     buyer_total   = 15,300,000
--     buyer_fee     =    300,000
--     seller_fee    =    300,000
--     wht           =    150,000
--     ict_tax       =     90,000
--     seller_net    = 14,550,000
--     platform_rev  =    510,000
--     zero-sum: 14,550,000+150,000+90,000+510,000 = 15,300,000 ✓
-- =============================================================

BEGIN;

-- =============================================================
-- SECTION 1 — BIDS (required by transactions.winning_bid_id FK)
-- Phase 1 auctions had winner_bid_id = NULL. We add winning bids
-- and backfill the FK.
-- =============================================================

INSERT INTO bids (
    bid_id, auction_id, bidder_id,
    amount_paisa, total_with_fee_paisa,
    status, shill_detection_flag, idempotency_key, created_at
) VALUES

-- Winning bid for Phase 1 iPhone 14 Pro auction (e0000001-...-001)
(
    'fb000001-0000-4000-8000-000000000001',
    'e0000001-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000001',
    22000000, 22440000,
    'WINNING', FALSE,
    'fa000001-0000-4000-8000-000000000001',
    '2026-04-30 11:00:00+05'
),

-- Winning bid for Phase 1 iPhone 13 auction (e0000001-...-002)
(
    'fb000002-0000-4000-8000-000000000002',
    'e0000001-0000-4000-8000-000000000002',
    'b0000000-0000-4000-8000-000000000001',
    15000000, 15300000,
    'WINNING', FALSE,
    'fa000002-0000-4000-8000-000000000002',
    '2026-04-28 09:00:00+05'
),

-- A third bid (for the SETTLED demo transaction) — same auction, different amount
-- Used by f1000005 to demonstrate the receipt hash display
(
    'fb000003-0000-4000-8000-000000000003',
    'e0000001-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000001',
    22000000, 22440000,
    'WINNING', FALSE,
    'fa000003-0000-4000-8000-000000000003',
    '2026-04-30 10:45:00+05'
)

ON CONFLICT (bid_id) DO NOTHING;

-- =============================================================
-- SECTION 2 — BACKFILL winner_bid_id on Phase 1 auctions
-- Uses DO UPDATE so this runs even if auction was already inserted.
-- =============================================================

UPDATE auctions
SET winner_bid_id = 'fb000001-0000-4000-8000-000000000001'
WHERE auction_id  = 'e0000001-0000-4000-8000-000000000001'
  AND winner_bid_id IS NULL;

UPDATE auctions
SET winner_bid_id = 'fb000002-0000-4000-8000-000000000002'
WHERE auction_id  = 'e0000001-0000-4000-8000-000000000002'
  AND winner_bid_id IS NULL;

-- =============================================================
-- SECTION 3 — TRANSACTIONS
-- =============================================================

INSERT INTO transactions (
    transaction_id, auction_id, buyer_id, seller_id, listing_id,
    winning_bid_id,
    winning_bid_paisa, buyer_total_paisa,
    buyer_fee_paisa, seller_fee_paisa,
    wht_paisa, ict_tax_paisa,
    seller_net_paisa, platform_revenue_paisa,
    money_state, settlement_hash_sha256,
    created_at, updated_at
) VALUES

-- f1000002: iPhone 14 Pro — S4_LOCKED (in escrow, pending meetup)
(
    'f1000002-0000-4000-8000-000000000002',
    'e0000001-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000001',
    'd0000001-0000-4000-8000-000000000001',
    'fb000001-0000-4000-8000-000000000001',
    22000000, 22440000,
    440000, 440000,
    220000, 132000,
    21340000, 748000,
    'S4_LOCKED', NULL,
    '2026-04-30 12:01:00+05', '2026-04-30 12:01:00+05'
),

-- f1000003: iPhone 13 — S8_ESCROW_DISPUTED (QR refused by buyer)
(
    'f1000003-0000-4000-8000-000000000003',
    'e0000001-0000-4000-8000-000000000002',
    'b0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000001',
    'd0000001-0000-4000-8000-000000000003',
    'fb000002-0000-4000-8000-000000000002',
    15000000, 15300000,
    300000, 300000,
    150000, 90000,
    14550000, 510000,
    'S8_ESCROW_DISPUTED', NULL,
    '2026-04-28 10:01:00+05', '2026-04-29 14:00:00+05'
),

-- f1000005: SETTLED — demonstrates the receipt hash display on transaction detail
-- Uses the same Phase 1 iPhone 14 Pro auction (CEP demo — not real duplicate)
(
    'f1000005-0000-4000-8000-000000000005',
    'e0000001-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000001',
    'd0000001-0000-4000-8000-000000000001',
    'fb000003-0000-4000-8000-000000000003',
    22000000, 22440000,
    440000, 440000,
    220000, 132000,
    21340000, 748000,
    'S5_SETTLED',
    'a3f9b1c2d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1',
    '2026-04-27 15:30:00+05', '2026-04-27 18:00:00+05'
)

ON CONFLICT (transaction_id) DO NOTHING;

COMMIT;

-- =============================================================
-- ADMIN ROLE HELPER
-- Uncomment to grant admin role to the seed buyer for testing
-- the /admin panel. Run SEPARATELY — do NOT include in demo video.
-- =============================================================
-- UPDATE users SET role = 'ADMIN'
-- WHERE user_id = 'b0000000-0000-4000-8000-000000000001';

-- =============================================================
-- VERIFICATION QUERY
-- =============================================================
SELECT
    t.transaction_id,
    l.make || ' ' || l.model      AS device,
    t.money_state,
    t.winning_bid_paisa / 100     AS bid_rs,
    t.seller_net_paisa  / 100     AS seller_net_rs,
    CASE WHEN t.settlement_hash_sha256 IS NOT NULL
         THEN 'has receipt' ELSE 'no receipt' END AS receipt
FROM transactions t
JOIN listings l ON l.listing_id = t.listing_id
WHERE t.transaction_id IN (
    'f1000002-0000-4000-8000-000000000002',
    'f1000003-0000-4000-8000-000000000003',
    'f1000005-0000-4000-8000-000000000005'
)
ORDER BY t.created_at DESC;
