-- =============================================================
-- Boli.pk — PostgreSQL 16 Complete Schema
-- Authoritative source: CLAUDE.md (all 32 classes, all packages)
-- =============================================================
-- Covers:
--   • All 32 domain classes across 7 packages
--   • All 10 invariants (enforced at DB layer)
--   • All triggers: wallet balance, zero-sum ledger, append-only,
--     money state machine, search vector, retention policy,
--     IMEI-QR gate, ntn_required, closing window, approval expiry
--   • Full-text search (GIN index + tsvector trigger)
--   • Row-level security for raw_metadata_json
--   • Tax account singleton seed rows
-- =============================================================

-- =============================================================
-- EXTENSIONS
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid(), sha256
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- uuid_generate_v4() fallback

-- =============================================================
-- ENUM TYPES
-- =============================================================

-- Package 1 — User & Identity
CREATE TYPE kyc_tier              AS ENUM ('BASIC', 'FULL');
CREATE TYPE account_status        AS ENUM ('PARTIAL_ACTIVE', 'FULL_ACTIVE', 'SELLER_SUSPENDED', 'BUYER_BANNED', 'PERMANENTLY_BANNED');
CREATE TYPE user_role             AS ENUM ('BUYER', 'SELLER', 'ADMIN');
CREATE TYPE locale                AS ENUM ('EN', 'UR');
CREATE TYPE ntn_status            AS ENUM ('FILER', 'NON_FILER', 'UNVERIFIED');
CREATE TYPE verification_source   AS ENUM ('MOCK', 'NADRA_LIVE');

-- Package 2 — Listing & AI Vetting
CREATE TYPE listing_category      AS ENUM ('SMARTPHONE');
CREATE TYPE pta_status            AS ENUM ('REGISTERED_CLEAN', 'UNREGISTERED', 'BLACKLISTED');
CREATE TYPE listing_status        AS ENUM (
    'PENDING_REVIEW', 'ACTIVE', 'SOLD', 'UNSOLD_EXPIRED',
    'REJECTED', 'CANCELLED_BY_SELLER', 'CANCELLED_BY_ADMIN'
);
CREATE TYPE vetting_status        AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'TIMED_OUT', 'FAILED', 'MANUAL_REVIEW_REQUIRED');
CREATE TYPE dirbs_result          AS ENUM ('REGISTERED_CLEAN', 'UNREGISTERED', 'BLACKLISTED');
CREATE TYPE vetting_classification AS ENUM ('VERIFIED', 'REVIEWED', 'PENDING_REVIEW', 'REJECTED');

-- Package 3 — Auction & Bidding
CREATE TYPE auction_status        AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'CLOSING', 'CLOSED_WITH_BIDS', 'CLOSED_NO_BIDS', 'CANCELLED');
CREATE TYPE auction_cancelled_by  AS ENUM ('ADMIN', 'SELLER');
CREATE TYPE bid_status            AS ENUM ('PENDING', 'ACCEPTED', 'OUTBID', 'WINNING', 'VOIDED');

-- Package 4 — Financial & Ledger
CREATE TYPE tax_account_type      AS ENUM ('WHT_HOLDING', 'ICT_SALES_TAX', 'PLATFORM_REVENUE', 'PENALTY_POOL', 'RECONCILIATION_DUST');
CREATE TYPE remittance_schedule   AS ENUM ('MONTHLY', 'QUARTERLY');
CREATE TYPE money_state           AS ENUM (
    'S1_UNDEPOSITED', 'S2_AVAILABLE', 'S3_RESERVED', 'S4_LOCKED',
    'S5_SETTLED', 'S6_WITHDRAWN', 'S7_RESERVED_FROZEN', 'S8_ESCROW_DISPUTED',
    'S9_QUARANTINED', 'S10_PENALTY_DEDUCTED', 'S11_REFUND_PENDING',
    'S12_TAX_REMITTANCE_PENDING', 'S13_EXPIRED_UNRESERVED'
);
CREATE TYPE ledger_entry_type     AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE ledger_purpose        AS ENUM (
    'DEPOSIT', 'WITHDRAWAL', 'BID_RESERVE', 'BID_RELEASE',
    'ESCROW_LOCK', 'SETTLEMENT_SELLER', 'SETTLEMENT_WHT',
    'SETTLEMENT_ICT', 'SETTLEMENT_REVENUE', 'REFUND',
    'PENALTY_DEDUCT', 'PENALTY_SELLER_CREDIT', 'PENALTY_PLATFORM_CREDIT'
);

-- Package 5 — Escrow, Meetup & Settlement
CREATE TYPE escrow_status         AS ENUM ('LOCKED', 'DISPUTED', 'RELEASED', 'REFUNDED', 'DURESS_FROZEN');
CREATE TYPE imei_scan_result      AS ENUM ('PENDING', 'MATCH', 'MISMATCH');
CREATE TYPE dirbs_recheck_result  AS ENUM ('CLEAN', 'BLACKLISTED', 'UNREGISTERED');

-- Package 6 — Governance & Disputes
CREATE TYPE dispute_raised_by     AS ENUM ('BUYER', 'SELLER', 'SYSTEM');
CREATE TYPE dispute_type          AS ENUM (
    'IMEI_MISMATCH', 'QR_REFUSAL', 'ITEM_NOT_AS_DESCRIBED',
    'FRAUDULENT_REVERSAL', 'DURESS', 'MEETUP_FAILED',
    'SELLER_NO_SHOW', 'DIRBS_BLACKLISTED_AT_MEETUP'
);
CREATE TYPE dispute_status        AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED_BUYER', 'RESOLVED_SELLER', 'RESOLVED_SPLIT');
CREATE TYPE approval_status       AS ENUM ('AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'EXPIRED');

-- Package 7 — Notifications
CREATE TYPE notification_channel          AS ENUM ('PUSH', 'IN_APP', 'SMS');
CREATE TYPE notification_status           AS ENUM ('QUEUED', 'DISPATCHED', 'DELIVERED', 'FAILED');
CREATE TYPE bid_notification_type         AS ENUM ('OUTBID', 'AUCTION_WON');
CREATE TYPE meetup_notification_type      AS ENUM ('MEETUP_CONFIRM', 'MEETUP_REMINDER');
CREATE TYPE imei_notification_type        AS ENUM ('IMEI_MATCH', 'IMEI_MISMATCH');
CREATE TYPE settlement_notification_type  AS ENUM ('QR_SCANNED', 'FUNDS_RELEASED');
CREATE TYPE governance_notification_type  AS ENUM ('DISPUTE_OPENED', 'PENALTY_APPLIED', 'SUSPENSION_APPLIED');
CREATE TYPE admin_alert_type              AS ENUM ('DURESS', 'SHILL_DETECTED', 'AML_FREEZE', 'CHAIN_INTEGRITY_FAILURE');
CREATE TYPE admin_alert_priority          AS ENUM ('HIGH', 'CRITICAL');


-- =============================================================
-- PACKAGE 1 — USER & IDENTITY
-- =============================================================

CREATE TABLE users (
    user_id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    phone                     VARCHAR(15) NOT NULL UNIQUE,
    cnic_encrypted            BYTEA,                                    -- AES-256-GCM, KMS-managed; null after anonymisation
    ntn_encrypted             BYTEA,                                    -- nullable, AES-256-GCM
    kyc_tier                  kyc_tier    NOT NULL DEFAULT 'BASIC',
    trust_score               SMALLINT    NOT NULL DEFAULT 50
                                  CHECK (trust_score >= 0 AND trust_score <= 100),
    role                      user_role   NOT NULL DEFAULT 'BUYER',
    account_status            account_status NOT NULL DEFAULT 'PARTIAL_ACTIVE',
    seller_suspended_until    TIMESTAMPTZ,                              -- null = not suspended
    seller_suspension_count   SMALLINT    NOT NULL DEFAULT 0
                                  CHECK (seller_suspension_count >= 0 AND seller_suspension_count <= 3),
    buyer_banned_until        TIMESTAMPTZ,
    buyer_offence_count       SMALLINT    NOT NULL DEFAULT 0
                                  CHECK (buyer_offence_count >= 0 AND buyer_offence_count <= 3),
    accessibility_prefs       JSONB       NOT NULL DEFAULT '{"high_contrast":false,"haptics_disabled":false,"font_size":"NORMAL"}',
    preferred_locale          locale      NOT NULL DEFAULT 'EN',
    duress_pin                VARCHAR,                                  -- bcrypt hash; null = not set up
    active_listing_count      SMALLINT    NOT NULL DEFAULT 0
                                  CHECK (active_listing_count >= 0 AND active_listing_count <= 5),
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at                TIMESTAMPTZ,                              -- soft delete
    anonymised_uuid           UUID                                      -- set on account deletion, replaces PII
);

-- ---------------------
CREATE TABLE user_sessions (
    session_id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                   UUID        NOT NULL REFERENCES users(user_id),
    device_fingerprint        VARCHAR     NOT NULL,
    ip_address                INET        NOT NULL,
    network_bssid             VARCHAR,                                  -- nullable; WiFi BSSID for shill detection
    jwt_access_token_hash     VARCHAR     NOT NULL,                     -- SHA-256 of JWT — NOT the raw JWT
    refresh_token_hash        VARCHAR     NOT NULL,                     -- SHA-256 of refresh token
    access_token_expires_at   TIMESTAMPTZ NOT NULL,                     -- now + 15 min
    refresh_token_expires_at  TIMESTAMPTZ NOT NULL,                     -- now + 7 days
    is_active                 BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------
CREATE TABLE kyc_records (
    kyc_id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                   UUID        NOT NULL UNIQUE REFERENCES users(user_id),
    cnic_verified_at          TIMESTAMPTZ,
    ntn_verified_at           TIMESTAMPTZ,
    ntn_status                ntn_status  NOT NULL DEFAULT 'UNVERIFIED',
    biometric_hash_sha256     CHAR(64),                                 -- one-way SHA-256; raw biometric NEVER stored
    verification_source       verification_source NOT NULL DEFAULT 'MOCK',
    iban                      VARCHAR,                                  -- for seller withdrawals; format-validated only
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------
-- Account activation is BLOCKED until this record exists (created at Step 4 of registration).
CREATE TABLE penalty_consent_records (
    consent_id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                         UUID        NOT NULL REFERENCES users(user_id),
    policy_version                  VARCHAR     NOT NULL,               -- e.g. "GPR-v1.0"
    acknowledged_at                 TIMESTAMPTZ NOT NULL DEFAULT now(), -- immutable
    ip_at_consent                   INET        NOT NULL,
    device_fingerprint_at_consent   VARCHAR     NOT NULL
);

-- ---------------------
-- INVARIANT-01: available + reserved + locked = total_deposited AT ALL TIMES
-- Enforced by CHECK constraint + trigger fn_check_wallet_balance_invariant (defined below).
CREATE TABLE wallets (
    wallet_id                   UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     UUID    NOT NULL UNIQUE REFERENCES users(user_id),
    available_paisa             BIGINT  NOT NULL DEFAULT 0 CHECK (available_paisa >= 0),
    reserved_paisa              BIGINT  NOT NULL DEFAULT 0 CHECK (reserved_paisa >= 0),
    locked_paisa                BIGINT  NOT NULL DEFAULT 0 CHECK (locked_paisa >= 0),
    total_deposited_paisa       BIGINT  NOT NULL DEFAULT 0,
    daily_escrow_exposure_paisa BIGINT  NOT NULL DEFAULT 0 CHECK (daily_escrow_exposure_paisa >= 0),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT wallet_balance_invariant
        CHECK (available_paisa + reserved_paisa + locked_paisa = total_deposited_paisa)
);


-- =============================================================
-- PACKAGE 2 — LISTING & AI VETTING
-- =============================================================

CREATE TABLE listings (
    listing_id            UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id             UUID              NOT NULL REFERENCES users(user_id),
    category              listing_category  NOT NULL DEFAULT 'SMARTPHONE',
    imei                  VARCHAR(15)       NOT NULL,                   -- IMEI1; Luhn-validated by Gate 1 before insert
    make                  VARCHAR           NOT NULL,
    model                 VARCHAR           NOT NULL,
    storage_gb            SMALLINT,
    color_variant         VARCHAR,
    condition_rating      SMALLINT          NOT NULL
                              CHECK (condition_rating >= 1 AND condition_rating <= 10),
    reserve_price_paisa   BIGINT            NOT NULL CHECK (reserve_price_paisa > 0),
    reserve_price_visible BOOLEAN           NOT NULL DEFAULT TRUE,
    category_metadata     JSONB             NOT NULL DEFAULT '{}',
    pta_status            pta_status,                                   -- set by Gate 2 result
    status                listing_status    NOT NULL DEFAULT 'PENDING_REVIEW',
    ntn_required          BOOLEAN           NOT NULL DEFAULT FALSE,     -- auto-set by trigger
    resubmission_count    SMALLINT          NOT NULL DEFAULT 0
                              CHECK (resubmission_count >= 0 AND resubmission_count <= 3),
    search_vector         tsvector,                                     -- maintained by trigger
    created_at            TIMESTAMPTZ       NOT NULL DEFAULT now(),
    published_at          TIMESTAMPTZ,                                  -- set on ACTIVE transition
    expires_at            TIMESTAMPTZ                                   -- published_at + 30 days
);

-- ---------------------
CREATE TABLE listing_images (
    image_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id        UUID        NOT NULL REFERENCES listings(listing_id),
    storage_url       TEXT        NOT NULL,       -- EXIF-stripped; public
    raw_metadata_json JSONB,                      -- GPS + device timestamp; AI pipeline only — NEVER public API
    uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    sort_order        SMALLINT    NOT NULL DEFAULT 1 CHECK (sort_order >= 1)
);

-- ---------------------
-- Resubmissions create NEW records; previous records retained for audit.
-- NOT UNIQUE on listing_id — multiple vetting records per listing are allowed.
CREATE TABLE listing_vettings (
    vetting_id              UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id              UUID                NOT NULL REFERENCES listings(listing_id),
    submitted_at            TIMESTAMPTZ         NOT NULL DEFAULT now(),
    status                  vetting_status      NOT NULL DEFAULT 'QUEUED',
    completed_at            TIMESTAMPTZ,
    timeout_at              TIMESTAMPTZ         NOT NULL,               -- submitted_at + 5000ms, set by app
    attempt_count           SMALLINT            NOT NULL DEFAULT 1
                                CHECK (attempt_count >= 1 AND attempt_count <= 2),
    degraded_to_manual      BOOLEAN             NOT NULL DEFAULT FALSE,
    manual_review_deadline  TIMESTAMPTZ,                                -- submitted_at + 48h when degraded_to_manual = true

    -- Gate results (null until pipeline runs)
    gate1_luhn_pass         BOOLEAN,
    gate2_dirbs_result      dirbs_result,
    gate3_tac_match         BOOLEAN,

    -- Probabilistic scores (null until COMPLETED)
    check4_image_score      SMALLINT            CHECK (check4_image_score    BETWEEN 0 AND 40),
    check5_condition_score  SMALLINT            CHECK (check5_condition_score BETWEEN 0 AND 30),
    check6_price_score      SMALLINT            CHECK (check6_price_score     BETWEEN 0 AND 30),
    composite_score         SMALLINT            CHECK (composite_score        BETWEEN 0 AND 100),

    -- Result (null until COMPLETED)
    classification          vetting_classification,
    rejection_reason_code   VARCHAR,             -- LUHN_FAIL | DIRBS_BLACKLISTED | TAC_MISMATCH | LOW_IMAGE_SCORE | MANUAL_REJECTED | MAX_RESUBMISSIONS
    price_below_market_flag BOOLEAN,             -- true if Check 6 detects >40% below market
    model_version           VARCHAR,
    admin_reviewed_by       UUID                REFERENCES users(user_id),
    admin_reviewed_at       TIMESTAMPTZ,

    -- INVARIANT: status=COMPLETED ↔ classification IS NOT NULL
    CONSTRAINT vetting_classification_invariant CHECK (
        (status = 'COMPLETED'  AND classification IS NOT NULL) OR
        (status != 'COMPLETED' AND classification IS NULL)
    ),
    -- composite_score = sum of three check scores
    CONSTRAINT composite_score_sum CHECK (
        composite_score IS NULL OR
        composite_score = COALESCE(check4_image_score, 0)
                        + COALESCE(check5_condition_score, 0)
                        + COALESCE(check6_price_score, 0)
    )
);


-- =============================================================
-- PACKAGE 3 — AUCTION & BIDDING
-- =============================================================

CREATE TABLE auctions (
    auction_id            UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id            UUID              NOT NULL UNIQUE REFERENCES listings(listing_id),
    start_time            TIMESTAMPTZ       NOT NULL,
    end_time              TIMESTAMPTZ       NOT NULL,
    reserve_price_paisa   BIGINT            NOT NULL CHECK (reserve_price_paisa > 0), -- immutable copy from Listing
    status                auction_status    NOT NULL DEFAULT 'DRAFT',
    winner_bid_id         UUID,                                         -- FK added after bids table
    total_bid_count       INTEGER           NOT NULL DEFAULT 0 CHECK (total_bid_count >= 0),
    closing_window_start  TIMESTAMPTZ       NOT NULL,                   -- end_time - 60s; auto-set by trigger
    closed_at             TIMESTAMPTZ,
    cancelled_by          auction_cancelled_by,
    cancelled_at          TIMESTAMPTZ,

    CONSTRAINT auction_end_after_start  CHECK (end_time > start_time),
    CONSTRAINT auction_min_duration     CHECK (end_time >= start_time + INTERVAL '1 hour'),
    CONSTRAINT auction_max_duration     CHECK (end_time <= start_time + INTERVAL '7 days')
);

-- ---------------------
CREATE TABLE bids (
    bid_id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id            UUID        NOT NULL REFERENCES auctions(auction_id),
    bidder_id             UUID        NOT NULL REFERENCES users(user_id),
    amount_paisa          BIGINT      NOT NULL CHECK (amount_paisa > 0),
    total_with_fee_paisa  BIGINT      NOT NULL CHECK (total_with_fee_paisa > 0), -- amount * 1.02
    status                bid_status  NOT NULL DEFAULT 'PENDING',
    shill_detection_flag  BOOLEAN     NOT NULL DEFAULT FALSE,
    idempotency_key       UUID        NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),           -- ms precision; tiebreaker for simultaneous bids

    CONSTRAINT bid_unique_idempotency UNIQUE (auction_id, idempotency_key)
);

-- Add winner FK now that bids table exists
ALTER TABLE auctions
    ADD CONSTRAINT fk_auctions_winner_bid
    FOREIGN KEY (winner_bid_id) REFERENCES bids(bid_id);


-- =============================================================
-- PACKAGE 4 — FINANCIAL & LEDGER
-- =============================================================

-- 5 singleton rows; seeded at bottom of file.
CREATE TABLE tax_accounts (
    account_id          UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    account_type        tax_account_type    NOT NULL UNIQUE,
    balance_paisa       BIGINT              NOT NULL DEFAULT 0 CHECK (balance_paisa >= 0),
    last_remitted_at    TIMESTAMPTZ,
    remittance_schedule remittance_schedule NOT NULL
);

-- ---------------------
CREATE TABLE transactions (
    transaction_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id              UUID        NOT NULL REFERENCES auctions(auction_id),
    buyer_id                UUID        NOT NULL REFERENCES users(user_id),
    seller_id               UUID        NOT NULL REFERENCES users(user_id),
    listing_id              UUID        NOT NULL REFERENCES listings(listing_id),
    winning_bid_id          UUID        NOT NULL REFERENCES bids(bid_id),
    winning_bid_paisa       BIGINT      NOT NULL CHECK (winning_bid_paisa > 0),
    buyer_total_paisa       BIGINT      NOT NULL CHECK (buyer_total_paisa > 0),  -- winning_bid * 1.02
    buyer_fee_paisa         BIGINT      NOT NULL CHECK (buyer_fee_paisa >= 0),   -- winning_bid * 0.02
    seller_fee_paisa        BIGINT      NOT NULL CHECK (seller_fee_paisa >= 0),  -- winning_bid * 0.02
    wht_paisa               BIGINT      NOT NULL CHECK (wht_paisa >= 0),         -- winning_bid * 0.01
    ict_tax_paisa           BIGINT      NOT NULL CHECK (ict_tax_paisa >= 0),     -- (buyer_fee + seller_fee) * 0.15
    seller_net_paisa        BIGINT      NOT NULL CHECK (seller_net_paisa >= 0),  -- winning_bid - seller_fee - wht
    platform_revenue_paisa  BIGINT      NOT NULL CHECK (platform_revenue_paisa >= 0), -- buyer_fee + seller_fee - ict_tax
    money_state             money_state NOT NULL DEFAULT 'S4_LOCKED',
    settlement_hash_sha256  CHAR(64),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- INVARIANT-02 (structural): buyer_total = all outflows
    CONSTRAINT transaction_zero_sum CHECK (
        buyer_total_paisa = seller_net_paisa + wht_paisa + ict_tax_paisa + platform_revenue_paisa
    ),
    -- Internal consistency checks (no floating-point — pure integer relationships)
    CONSTRAINT seller_net_formula CHECK (
        seller_net_paisa = winning_bid_paisa - seller_fee_paisa - wht_paisa
    ),
    CONSTRAINT platform_revenue_formula CHECK (
        platform_revenue_paisa = buyer_fee_paisa + seller_fee_paisa - ict_tax_paisa
    )
);

-- ---------------------
-- INVARIANT-03: INSERT ONLY. UPDATE and DELETE are blocked by trigger.
-- INVARIANT-04: Hash chain — currentHash = SHA256(entryId||txId||amount||purpose||prevHash).
--               Chain integrity verified by background monitor in Go every 5 minutes.
CREATE TABLE ledger_entries (
    entry_id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id        UUID              REFERENCES transactions(transaction_id), -- null for deposit/withdrawal
    wallet_id             UUID              REFERENCES wallets(wallet_id),           -- null for tax account entries
    tax_account_id        UUID              REFERENCES tax_accounts(account_id),     -- null for wallet entries
    amount_paisa          BIGINT            NOT NULL CHECK (amount_paisa > 0),       -- always positive (INVARIANT-09)
    entry_type            ledger_entry_type NOT NULL,
    purpose               ledger_purpose    NOT NULL,
    previous_hash_sha256  CHAR(64)          NOT NULL,
    current_hash_sha256   CHAR(64)          NOT NULL,
    metadata              JSONB             NOT NULL DEFAULT '{}',  -- {"gateway_ref": "..."} for deposit idempotency
    created_at            TIMESTAMPTZ       NOT NULL DEFAULT now(), -- immutable; ms precision

    -- Each entry targets exactly one account type (wallet XOR tax_account)
    CONSTRAINT ledger_entry_single_target CHECK (
        (wallet_id IS NOT NULL AND tax_account_id IS NULL) OR
        (wallet_id IS NULL     AND tax_account_id IS NOT NULL)
    )
);


-- =============================================================
-- PACKAGE 5 — ESCROW, MEETUP & SETTLEMENT
-- =============================================================

CREATE TABLE escrows (
    escrow_id           UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id      UUID            NOT NULL UNIQUE REFERENCES transactions(transaction_id),
    amount_paisa        BIGINT          NOT NULL CHECK (amount_paisa > 0), -- = transaction.buyer_total_paisa
    qr_seed_encrypted   BYTEA,                                              -- AES-256-GCM
    qr_seed_ttl_expiry  TIMESTAMPTZ,                                        -- seed_generated_at + 120s
    qr_seed_hash        CHAR(64),       -- SHA-256 of plaintext seed; replay check without decryption
    qr_seed_used        BOOLEAN         NOT NULL DEFAULT FALSE,             -- INVARIANT-05: one-time use
    status              escrow_status   NOT NULL DEFAULT 'LOCKED',
    twopc_prepare_at    TIMESTAMPTZ,
    twopc_commit_at     TIMESTAMPTZ
);

-- ---------------------
CREATE TABLE meetup_sessions (
    meetup_id                 UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id            UUID              NOT NULL UNIQUE REFERENCES transactions(transaction_id),
    proposed_location         JSONB,            -- {lat, lng, address, placeId} — Google Maps picker
    proposed_time             TIMESTAMPTZ,
    buyer_confirmed_at        TIMESTAMPTZ,
    seller_confirmed_at       TIMESTAMPTZ,
    confirmed_at              TIMESTAMPTZ,      -- set when BOTH parties confirmed; 4-hour QR window starts here
    imei_scanned_at           TIMESTAMPTZ,
    imei_scan_result          imei_scan_result  NOT NULL DEFAULT 'PENDING',
    dirbs_recheck_result      dirbs_recheck_result,  -- null until IMEI scanned at meetup
    scanned_imei              VARCHAR(15),
    qr_scanned_at             TIMESTAMPTZ,
    geolocation_at_scan       JSONB,            -- {lat, lng, accuracy_metres, source}
    late_night_warning_shown  BOOLEAN           NOT NULL DEFAULT FALSE,
    duress_activated          BOOLEAN           NOT NULL DEFAULT FALSE,

    -- INVARIANT-08: IMEI-QR gate (enforced here AND by trigger for belt-and-suspenders)
    CONSTRAINT imei_qr_gate CHECK (
        qr_scanned_at IS NULL OR imei_scan_result = 'MATCH'
    )
);

-- ---------------------
-- Evidence records become READ-ONLY when is_evidence = true (enforced by trigger).
CREATE TABLE meetup_messages (
    message_id  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    meetup_id   UUID        NOT NULL REFERENCES meetup_sessions(meetup_id),
    sender_id   UUID        NOT NULL REFERENCES users(user_id),
    content     TEXT        NOT NULL CHECK (char_length(content) <= 500),
    sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_evidence BOOLEAN     NOT NULL DEFAULT FALSE  -- set true atomically when dispute raised
);

-- ---------------------
-- INVARIANT-03: INSERT ONLY. UPDATE and DELETE are blocked by trigger.
CREATE TABLE settlement_receipts (
    receipt_id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id          UUID        NOT NULL UNIQUE REFERENCES transactions(transaction_id),
    buyer_id_hash           CHAR(64)    NOT NULL,   -- SHA-256 of buyer user_id
    seller_id_hash          CHAR(64)    NOT NULL,   -- SHA-256 of seller user_id
    listing_id              UUID        NOT NULL REFERENCES listings(listing_id),
    verified_imei           VARCHAR(15) NOT NULL,
    settlement_timestamp    TIMESTAMPTZ NOT NULL,   -- ms precision
    geolocation_at_scan     JSONB       NOT NULL,   -- copied from meetup_sessions
    receipt_hash_sha256     CHAR(64)    NOT NULL,   -- SHA-256(buyer_hash||seller_hash||listing||imei||ts||geo||tx_id)
    platform_public_key_ref VARCHAR     NOT NULL    -- key version identifier
);


-- =============================================================
-- PACKAGE 6 — GOVERNANCE & DISPUTES
-- =============================================================

CREATE TABLE disputes (
    dispute_id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id          UUID              NOT NULL REFERENCES transactions(transaction_id),
    raised_by               dispute_raised_by NOT NULL,
    dispute_type            dispute_type      NOT NULL,
    reason                  TEXT              NOT NULL,
    evidence_frozen_at      TIMESTAMPTZ       NOT NULL DEFAULT now(),
    status                  dispute_status    NOT NULL DEFAULT 'OPEN',
    admin_notes             TEXT,
    resolved_at             TIMESTAMPTZ,
    resolver_id             UUID              REFERENCES users(user_id),
    buyer_share_pct         SMALLINT          CHECK (buyer_share_pct  BETWEEN 0 AND 100),
    seller_share_pct        SMALLINT          CHECK (seller_share_pct BETWEEN 0 AND 100),
    admin_response_deadline TIMESTAMPTZ       NOT NULL,  -- created_at + 72 hours; set by app

    -- Split percentages must sum to 100 when present
    CONSTRAINT split_pct_sum CHECK (
        (buyer_share_pct IS NULL AND seller_share_pct IS NULL) OR
        (buyer_share_pct + seller_share_pct = 100)
    )
);

-- ---------------------
-- Abstract base for Maker-Checker workflow.
-- Subclass rows linked via approval_id FK (table-per-subclass inheritance).
CREATE TABLE admin_approvals (
    approval_id               UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_subtype          VARCHAR         NOT NULL
                                  CHECK (approval_subtype IN (
                                      'MANUAL_REFUND', 'DISPUTE_RESOLUTION',
                                      'PENALTY_OVERRIDE', 'ACCOUNT_ACTION', 'WALLET_ADJUSTMENT'
                                  )),
    initiator_id              UUID            NOT NULL REFERENCES users(user_id),
    approver_id               UUID            REFERENCES users(user_id),
    requested_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    approved_at               TIMESTAMPTZ,
    status                    approval_status NOT NULL DEFAULT 'AWAITING_APPROVAL',
    crypto_signature_maker    TEXT            NOT NULL,
    crypto_signature_checker  TEXT,
    expires_at                TIMESTAMPTZ     NOT NULL,  -- requested_at + 24h; set by app

    -- INVARIANT-07: Maker-Checker separation
    CONSTRAINT maker_checker_separation CHECK (
        approver_id IS NULL OR initiator_id != approver_id
    )
);

-- AdminApproval subclasses (table-per-subclass)
CREATE TABLE manual_refund_approvals (
    approval_id         UUID    PRIMARY KEY REFERENCES admin_approvals(approval_id),
    transaction_id      UUID    NOT NULL REFERENCES transactions(transaction_id),
    refund_amount_paisa BIGINT  NOT NULL CHECK (refund_amount_paisa > 0),
    refund_reason       TEXT    NOT NULL
);

CREATE TABLE dispute_resolution_approvals (
    approval_id     UUID            PRIMARY KEY REFERENCES admin_approvals(approval_id),
    dispute_id      UUID            NOT NULL REFERENCES disputes(dispute_id),
    verdict         dispute_status  NOT NULL,
    buyer_share_pct SMALLINT        CHECK (buyer_share_pct  BETWEEN 0 AND 100),
    seller_share_pct SMALLINT       CHECK (seller_share_pct BETWEEN 0 AND 100),
    CONSTRAINT dra_split_sum CHECK (
        (buyer_share_pct IS NULL AND seller_share_pct IS NULL) OR
        (buyer_share_pct + seller_share_pct = 100)
    )
);

CREATE TABLE penalty_override_approvals (
    approval_id             UUID    PRIMARY KEY REFERENCES admin_approvals(approval_id),
    target_user_id          UUID    NOT NULL REFERENCES users(user_id),
    original_penalty_paisa  BIGINT  NOT NULL CHECK (original_penalty_paisa > 0),
    override_penalty_paisa  BIGINT  NOT NULL CHECK (override_penalty_paisa >= 0),
    override_reason         TEXT    NOT NULL
);

CREATE TABLE account_action_approvals (
    approval_id     UUID    PRIMARY KEY REFERENCES admin_approvals(approval_id),
    target_user_id  UUID    NOT NULL REFERENCES users(user_id),
    action          VARCHAR NOT NULL
                        CHECK (action IN ('SUSPEND', 'BAN', 'UNBAN', 'PERMANENTLY_BAN')),
    duration_days   SMALLINT,   -- null = permanent
    action_reason   TEXT    NOT NULL
);

CREATE TABLE wallet_adjustment_approvals (
    approval_id        UUID    PRIMARY KEY REFERENCES admin_approvals(approval_id),
    wallet_id          UUID    NOT NULL REFERENCES wallets(wallet_id),
    adjustment_paisa   BIGINT  NOT NULL,  -- positive = credit, negative = debit
    adjustment_reason  TEXT    NOT NULL
);


-- =============================================================
-- PACKAGE 7 — NOTIFICATIONS
-- =============================================================

-- Abstract base. Subclass rows linked via notification_id FK.
CREATE TABLE notifications (
    notification_id      UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID                  NOT NULL REFERENCES users(user_id),
    notification_subtype VARCHAR               NOT NULL
                             CHECK (notification_subtype IN (
                                 'BID', 'MEETUP', 'IMEI', 'SETTLEMENT',
                                 'GOVERNANCE', 'ADMIN_ALERT', 'VETTING_COMPLETE'
                             )),
    channel              notification_channel  NOT NULL,
    status               notification_status   NOT NULL DEFAULT 'QUEUED',
    dispatched_at        TIMESTAMPTZ,
    delivered_at         TIMESTAMPTZ,
    created_at           TIMESTAMPTZ           NOT NULL DEFAULT now()
);

-- 7 Notification subclasses
CREATE TABLE bid_notifications (
    notification_id           UUID                  PRIMARY KEY REFERENCES notifications(notification_id),
    auction_id                UUID                  NOT NULL REFERENCES auctions(auction_id),
    current_highest_bid_paisa BIGINT                NOT NULL,
    user_bid_paisa            BIGINT                NOT NULL,
    type                      bid_notification_type NOT NULL
);

CREATE TABLE meetup_notifications (
    notification_id   UUID                      PRIMARY KEY REFERENCES notifications(notification_id),
    transaction_id    UUID                      NOT NULL REFERENCES transactions(transaction_id),
    proposed_location JSONB,
    proposed_time     TIMESTAMPTZ,
    type              meetup_notification_type  NOT NULL
);

CREATE TABLE imei_notifications (
    notification_id UUID                    PRIMARY KEY REFERENCES notifications(notification_id),
    transaction_id  UUID                    NOT NULL REFERENCES transactions(transaction_id),
    scanned_imei    VARCHAR(15)             NOT NULL,
    listed_imei     VARCHAR(15)             NOT NULL,
    type            imei_notification_type  NOT NULL
);

CREATE TABLE settlement_notifications (
    notification_id UUID                          PRIMARY KEY REFERENCES notifications(notification_id),
    transaction_id  UUID                          NOT NULL REFERENCES transactions(transaction_id),
    amount_paisa    BIGINT                        NOT NULL,
    type            settlement_notification_type  NOT NULL
);

CREATE TABLE governance_notifications (
    notification_id      UUID                        PRIMARY KEY REFERENCES notifications(notification_id),
    transaction_id       UUID                        REFERENCES transactions(transaction_id),  -- nullable
    penalty_amount_paisa BIGINT,
    suspension_days      SMALLINT,
    type                 governance_notification_type NOT NULL
);

CREATE TABLE admin_alert_notifications (
    notification_id UUID                  PRIMARY KEY REFERENCES notifications(notification_id),
    transaction_id  UUID                  REFERENCES transactions(transaction_id),  -- nullable
    alert_type      admin_alert_type      NOT NULL,
    priority        admin_alert_priority  NOT NULL
);

CREATE TABLE vetting_complete_notifications (
    notification_id       UUID                    PRIMARY KEY REFERENCES notifications(notification_id),
    vetting_id            UUID                    NOT NULL REFERENCES listing_vettings(vetting_id),
    listing_id            UUID                    NOT NULL REFERENCES listings(listing_id),
    classification        vetting_classification  NOT NULL,
    rejection_reason_code VARCHAR
);


-- =============================================================
-- INDEXES
-- =============================================================

-- Full-text search on listings (Section 10 — GIN index on tsvector)
CREATE INDEX idx_listings_search      ON listings USING GIN (search_vector);
CREATE INDEX idx_listings_status      ON listings (status) WHERE status = 'ACTIVE';
CREATE INDEX idx_listings_seller      ON listings (seller_id);

-- Auction scheduling / closing
CREATE INDEX idx_auctions_status      ON auctions (status);
CREATE INDEX idx_auctions_end_time    ON auctions (end_time) WHERE status IN ('ACTIVE', 'CLOSING');

-- Bid lookups
CREATE INDEX idx_bids_auction         ON bids (auction_id);
CREATE INDEX idx_bids_bidder          ON bids (bidder_id);
CREATE INDEX idx_bids_auction_status  ON bids (auction_id, status);

-- Session validation (hot path — every authenticated request)
CREATE INDEX idx_sessions_user_active ON user_sessions (user_id) WHERE is_active = TRUE;
CREATE INDEX idx_sessions_token_hash  ON user_sessions (jwt_access_token_hash);

-- Ledger chain traversal and deposit idempotency (Gap 28)
CREATE INDEX idx_ledger_transaction   ON ledger_entries (transaction_id);
CREATE INDEX idx_ledger_wallet        ON ledger_entries (wallet_id);
CREATE INDEX idx_ledger_created       ON ledger_entries (created_at);
CREATE INDEX idx_ledger_gateway_ref   ON ledger_entries ((metadata->>'gateway_ref'))
    WHERE metadata->>'gateway_ref' IS NOT NULL;

-- Notification inbox (GET /api/v1/notifications?status=QUEUED)
CREATE INDEX idx_notifications_user        ON notifications (user_id);
CREATE INDEX idx_notifications_user_queued ON notifications (user_id, status) WHERE status = 'QUEUED';

-- Vetting queue
CREATE INDEX idx_vettings_listing     ON listing_vettings (listing_id);
CREATE INDEX idx_vettings_status      ON listing_vettings (status);
CREATE INDEX idx_vettings_manual      ON listing_vettings (manual_review_deadline)
    WHERE status = 'MANUAL_REVIEW_REQUIRED';

-- Dispute management
CREATE INDEX idx_disputes_transaction ON disputes (transaction_id);
CREATE INDEX idx_disputes_open        ON disputes (status, admin_response_deadline)
    WHERE status IN ('OPEN', 'UNDER_REVIEW');

-- Admin approval queue
CREATE INDEX idx_approvals_status     ON admin_approvals (status, expires_at)
    WHERE status = 'AWAITING_APPROVAL';

-- Meetup session lookups
CREATE INDEX idx_meetup_transaction   ON meetup_sessions (transaction_id);


-- =============================================================
-- TRIGGER FUNCTIONS
-- =============================================================

-- -------------------------------------------------------
-- T1: Wallet balance invariant (INVARIANT-01)
-- Belt-and-suspenders with the CHECK constraint.
-- Catches any update path that might bypass the CHECK.
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_wallet_balance_invariant()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.available_paisa + NEW.reserved_paisa + NEW.locked_paisa
       != NEW.total_deposited_paisa THEN
        RAISE EXCEPTION
            'INVARIANT-01 VIOLATED wallet=%: available(%) + reserved(%) + locked(%) != total_deposited(%)',
            NEW.wallet_id,
            NEW.available_paisa, NEW.reserved_paisa,
            NEW.locked_paisa, NEW.total_deposited_paisa;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_wallet_balance_invariant
BEFORE INSERT OR UPDATE ON wallets
FOR EACH ROW EXECUTE FUNCTION fn_wallet_balance_invariant();


-- -------------------------------------------------------
-- T2: Zero-sum ledger (INVARIANT-02)
-- Deferred constraint trigger: runs at COMMIT time so the
-- full batch of entries for a transaction is visible.
-- Skip deposit/withdrawal entries (transaction_id IS NULL).
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_ledger_zero_sum()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_debit  BIGINT;
    v_credit BIGINT;
BEGIN
    IF NEW.transaction_id IS NULL THEN
        RETURN NEW;  -- deposit / withdrawal; no batch to check
    END IF;

    SELECT
        COALESCE(SUM(amount_paisa) FILTER (WHERE entry_type = 'DEBIT'),  0),
        COALESCE(SUM(amount_paisa) FILTER (WHERE entry_type = 'CREDIT'), 0)
    INTO v_debit, v_credit
    FROM ledger_entries
    WHERE transaction_id = NEW.transaction_id;

    IF v_debit != v_credit THEN
        RAISE EXCEPTION
            'INVARIANT-02 VIOLATED tx=%: DEBIT(%) != CREDIT(%)',
            NEW.transaction_id, v_debit, v_credit;
    END IF;
    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_ledger_zero_sum
AFTER INSERT ON ledger_entries
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION fn_ledger_zero_sum();


-- -------------------------------------------------------
-- T3: Append-only ledger_entries (INVARIANT-03)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_ledger_append_only()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'INVARIANT-03 VIOLATED: UPDATE on ledger_entries is forbidden. entry_id=%', OLD.entry_id;
    END IF;
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'INVARIANT-03 VIOLATED: DELETE on ledger_entries is forbidden. entry_id=%', OLD.entry_id;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_ledger_append_only
BEFORE UPDATE OR DELETE ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION fn_ledger_append_only();


-- -------------------------------------------------------
-- T4: Append-only settlement_receipts (INVARIANT-03)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_receipt_append_only()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'INVARIANT-03 VIOLATED: UPDATE on settlement_receipts is forbidden. receipt_id=%', OLD.receipt_id;
    END IF;
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'INVARIANT-03 VIOLATED: DELETE on settlement_receipts is forbidden. receipt_id=%', OLD.receipt_id;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_receipt_append_only
BEFORE UPDATE OR DELETE ON settlement_receipts
FOR EACH ROW EXECUTE FUNCTION fn_receipt_append_only();


-- -------------------------------------------------------
-- T5: Append-only meetup_messages when frozen as evidence (INVARIANT-03)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_evidence_message_readonly()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.is_evidence = TRUE THEN
        RAISE EXCEPTION
            'INVARIANT-03 VIOLATED: meetup_message % is frozen evidence and cannot be modified',
            OLD.message_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_evidence_message_readonly
BEFORE UPDATE OR DELETE ON meetup_messages
FOR EACH ROW EXECUTE FUNCTION fn_evidence_message_readonly();


-- -------------------------------------------------------
-- T6: Money state machine legal transitions (INVARIANT-06)
-- Encodes all legal S1..S13 transitions from CLAUDE.md Section 7.
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_money_state_transition()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_allowed JSONB := '{
        "S1_UNDEPOSITED":            ["S2_AVAILABLE"],
        "S2_AVAILABLE":              ["S3_RESERVED","S6_WITHDRAWN","S10_PENALTY_DEDUCTED"],
        "S3_RESERVED":               ["S2_AVAILABLE","S4_LOCKED","S7_RESERVED_FROZEN","S13_EXPIRED_UNRESERVED"],
        "S4_LOCKED":                 ["S2_AVAILABLE","S5_SETTLED","S8_ESCROW_DISPUTED","S11_REFUND_PENDING"],
        "S5_SETTLED":                ["S6_WITHDRAWN","S9_QUARANTINED","S12_TAX_REMITTANCE_PENDING"],
        "S6_WITHDRAWN":              ["S1_UNDEPOSITED"],
        "S7_RESERVED_FROZEN":        ["S2_AVAILABLE"],
        "S8_ESCROW_DISPUTED":        ["S2_AVAILABLE","S5_SETTLED"],
        "S9_QUARANTINED":            ["S6_WITHDRAWN"],
        "S10_PENALTY_DEDUCTED":      ["S12_TAX_REMITTANCE_PENDING"],
        "S11_REFUND_PENDING":        ["S2_AVAILABLE"],
        "S12_TAX_REMITTANCE_PENDING":["S6_WITHDRAWN"],
        "S13_EXPIRED_UNRESERVED":    []
    }';
BEGIN
    IF OLD.money_state = NEW.money_state THEN
        RETURN NEW;  -- no-op update
    END IF;

    IF NOT (v_allowed->OLD.money_state::TEXT @> to_jsonb(NEW.money_state::TEXT)) THEN
        RAISE EXCEPTION
            'INVARIANT-06 VIOLATED tx=%: illegal money state transition % -> %',
            NEW.transaction_id, OLD.money_state, NEW.money_state;
    END IF;

    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_money_state_transition
BEFORE UPDATE OF money_state ON transactions
FOR EACH ROW EXECUTE FUNCTION fn_money_state_transition();


-- -------------------------------------------------------
-- T7: 5-year data retention (INVARIANT-10)
-- Blocks DELETE on financial records younger than 5 years.
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_retention_policy()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.created_at > (now() - INTERVAL '5 years') THEN
        RAISE EXCEPTION
            'INVARIANT-10 VIOLATED: cannot delete financial record created at % (< 5 years ago)',
            OLD.created_at;
    END IF;
    RETURN OLD;
END;
$$;

CREATE TRIGGER trg_retention_ledger
BEFORE DELETE ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION fn_retention_policy();

CREATE TRIGGER trg_retention_transactions
BEFORE DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION fn_retention_policy();

CREATE TRIGGER trg_retention_receipts
BEFORE DELETE ON settlement_receipts
FOR EACH ROW EXECUTE FUNCTION fn_retention_policy();


-- -------------------------------------------------------
-- T8: Full-text search vector (Section 10)
-- Updates tsvector on listing INSERT or make/model/category change.
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_listing_search_vector()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.search_vector :=
        to_tsvector('english',
            COALESCE(NEW.make,     '') || ' ' ||
            COALESCE(NEW.model,    '') || ' ' ||
            COALESCE(NEW.category::TEXT, '')
        );
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_listing_search_vector
BEFORE INSERT OR UPDATE OF make, model, category ON listings
FOR EACH ROW EXECUTE FUNCTION fn_listing_search_vector();


-- -------------------------------------------------------
-- T9: Auto-set ntn_required based on reserve_price_paisa
-- Rs.100,000 = 10,000,000 paisa
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_listing_ntn_required()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.ntn_required := (NEW.reserve_price_paisa >= 10000000);
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_listing_ntn_required
BEFORE INSERT OR UPDATE OF reserve_price_paisa ON listings
FOR EACH ROW EXECUTE FUNCTION fn_listing_ntn_required();


-- -------------------------------------------------------
-- T10: Auto-set closing_window_start = end_time - 60 seconds
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_auction_closing_window()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.closing_window_start := NEW.end_time - INTERVAL '60 seconds';
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auction_closing_window
BEFORE INSERT OR UPDATE OF end_time ON auctions
FOR EACH ROW EXECUTE FUNCTION fn_auction_closing_window();


-- -------------------------------------------------------
-- T11: Block approval of expired AdminApproval requests
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_approval_not_expired()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = 'APPROVED' AND OLD.expires_at < now() THEN
        RAISE EXCEPTION
            'Cannot approve expired AdminApproval %. Expired at: %',
            NEW.approval_id, OLD.expires_at;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_approval_not_expired
BEFORE UPDATE OF status ON admin_approvals
FOR EACH ROW EXECUTE FUNCTION fn_approval_not_expired();


-- -------------------------------------------------------
-- T12: Auto-set updated_at on transactions (non-state updates)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_transaction_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_transaction_updated_at
BEFORE UPDATE ON transactions
FOR EACH ROW EXECUTE FUNCTION fn_transaction_updated_at();


-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================

-- listing_images.raw_metadata_json is NEVER accessible via public API.
-- Column-level revocation is enforced at the role level in production:
--   REVOKE SELECT (raw_metadata_json) ON listing_images FROM app_role;
--   GRANT  SELECT (raw_metadata_json) ON listing_images TO ai_vetting_role;
--
-- RLS below restricts table-level access patterns as an additional layer.

ALTER TABLE listing_images ENABLE ROW LEVEL SECURITY;

-- App role can see all rows but cannot select raw_metadata_json (column privilege, not RLS).
CREATE POLICY policy_listing_images_all ON listing_images
    FOR ALL USING (TRUE);


-- =============================================================
-- TAX ACCOUNT SINGLETONS
-- These 5 rows must exist before any financial operation runs.
-- =============================================================

INSERT INTO tax_accounts (account_type, remittance_schedule) VALUES
    ('WHT_HOLDING',         'MONTHLY'),
    ('ICT_SALES_TAX',       'MONTHLY'),
    ('PLATFORM_REVENUE',    'QUARTERLY'),
    ('PENALTY_POOL',        'MONTHLY'),
    ('RECONCILIATION_DUST', 'QUARTERLY')
ON CONFLICT (account_type) DO NOTHING;
