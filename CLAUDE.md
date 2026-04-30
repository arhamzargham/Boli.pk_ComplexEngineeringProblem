# BOLI.PK — COMPLETE PROJECT CONTEXT FOR CLAUDE CODE
# This file is the single source of truth for all architectural, design, and business decisions.
# Every decision documented here has been finalized after months of iterative design review.
# Do not deviate from anything written here without explicit instruction.

---

## 1. PROJECT IDENTITY

**Name:** Boli.pk
**Tagline:** "Boli tumhari. Guarantee hamari."
**Type:** AI-verified escrow and bidding platform for high-value C2C transactions in Pakistan
**Launch Category:** Smartphones (IMEI-verifiable assets)
**Team:** Arham Jan (01-131232-013) & Abdul Qayyum (01-131232-003) — Bahria University Islamabad
**Academic Context:** Complex Engineering Problem (CEP) across 6 courses — Web Engineering, SQA, HCI, Cloud Computing, Technical Writing, Artificial Intelligence

**Core Problem Being Solved:**
Pakistani C2C marketplaces (OLX, Facebook Marketplace) expose buyers and sellers to counterfeit currency fraud, ghost bidding, item misrepresentation, and physical safety risk at meetups. Boli.pk eliminates these by replacing blind human trust with a mathematically enforced escrow system, AI-verified listings, and a cryptographic QR settlement protocol.

**The Five Core Engines (in lifecycle order):**
1. Regulatory Onboarding Engine — KYC/NTN verification, tax bracket assignment
2. AI Vetting Engine — 6-check listing verification pipeline, trust badge assignment
3. Zero-Sum Bidding Engine — real-time WebSocket auction with proof-of-funds enforcement
4. Escrow State Machine — 13-state money lifecycle management, IMEI verification at meetup
5. Cryptographic Settlement Engine — biometric-gated QR, 2PC protocol, atomic 5-way split

---

## 2. TECHNOLOGY STACK (ADR-001 — ACCEPTED)

All technology choices are final. Do not suggest alternatives.

| Layer | Technology | Version | Reason |
|---|---|---|---|
| Bidding Engine / API Gateway | Go (Golang) | 1.22+ | Native goroutine concurrency for C10K WebSocket connections without thread overhead |
| WebSocket Server | Centrifugo | 5.x | Battle-tested WebSocket server, Redis pub/sub clustering, built-in presence/history |
| Bid Cache / EDA Bus | Redis | 7.x with Redis Streams | Sub-15ms P99 latency, Streams provide persistent ordered log for EDA |
| Financial Ledger | PostgreSQL | 16.x | ACID compliance, row-level locking, native JSONB, append-only enforcement via triggers |
| AI Vetting Microservice | Python + FastAPI | 3.11+ / 0.110+ | OpenCV, Pillow, ML libraries; FastAPI for async REST; isolated from bidding engine |
| Frontend | React + Next.js | 18.x / 14+ | SSR for SEO, PWA for camera/geolocation access, component-driven state management |
| Containerisation | Docker + Docker Compose | Latest stable | Single-command offline CEP deployment, all mocks bundled |
| CI/CD | GitHub Actions | — | Automated testing, SAST, SCA on every commit |

**Single-Command CEP Deployment:**
```bash
docker-compose up
```
All external dependencies (PTA DIRBS, FBR NTN, payment gateway) are fulfilled by locally running mock services in the compose configuration. No external internet required for demo.

---

## 3. INFRASTRUCTURE AND DATA SOVEREIGNTY (ADR-002 — ACCEPTED)

**Tiered Infrastructure Model:**

| Data Type | Hosting | Replication | RPO | Uptime Target |
|---|---|---|---|---|
| Financial ledger (PostgreSQL) | Pakistani data center (PTCL/Nayatel/TPS) | Async streaming replication | 5 seconds | 99.5% |
| KYC / PII records | Pakistani data center | Same as above | 5 seconds | 99.5% |
| Listing images, notification logs | International cloud (Cloudflare R2) | Synchronous | 0 seconds | 99.9% |
| Redis / Centrifugo | Same node as Go server | — | Ephemeral | 99.5% |

**RTO:** Under 5 minutes for database failover.
**Uptime target is 99.5% not 99.99%** — Pakistani data centers cannot provide Tier-1 SLAs. This is a documented constraint, not a design failure.

**SBP Compliance:** All PII and financial data must physically reside within Pakistan. Violation = immediate operating license revocation.

---

## 4. EVENT-DRIVEN ARCHITECTURE (ADR-003 — ACCEPTED)

**Critical Rule:** EDA applies to the bidding engine ONLY. All financial operations (escrow locks, settlements, refunds, penalties) use synchronous PostgreSQL transactions. Never route financial mutations through Redis Streams.

**Bidding Engine Data Flow (CQRS-Lite):**
```
Buyer places bid
    → Go WebSocket gateway validates proof-of-funds (Redis read)
    → If valid: write bid event to Redis Stream (bids:{auctionId})
    → Redis Stream consumer (PostgreSQL write worker) processes sequentially
    → Worker acquires SELECT FOR UPDATE on wallet row
    → Worker commits bid to PostgreSQL + updates Redis cache
    → Centrifugo broadcasts updated auction state to all connected clients
```

**Why CQRS-Lite:**
- READ path: Redis cache (sub-15ms, serves live auction state to all bidders)
- WRITE path: PostgreSQL via Redis Stream consumer (serialised, ACID-safe)
- Redis is NEVER the source of truth for financial values. PostgreSQL is always the authoritative ledger.

**Redis Failure Handling (Gap 24 — RESOLVED):**
If Redis goes down during a live auction:
- Go gateway detects Redis connection failure
- Circuit breaker opens after 3 consecutive Redis failures
- All new bid requests receive HTTP 503 "Auction temporarily unavailable"
- NO fallback to direct PostgreSQL writes for bids — this would bypass the serialisation guarantee and risk race conditions
- Existing auction state remains visible (last cached state served)
- Circuit breaker checks Redis health every 10 seconds and closes when Redis recovers
- Active auction timer is paused server-side during outage (Centrifugo broadcasts pause event)

**Centrifugo Clustering (Gap 25 — RESOLVED):**
Single Centrifugo node for CEP. Multi-node clustering via Redis pub/sub is architecturally supported by Centrifugo out of the box and is the documented Phase 2 HA path. CEP does not require multi-node.

---

## 5. AI VETTING PIPELINE (ADR-004 — ACCEPTED)

**Pipeline Structure:** 3 deterministic hard gates → 3 probabilistic checks → badge assignment

**Gate 1 — IMEI Format Validation (Deterministic, HARD GATE):**
- Validate 15-digit numeric format
- Apply Luhn algorithm (ISO/IEC 7812)
- **IMEI Format Policy (Gap 14 — RESOLVED):** Accept 15-digit IMEI1 only. Dual-SIM devices: seller must specify IMEI1 (first SIM slot) at listing creation. This is the IMEI used for all verification. If seller enters IMEI2, that is their choice and it is the IMEI that must be presented at meetup.
- FAIL = listing REJECTED immediately. No badge. No public listing.

**Gate 2 — PTA DIRBS Lookup (Deterministic, HARD GATE):**
- Query mock DIRBS service with IMEI
- REGISTERED_CLEAN → proceed to Gate 3
- BLACKLISTED → listing REJECTED immediately
- UNREGISTERED → listing gets REVIEWED badge (disclosure, not rejection). Buyer sees "Unregistered device — verify before purchase." Seller must acknowledge PTA disclosure before publishing.
- For CEP: mock service with 3 pre-configured test responses

**Gate 3 — GSMA TAC Match (Deterministic, HARD GATE):**
- Extract TAC (first 8 digits of IMEI)
- Query mock GSMA TAC database
- Verify make + model returned by TAC matches make + model entered by seller
- MISMATCH = listing REJECTED (IMEI does not match the device described)

**Check 4 — Image Consistency Score (Probabilistic, 0–40 points):**
- Python Pillow + OpenCV: detect if images show a real physical device
- Check for stock photo signatures, screenshot artifacts, image editing metadata
- Extract EXIF data for AI use (GPS stored in restricted access, stripped from public image)
- Score: 0–40 points toward composite

**Check 5 — Condition Assessment Score (Probabilistic, 0–30 points):**
- Visual analysis of screen condition, body condition, visible damage
- Compared against seller's stated conditionRating (1–10)
- Significant mismatch (e.g., conditionRating=9 but images show heavy scratches): score penalty
- Score: 0–30 points toward composite

**Check 6 — Price Sanity Score (Probabilistic, 0–30 points):**
- Compare reservePricePaisa against market price data for that make/model/condition
- If price is >40% below market: priceBelowMarketFlag = true (potential stolen device signal)
- Score: 0–30 points toward composite

**Composite Score → Badge Assignment:**
```
compositeScore = Check4 + Check5 + Check6  (0–100)

If any HARD GATE fails → REJECTED (no score computed)
If compositeScore >= 75 → VERIFIED badge
If compositeScore >= 50 → REVIEWED badge  
If compositeScore < 50 → PENDING_REVIEW (manual admin review required)
```

**VERIFIED:** Green badge. Full AI confidence. DIRBS registered.
**REVIEWED:** Yellow badge. DIRBS unregistered OR borderline probabilistic scores. Buyer explicitly warned.
**PENDING_REVIEW:** No public listing. Admin must manually classify.
**REJECTED:** Listing blocked. Seller notified with rejectionReasonCode.

**AI Service Timeout:** 5,000ms hard timeout enforced by Go gateway. On timeout → MANUAL_REVIEW_REQUIRED (same as PENDING_REVIEW). Seller notified.

**Manual Review SLA (Gap 13 — RESOLVED):**
- Admin has 48 hours to review PENDING_REVIEW listings
- After 48 hours: seller receives delay notification
- After 7 days: listing auto-expires. Seller must resubmit (creates a new ListingVetting record; previous record retained for audit)
- Seller can cancel listing at any time during manual review (status → REJECTED by seller choice)
- Maximum 3 resubmissions per listing before permanent rejection (prevents abuse)

**DIRBS Re-check at Meetup (Gap 12 — RESOLVED):**
At the moment of IMEI scan at meetup, the system performs a LIVE DIRBS re-check in addition to comparing against the listed IMEI. If the device was REGISTERED_CLEAN at listing time but is now BLACKLISTED at meetup time:
- This is treated as an IMEI_MISMATCH outcome (same consequence: auto-refund, seller suspension)
- MeetupSession stores: dirbs_recheck_result ENUM {CLEAN|BLACKLISTED|UNREGISTERED}
- Rationale: devices get stolen between listing and meetup. Protecting buyer from receiving a blacklisted device is non-negotiable.

**Image Storage Architecture (Gap 26 — RESOLVED):**
1. Seller uploads image to AI microservice endpoint
2. Python extracts EXIF (GPS + device timestamp) → stored in ListingImage.rawMetadataJson (restricted access, used by AI pipeline only)
3. Python strips EXIF using Pillow → clean image written to permanent storage
4. Raw image with EXIF is NEVER written to permanent storage — only exists in memory during processing
5. CEP storage: Docker volume (local filesystem). Production: Cloudflare R2 (S3-compatible)
6. Public gallery URLs serve the EXIF-stripped version only

**Vetting Complete Notification (Gap 11 — RESOLVED):**
VettingCompleteNotification is the 7th notification subclass:
```
VettingCompleteNotification extends Notification
+ vettingId : UUID
+ listingId : UUID  
+ classification : ENUM {VERIFIED|REVIEWED|PENDING_REVIEW|REJECTED}
+ rejectionReasonCode : VARCHAR {nullable}
+ channel : PUSH + IN_APP (both fired simultaneously)
```

---

## 6. COMPLETE DATA MODEL — ALL 32 CLASSES

### PACKAGE 1 — USER & IDENTITY

**User**
```
+ userId : UUID {PK, immutable}
+ cnicEncrypted : BYTEA {AES-256-GCM, KMS-managed key}
+ ntnEncrypted : BYTEA {nullable, AES-256-GCM}
+ kycTier : ENUM {BASIC|FULL}
  - BASIC = CNIC verified only. 24h escrow exposure limit: Rs.200,000
  - FULL = CNIC + NTN verified. 24h escrow exposure limit: Rs.2,000,000
+ trustScore : SMALLINT {0-100, recalculated on each transaction completion}
+ role : ENUM {BUYER|SELLER|ADMIN}
+ accountStatus : ENUM {PARTIAL_ACTIVE|FULL_ACTIVE|SELLER_SUSPENDED|BUYER_BANNED|PERMANENTLY_BANNED}
  - PARTIAL_ACTIVE: OTP verified, CNIC not yet completed — can browse, cannot bid/list
  - FULL_ACTIVE: KYC complete — full platform access
+ sellerSuspendedUntil : TIMESTAMPTZ {nullable — null means not suspended}
+ sellerSuspensionCount : SMALLINT {0, 1, 2 — third offence triggers PERMANENTLY_BANNED}
+ buyerBannedUntil : TIMESTAMPTZ {nullable}
+ buyerOffenceCount : SMALLINT {0, 1, 2}
+ accessibilityPrefs : JSONB {high_contrast: bool, haptics_disabled: bool, font_size: ENUM}
+ preferredLocale : ENUM {EN|UR}
+ duressPin : VARCHAR {bcrypt hashed, nullable — null means not set up}
+ activeListingCount : SMALLINT {denormalised, max 5 for CEP}
+ createdAt : TIMESTAMPTZ {immutable}
+ deletedAt : TIMESTAMPTZ {nullable — soft delete}
+ anonymisedUuid : UUID {nullable — set on account deletion, replaces PII fields}
--
+ calculateTrustScore() : SMALLINT
  Formula: (completionRate × 40) + (nonDisputeRate × 30) + (verificationBonus × 20) + (tenureBonus × 10)
  - completionRate = completed_transactions / total_won_auctions (default 0.5 for new users with <3 transactions)
  - nonDisputeRate = 1.0 - (disputes_where_user_at_fault / total_transactions)
  - verificationBonus = kycTier == FULL ? 1.0 : 0.5
  - tenureBonus = min(months_since_account_creation / 24, 1.0)
  All components normalised 0-1, multiplied by weights, summed, × 100 stored as SMALLINT
+ anonymisePII() : void
  Sets cnicEncrypted=null, ntnEncrypted=null, all PII fields to null, sets anonymisedUuid
  Ledger entries and transactions preserved under anonymisedUuid for 5-year retention
```

**UserSession**
```
+ sessionId : UUID {PK}
+ userId : UUID {FK → User}
+ deviceFingerprint : VARCHAR {browser/device fingerprint hash}
+ ipAddress : INET
+ networkBssid : VARCHAR {nullable — WiFi BSSID for shill detection}
+ jwtAccessTokenHash : VARCHAR {SHA-256 of JWT, NOT the JWT itself}
+ refreshTokenHash : VARCHAR {SHA-256 of refresh token, NOT the token itself}
+ accessTokenExpiresAt : TIMESTAMPTZ {now + 15 minutes}
+ refreshTokenExpiresAt : TIMESTAMPTZ {now + 7 days}
+ isActive : BOOLEAN {false = invalidated by concurrent session override}
+ createdAt : TIMESTAMPTZ
--
+ invalidate() : void {sets isActive = false}
+ isExpired() : BOOLEAN
```

**JWT Structure:**
```json
{
  "sub": "userId",
  "role": "BUYER|SELLER|ADMIN",
  "kycTier": "BASIC|FULL",
  "sessionId": "sessionId",
  "iat": 1234567890,
  "exp": 1234568790
}
```
Access token TTL: 15 minutes. Refresh token TTL: 7 days, HTTP-only Secure cookie.
Refresh rotation: each /auth/refresh call issues new access token + new refresh token. Old refresh token immediately invalidated in UserSession.

**Concurrent Session Termination (NR-05):**
Redis maintains a set `active_sessions:{userId}` containing active sessionIds. On new login: previous sessionId removed from Redis set, isActive set to false in PostgreSQL. Centrifugo WebSocket server checks `active_sessions:{userId}` on every bid/financial message. If sessionId not in set: close connection, send SESSION_TERMINATED event to client.

**KycRecord**
```
+ kycId : UUID {PK}
+ userId : UUID {FK → User, UNIQUE}
+ cnicVerifiedAt : TIMESTAMPTZ {nullable}
+ ntnVerifiedAt : TIMESTAMPTZ {nullable}
+ ntnStatus : ENUM {FILER|NON_FILER|UNVERIFIED}
+ biometricHashSha256 : CHAR(64) {one-way SHA-256 of biometric template — never raw biometric}
+ verificationSource : ENUM {MOCK|NADRA_LIVE}
+ updatedAt : TIMESTAMPTZ
--
+ verifyNtn() : BOOLEAN {calls mock/live FBR service}
+ tierUpgrade() : void {promotes User.kycTier to FULL}
```

**Registration Flow (Gap 6 — RESOLVED):**
```
Step 1: Phone number entry → OTP sent via SMS (mock for CEP)
Step 2: OTP verified → UserSession created → accountStatus = PARTIAL_ACTIVE
         User can now browse marketplace but CANNOT bid or list
Step 3: CNIC upload → AI OCR extracts data → mock NADRA verification
Step 4: CNIC verified → KycRecord.cnicVerifiedAt set → accountStatus = FULL_ACTIVE
Step 5 (optional at registration, required for listings above Rs.100k):
         NTN entry → mock FBR verification → kycTier = FULL
Step 6: Duress PIN setup screen — 6-digit PIN, separate from account password
         Stored as bcrypt hash in User.duressPin
         Optional for CEP demo, displayed as recommended safety feature
```

**PenaltyConsentRecord**
```
+ consentId : UUID {PK}
+ userId : UUID {FK → User}
+ policyVersion : VARCHAR {e.g. "GPR-v1.0"}
+ acknowledgedAt : TIMESTAMPTZ {immutable}
+ ipAtConsent : INET
+ deviceFingerprintAtConsent : VARCHAR
```
Account activation is BLOCKED until this record exists. Created at Step 4 of registration flow (after CNIC verification, before full access).

**Wallet**
```
+ walletId : UUID {PK}
+ userId : UUID {FK → User, UNIQUE — one wallet per user}
+ availablePaisa : BIGINT {funds free for bidding — INVARIANT: always >= 0}
+ reservedPaisa : BIGINT {committed to active bids — INVARIANT: always >= 0}
+ lockedPaisa : BIGINT {in escrow — INVARIANT: always >= 0}
+ totalDepositedPaisa : BIGINT {running sum of all deposits minus withdrawals}
+ dailyEscrowExposurePaisa : BIGINT {rolling 24h counter, reset at midnight UTC}
+ updatedAt : TIMESTAMPTZ
--
INVARIANT (enforced by pre-commit PostgreSQL trigger):
  availablePaisa + reservedPaisa + lockedPaisa = totalDepositedPaisa AT ALL TIMES
  Any transaction violating this MUST be rolled back.
  
+ reserve(amount : BIGINT) : void
  availablePaisa -= amount; reservedPaisa += amount
  Guards: amount > 0, availablePaisa >= amount
+ release(amount : BIGINT) : void  
  reservedPaisa -= amount; availablePaisa += amount
+ lock(amount : BIGINT) : void
  reservedPaisa -= amount; lockedPaisa += amount
+ unlock(amount : BIGINT) : void
  lockedPaisa -= amount; availablePaisa += amount
+ deductPenalty(amount : BIGINT) : void
  availablePaisa -= amount
  Guards: availablePaisa >= amount (penalty cannot exceed available balance)
```

---

### PACKAGE 2 — LISTING & AI VETTING

**Listing**
```
+ listingId : UUID {PK}
+ sellerId : UUID {FK → User}
+ category : ENUM {SMARTPHONE} {extensible via JSONB metadata}
+ imei : VARCHAR(15) {IMEI1 of the device — validated by Luhn in Gate 1}
+ make : VARCHAR {e.g. "Apple", "Samsung"}
+ model : VARCHAR {e.g. "iPhone 14 Pro", "Galaxy S23"}
+ storageGb : SMALLINT {nullable}
+ colorVariant : VARCHAR {nullable}
+ conditionRating : SMALLINT {1–10, seller-stated, AI-verified in Check 5}
+ reservePricePaisa : BIGINT {MINIMUM bid — bids below this are rejected at gateway}
+ reservePriceVisible : BOOLEAN {true for CEP — reserve price is shown to buyers}
+ categoryMetadata : JSONB {extensible per-category attributes — vehicle VIN, laptop serial, etc.}
+ ptaStatus : ENUM {REGISTERED_CLEAN|UNREGISTERED|BLACKLISTED}
  {set by Gate 2 result, stored for buyer display}
+ status : ENUM {PENDING_REVIEW|ACTIVE|SOLD|UNSOLD_EXPIRED|REJECTED|CANCELLED_BY_SELLER}
+ ntnRequired : BOOLEAN {true if reservePricePaisa >= 10000000 (Rs.100,000)}
+ resubmissionCount : SMALLINT {0–3, max 3 resubmissions before permanent REJECTED}
+ createdAt : TIMESTAMPTZ
+ publishedAt : TIMESTAMPTZ {nullable — set when status transitions to ACTIVE}
+ expiresAt : TIMESTAMPTZ {nullable — set to publishedAt + 30 days}
--
+ requiresNtn() : BOOLEAN
+ canRelist() : BOOLEAN {status == UNSOLD_EXPIRED}
+ canResubmit() : BOOLEAN {status == REJECTED AND resubmissionCount < 3}
```

**Reserve Price Policy (Gap 19 — RESOLVED):**
- Reserve price is a HARD MINIMUM. Bids strictly below reservePricePaisa are rejected at the Go gateway before entering the bidding engine. Buyer sees: "Minimum bid is Rs.X,XXX."
- Reserve price IS visible to buyers in the auction room.
- There is no "reserve not met" state — by definition all accepted bids are at or above reserve.
- Therefore: UNSOLD_EXPIRED = truly zero valid bids received.

**Simultaneous Listings Cap (Gap 20 — RESOLVED):**
- Maximum 5 active listings per seller for CEP (enforced via User.activeListingCount check on CreateListing)
- This limit is a configuration constant, not hardcoded
- Listing rejection and resubmission flow: see Section above in AI pipeline

**ListingImage**
```
+ imageId : UUID {PK}
+ listingId : UUID {FK → Listing}
+ storageUrl : TEXT {EXIF-stripped version — public}
+ rawMetadataJson : JSONB {GPS + device timestamp — restricted access, AI pipeline only}
  {NEVER accessible via public API endpoints}
+ uploadedAt : TIMESTAMPTZ
+ sortOrder : SMALLINT {display order, 1 = primary image}
--
+ stripExif() : void {Python Pillow — called server-side before permanent storage}
+ extractGpsCoordinates() : POINT {for AI pipeline use only}
```

**ListingVetting**
```
+ vettingId : UUID {PK}
+ listingId : UUID {FK → Listing, UNIQUE per listing per submission}
  {resubmissions create NEW ListingVetting records; previous records retained}
+ submittedAt : TIMESTAMPTZ
+ status : ENUM {QUEUED|PROCESSING|COMPLETED|TIMED_OUT|FAILED|MANUAL_REVIEW_REQUIRED}
+ completedAt : TIMESTAMPTZ {nullable}
+ timeoutAt : TIMESTAMPTZ {submittedAt + 5000ms}
+ attemptCount : SMALLINT {incremented on timeout retry, max 2 attempts before MANUAL_REVIEW_REQUIRED}
+ degradedToManual : BOOLEAN {true if timed out and routed to manual}
-- Gate Results (null until COMPLETED) --
+ gate1LuhnPass : BOOLEAN {nullable}
+ gate2DirbsResult : ENUM {REGISTERED_CLEAN|UNREGISTERED|BLACKLISTED|null}
+ gate3TacMatch : BOOLEAN {nullable}
-- Probabilistic Check Scores (null until COMPLETED) --
+ check4ImageScore : SMALLINT {0–40, nullable}
+ check5ConditionScore : SMALLINT {0–30, nullable}
+ check6PriceScore : SMALLINT {0–30, nullable}
+ compositeScore : SMALLINT {0–100, nullable — sum of checks 4+5+6}
-- Result (null until COMPLETED) --
+ classification : ENUM {VERIFIED|REVIEWED|PENDING_REVIEW|REJECTED|null}
+ rejectionReasonCode : VARCHAR {nullable}
  Codes: LUHN_FAIL | DIRBS_BLACKLISTED | TAC_MISMATCH | LOW_IMAGE_SCORE | MANUAL_REJECTED | MAX_RESUBMISSIONS
+ priceBelowMarketFlag : BOOLEAN {nullable — true if Check 6 detects >40% below market}
+ modelVersion : VARCHAR {nullable — AI model version used, for reproducibility}
+ adminReviewedBy : UUID {nullable — FK → User(admin) if manually reviewed}
+ adminReviewedAt : TIMESTAMPTZ {nullable}
+ manualReviewDeadline : TIMESTAMPTZ {nullable — set to submittedAt + 48h when degradedToManual = true}
-- 
INVARIANT: IF status = COMPLETED THEN classification IS NOT NULL
INVARIANT: IF status != COMPLETED THEN classification IS NULL
+ isTimedOut() : BOOLEAN
+ escalateToManual() : void
+ classify() : ENUM
+ computeCompositeScore() : SMALLINT
```

---

### PACKAGE 3 — AUCTION & BIDDING

**Auction**
```
+ auctionId : UUID {PK}
+ listingId : UUID {FK → Listing, UNIQUE — one auction per listing}
+ startTime : TIMESTAMPTZ
+ endTime : TIMESTAMPTZ {startTime + seller-chosen duration, min 1h max 7 days}
+ reservePricePaisa : BIGINT {copied from Listing at auction creation — immutable}
+ status : ENUM {DRAFT|SCHEDULED|ACTIVE|CLOSING|CLOSED_WITH_BIDS|CLOSED_NO_BIDS|CANCELLED}
+ winnerBidId : UUID {FK → Bid, nullable — set on CLOSED_WITH_BIDS}
+ totalBidCount : INTEGER {denormalised — incremented on each accepted bid}
+ closingWindowStart : TIMESTAMPTZ {endTime - 60 seconds — triggers CLOSING state}
+ closedAt : TIMESTAMPTZ {nullable}
+ cancelledBy : ENUM {ADMIN|SELLER|null}
+ cancelledAt : TIMESTAMPTZ {nullable}
-- 
+ close() : void
+ determineWinner() : UUID {highest bid at close time}
+ hasBids() : BOOLEAN {totalBidCount > 0}
+ isInClosingWindow() : BOOLEAN
```

**Auction State Machine:**
```
[START] → DRAFT
DRAFT → SCHEDULED  (seller sets startTime + reservePrice)
DRAFT → CANCELLED  (admin rejects listing post-vetting, OR seller deletes before scheduling)
SCHEDULED → ACTIVE  (startTime reached — system auto-triggers)
SCHEDULED → CANCELLED  (seller cancels before startTime OR admin detects fraud)
ACTIVE → CLOSING  (endTime - 60 seconds reached)
ACTIVE → CANCELLED  (admin cancels — fraud detected mid-auction)
CLOSING → CLOSED_WITH_BIDS  (endTime reached AND totalBidCount > 0)
CLOSING → CLOSED_NO_BIDS  (endTime reached AND totalBidCount = 0)
CLOSED_WITH_BIDS → [END]  (winner routed to Escrow, losers routed to Similar Listings)
CLOSED_NO_BIDS → [END]  (Listing → UNSOLD_EXPIRED, money → S13_EXPIRED_UNRESERVED)
CANCELLED → [END]  (all bids voided, all reserved funds released → S2_AVAILABLE)
```

NOTE: DRAFT → CANCELLED is implemented in code even though diagrams may not show it. This is a known gap in the diagrams, not a gap in the system.

**Auction Timer Extension Policy (Gap 2 — RESOLVED):**
No timer extension for CEP. Sniping is a known risk documented as a post-CEP improvement. Rationale: extension logic adds complexity to the closing window state machine and Centrifugo broadcast that is not justified for academic demonstration.

**Bid**
```
+ bidId : UUID {PK}
+ auctionId : UUID {FK → Auction}
+ bidderId : UUID {FK → User}
+ amountPaisa : BIGINT {raw bid value — must be >= auction.reservePricePaisa}
+ totalWithFeePaisa : BIGINT {amountPaisa × 1.02 — total buyer commitment including 2% fee}
+ status : ENUM {PENDING|ACCEPTED|OUTBID|WINNING|VOIDED}
+ shillDetectionFlag : BOOLEAN {default false — set by SCR-01 check}
+ idempotencyKey : UUID {client-generated UUIDv4, unique per bid attempt}
+ createdAt : TIMESTAMPTZ {millisecond precision — tiebreaker for simultaneous bids}
--
+ reserve() : void {calls Wallet.reserve(totalWithFeePaisa)}
+ void() : void {calls Wallet.release(totalWithFeePaisa), sets status = VOIDED}
+ isShillBid() : BOOLEAN
```

**Shill Bidding Detection (Gap 29 — RESOLVED):**
A bid is flagged as shill when:
- Condition A: bidder.ipAddress == seller.activeSession.ipAddress AND bidder.deviceFingerprint == seller.activeSession.deviceFingerprint
- Condition B: bidder.networkBssid == seller.activeSession.networkBssid AND bidder is on seller's known-associate list (future feature — for CEP: BSSID match alone triggers flag)
- Single IP match alone: logs warning, does NOT block bid
- Flag action: bid.shillDetectionFlag = true, bid silently dropped, admin alert fired
- Permanent ban (GPR-06) requires admin confirmation of pattern, not automatic on single flag

**Bid History Visibility (Gap 21 — RESOLVED):**
- Current highest bid amount: visible to all participants
- Full bid history (amounts only, NO bidder identities): visible to all during auction
- Bidder identities: NEVER revealed during auction
- Post-auction: seller sees winning bidder identity via Transaction record. Losing bidder identities never revealed.

---

### PACKAGE 4 — FINANCIAL & LEDGER

**TaxAccount**
```
+ accountId : UUID {PK}
+ accountType : ENUM {WHT_HOLDING|ICT_SALES_TAX|PLATFORM_REVENUE|PENALTY_POOL|RECONCILIATION_DUST}
+ balancePaisa : BIGINT {running total}
+ lastRemittedAt : TIMESTAMPTZ {nullable}
+ remittanceSchedule : ENUM {MONTHLY|QUARTERLY}
--
WHT_HOLDING: monthly FBR remittance. Access: finance admin only.
ICT_SALES_TAX: monthly FBR remittance. Access: finance admin only.
PLATFORM_REVENUE: quarterly distribution. Access: finance admin only.
PENALTY_POOL: holds penalty amounts pending seller credit and platform credit. Access: system only.
RECONCILIATION_DUST: fractional Paisa from Banker's Rounding. Cleared quarterly by Maker-Checker admin approval. Access: superadmin only.
```

**Transaction**
```
+ transactionId : UUID {PK}
+ auctionId : UUID {FK → Auction}
+ buyerId : UUID {FK → User}
+ sellerId : UUID {FK → User}
+ listingId : UUID {FK → Listing}
+ winningBidId : UUID {FK → Bid}
+ winningBidPaisa : BIGINT {the raw bid amount}
+ buyerTotalPaisa : BIGINT {winningBidPaisa × 1.02 — total buyer wallet deduction}
+ buyerFeePaisa : BIGINT {winningBidPaisa × 0.02}
+ sellerFeePaisa : BIGINT {winningBidPaisa × 0.02}
+ whtPaisa : BIGINT {winningBidPaisa × 0.01 — seller's WHT}
+ ictTaxPaisa : BIGINT {(buyerFeePaisa + sellerFeePaisa) × 0.15}
+ sellerNetPaisa : BIGINT {winningBidPaisa - sellerFeePaisa - whtPaisa}
+ platformRevenuePaisa : BIGINT {buyerFeePaisa + sellerFeePaisa - ictTaxPaisa}
+ moneyState : ENUM {S1..S13} — see Money State Machine section
+ settlementHashSha256 : CHAR(64) {nullable — set at settlement}
+ createdAt : TIMESTAMPTZ
+ updatedAt : TIMESTAMPTZ
--
SETTLEMENT MATH VERIFICATION (Rs.200,000 example):
  winningBidPaisa = 20,000,000 (Rs.200,000)
  buyerTotalPaisa = 20,400,000 (Rs.204,000)
  buyerFeePaisa = 400,000 (Rs.4,000)
  sellerFeePaisa = 400,000 (Rs.4,000)
  whtPaisa = 200,000 (Rs.2,000)
  ictTaxPaisa = 120,000 (Rs.1,200) — 15% of Rs.8,000 total fees
  sellerNetPaisa = 19,400,000 (Rs.194,000)
  platformRevenuePaisa = 680,000 (Rs.6,800)
  
  ZERO-SUM CHECK:
  IN:  buyerTotalPaisa = 20,400,000
  OUT: sellerNetPaisa(19,400,000) + whtPaisa(200,000) + ictTaxPaisa(120,000) + platformRevenuePaisa(680,000)
       = 19,400,000 + 200,000 + 120,000 + 680,000 = 20,400,000 ✓

+ validateZeroSum() : BOOLEAN
+ computeSettlementHash() : CHAR(64)
+ transitionState(newState : ENUM) : void
```

**LedgerEntry**
```
+ entryId : UUID {PK}
+ transactionId : UUID {FK → Transaction, nullable — null for deposit/withdrawal entries}
+ walletId : UUID {FK → Wallet, nullable — null for tax account entries}
+ taxAccountId : UUID {FK → TaxAccount, nullable — used for WHT, ICT, revenue, penalty entries}
+ amountPaisa : BIGINT {always positive}
+ entryType : ENUM {DEBIT|CREDIT}
+ purpose : ENUM {DEPOSIT|WITHDRAWAL|BID_RESERVE|BID_RELEASE|ESCROW_LOCK|SETTLEMENT_SELLER|
                  SETTLEMENT_WHT|SETTLEMENT_ICT|SETTLEMENT_REVENUE|REFUND|PENALTY_DEDUCT|
                  PENALTY_SELLER_CREDIT|PENALTY_PLATFORM_CREDIT}
+ previousHashSha256 : CHAR(64) {hash of the immediately preceding entry in global chain}
+ currentHashSha256 : CHAR(64) {SHA-256 of: entryId+transactionId+amountPaisa+purpose+previousHash}
+ createdAt : TIMESTAMPTZ {immutable, millisecond precision}
--
RULES:
  INSERT ONLY. No UPDATE or DELETE permitted for any role at any time.
  Pre-commit trigger: verifies zero-sum across all entries in the same transaction batch.
  Background monitor: continuously validates hash chain integrity. Alerts on CHAIN_INTEGRITY_FAILURE.
  
+ computeHash() : CHAR(64)
+ verifyChain() : BOOLEAN
```

**Wallet Top-Up Lifecycle (Gap 8 — RESOLVED):**
For CEP: Admin Funding Module only. Admin logs into admin portal, selects user, enters amount, clicks Fund Wallet. System creates DEPOSIT LedgerEntry, updates Wallet.availablePaisa, transitions money S1→S2.

Production top-up flow (documented for architecture completeness):
1. User taps Top Up, selects amount (min Rs.500, max Rs.100,000 per transaction)
2. Redirected to payment gateway (Raast/JazzCash)
3. Payment gateway posts webhook to /api/v1/webhooks/deposit with HMAC-SHA256 signature
4. Our system validates HMAC, checks idempotency by gateway transaction reference ID (stored in LedgerEntry metadata)
5. If duplicate webhook (same gateway reference ID): return HTTP 200, no new LedgerEntry
6. If first occurrence: create DEPOSIT LedgerEntry, update Wallet.availablePaisa
7. Money state: S1_UNDEPOSITED → S2_AVAILABLE

**Double Top-Up Webhook Protection (Gap 28 — RESOLVED):**
Idempotency key for incoming deposit webhooks is the payment gateway's own transaction reference ID (not our UUID). This is stored in LedgerEntry.metadata JSONB field as `{"gateway_ref": "TXN-ABC123"}`. On each deposit webhook arrival, system queries LedgerEntry WHERE metadata->>'gateway_ref' = incoming_ref. If found: return 200 OK silently. If not found: process deposit. This protects against gateway duplicate-send even if the gateway sends different idempotency keys.

**Withdrawal Lifecycle (Gap 9 — RESOLVED):**
1. Seller requests withdrawal (minimum Rs.200, must have sufficient availablePaisa)
2. System creates WITHDRAWAL LedgerEntry (DEBIT on wallet)
3. Wallet.availablePaisa reduced immediately (funds reserved for withdrawal)
4. Money state: S5_SETTLED (or S2_AVAILABLE) → S6_WITHDRAWN
5. Bank transfer initiated (mocked for CEP: instant mock confirmation)
6. If bank rejects transfer: WITHDRAWAL entry reversed with a DEPOSIT compensating entry, availablePaisa restored, money returns to S2_AVAILABLE. User notified.
7. Partial withdrawal supported (any amount >= minimum, up to full available balance)
8. Bank account verification: IBAN stored on KycRecord, validated format only for CEP

---

### PACKAGE 5 — ESCROW, MEETUP & SETTLEMENT

**Escrow**
```
+ escrowId : UUID {PK}
+ transactionId : UUID {FK → Transaction, UNIQUE}
+ amountPaisa : BIGINT {= transaction.buyerTotalPaisa — total locked including buyer fee}
+ qrSeedEncrypted : BYTEA {AES-256-GCM — see QR Seed Replay Prevention below}
+ qrSeedTtlExpiry : TIMESTAMPTZ {qrSeedGeneratedAt + 120 seconds}
+ qrSeedHash : CHAR(64) {SHA-256 of plaintext seed — stored for replay check without decryption}
+ qrSeedUsed : BOOLEAN {default false — set true on first successful scan}
+ status : ENUM {LOCKED|DISPUTED|RELEASED|REFUNDED|DURESS_FROZEN}
+ twopcPrepareAt : TIMESTAMPTZ {nullable — set when 2PC Phase 1 begins}
+ twopcCommitAt : TIMESTAMPTZ {nullable — set when 2PC Phase 2 commits}
--
+ generateQrSeed() : BYTEA
  Creates new 32-byte cryptographically random seed
  Encrypts with AES-256-GCM using KMS key
  Sets qrSeedEncrypted, qrSeedTtlExpiry, qrSeedHash, qrSeedUsed = false
+ validateQrSeed(incomingSeedHash : CHAR(64)) : BOOLEAN
  Checks: qrSeedHash == incomingSeedHash AND now() < qrSeedTtlExpiry AND qrSeedUsed == false
  On success: sets qrSeedUsed = true (ONE-TIME USE — prevents replay within TTL window)
+ prepareTwopc() : BOOLEAN
+ commitTwopc() : void
+ rollbackTwopc() : void
```

**QR Seed Replay Prevention (Gap 31 — RESOLVED):**
The QR seed is ONE-TIME USE. `Escrow.qrSeedUsed` is set to `true` on the first successful validation. Any subsequent scan within the 120-second TTL window will be rejected because `qrSeedUsed = true`. After TTL expiry, the seed is simply expired (qrSeedTtlExpiry check fails). Attacker who screenshots the QR code and attempts to scan it immediately after the legitimate buyer already scanned it will receive "Seed already used" error. A new seed requires biometric re-authentication by the seller.

**MeetupSession**
```
+ meetupId : UUID {PK}
+ transactionId : UUID {FK → Transaction, UNIQUE}
+ proposedLocation : JSONB {
    lat: DECIMAL,
    lng: DECIMAL,
    address: VARCHAR,
    placeId: VARCHAR  ← Google Places ID for verifiable location reference
  }
+ proposedTime : TIMESTAMPTZ {nullable}
+ buyerConfirmedAt : TIMESTAMPTZ {nullable}
+ sellerConfirmedAt : TIMESTAMPTZ {nullable}
+ confirmedAt : TIMESTAMPTZ {nullable — set when BOTH parties have confirmed}
+ imeiScannedAt : TIMESTAMPTZ {nullable}
+ imeiScanResult : ENUM {PENDING|MATCH|MISMATCH}
+ dirbs_recheck_result : ENUM {CLEAN|BLACKLISTED|UNREGISTERED|null}
  {null = not yet scanned, set at time of IMEI scan at meetup}
+ scannedImei : VARCHAR(15) {nullable — what the scanner actually read}
+ qrScannedAt : TIMESTAMPTZ {nullable}
+ geolocationAtScan : JSONB {lat, lng, accuracy_metres, source: ENUM{GPS|LAST_KNOWN|IP_FALLBACK}}
+ lateNightWarningShown : BOOLEAN {true if meetup was scheduled between 22:00-06:00}
+ duressActivated : BOOLEAN {default false}
--
INVARIANT: IF imeiScanResult = MISMATCH THEN qrScannedAt MUST be NULL
INVARIANT: IF qrScannedAt IS NOT NULL THEN imeiScanResult MUST = MATCH

+ confirmMeetup() : void
+ recordImeiScan(scannedImei : VARCHAR, dirbsResult : ENUM) : ENUM
+ unlockQr() : void {called only after imeiScanResult = MATCH AND dirbs_recheck_result != BLACKLISTED}
+ activateDuress() : void
```

**Meetup Location (Gap 16 — RESOLVED):**
Location is selected via embedded Google Maps picker (not free text). Stored as JSONB with lat/lng/address/placeId. This provides a verifiable, unambiguous location record. If dispute occurs, the Google Places ID is admissible evidence of the agreed meetup location.

**Cross-City Transactions (Gap 17 — RESOLVED):**
No geographic proximity enforcement for CEP. This is a documented known limitation. Post-CEP: implement proximity warning (not hard block) if buyer and seller are >50km apart, allowing user to acknowledge and proceed. The 72-hour meetup window is intentionally generous to accommodate travel.

**Meetup Confirmation Mechanics (Gap 18 — RESOLVED):**
- Buyer confirms first: buyerConfirmedAt set. Seller has NOT confirmed. No timer reset. The 72-hour window from auction close continues running.
- Seller never confirms: auto-refund fires at 72-hour mark regardless of buyer confirmation. Seller flagged for GPR-07 (ghost selling).
- Both confirm: confirmedAt set. 4-hour QR window begins from confirmedAt.
- This is intentional: buyer confirmation does not protect seller from ghosting consequences.

**IMEI Scanning Mechanism (Gap 15 — RESOLVED):**
Scanning approach: dual-mode
1. Primary: QR/barcode decode (if device has IMEI QR on packaging/settings)
2. Secondary: OCR on *#06# display (camera captures the number, client-side OCR, user confirms result before submission)
3. Fallback: Manual PIN entry (camera denied OR OCR fails after 2 attempts)
All three paths submit IMEI to the same backend validation endpoint.
OCR is performed client-side via a lightweight JS library. User sees extracted IMEI and taps "Confirm" before it is submitted — preventing silent OCR errors from triggering false mismatch.

**Geolocation at Settlement (Gap 27 — RESOLVED):**
GPS acquisition at QR scan:
1. System requests GPS with 10-second timeout
2. If GPS acquired within 10 seconds: use precise coordinates (source: GPS)
3. If GPS not acquired but last known location < 5 minutes old: use last known (source: LAST_KNOWN)
4. If no usable GPS: use IP geolocation as fallback (source: IP_FALLBACK, lower accuracy)
5. If all fail: geolocationAtScan = {lat: null, lng: null, accuracy_metres: null, source: null}
Settlement PROCEEDS regardless. Hash includes null marker. A null geolocation settlement hash is legally weaker but not invalid — the biometric gate, IMEI match, and QR seed verification still provide strong non-repudiation.

**Buyer-Seller Communication (Gap 33 — RESOLVED):**
In-app meetup coordination chat. Data model:

```
MeetupMessage
+ messageId : UUID {PK}
+ meetupId : UUID {FK → MeetupSession}
+ senderId : UUID {FK → User}
+ content : TEXT {plain text only for CEP, max 500 characters}
+ sentAt : TIMESTAMPTZ
+ isEvidence : BOOLEAN {default false — set true when dispute is raised on this MeetupSession}
```

When dispute is raised (MeetupSession → DISPUTED):
- All MeetupMessage records for this meetupId have isEvidence = true set atomically
- isEvidence records become READ-ONLY for all non-admin users
- Admin can access evidence via dispute management interface

**SettlementReceipt**
```
+ receiptId : UUID {PK}
+ transactionId : UUID {FK → Transaction, UNIQUE}
+ buyerIdHash : CHAR(64) {SHA-256 of buyer userId — not raw ID}
+ sellerIdHash : CHAR(64) {SHA-256 of seller userId}
+ listingId : UUID
+ verifiedImei : VARCHAR(15) {the IMEI that passed at meetup}
+ settlementTimestamp : TIMESTAMPTZ {millisecond precision}
+ geolocationAtScan : JSONB {copied from MeetupSession}
+ receiptHashSha256 : CHAR(64) {
    SHA-256 of: buyerIdHash + sellerIdHash + listingId + verifiedImei + 
                settlementTimestamp + geolocationAtScan + transactionId
  }
+ platformPublicKeyRef : VARCHAR {key version identifier — for signature verification}
--
RULES: INSERT ONLY. Any field modification invalidates receiptHashSha256.
+ verify(publicKey : TEXT) : BOOLEAN
```

---

### PACKAGE 6 — GOVERNANCE & DISPUTES

**Dispute**
```
+ disputeId : UUID {PK}
+ transactionId : UUID {FK → Transaction}
+ raisedBy : ENUM {BUYER|SELLER|SYSTEM}
+ disputeType : ENUM {IMEI_MISMATCH|QR_REFUSAL|ITEM_NOT_AS_DESCRIBED|FRAUDULENT_REVERSAL|DURESS|MEETUP_FAILED|SELLER_NO_SHOW|DIRBS_BLACKLISTED_AT_MEETUP}
+ reason : TEXT
+ evidenceFrozenAt : TIMESTAMPTZ {set atomically when dispute is created}
+ status : ENUM {OPEN|UNDER_REVIEW|RESOLVED_BUYER|RESOLVED_SELLER|RESOLVED_SPLIT}
+ adminNotes : TEXT {nullable}
+ resolvedAt : TIMESTAMPTZ {nullable}
+ resolverId : UUID {FK → User(admin), nullable}
+ buyerSharePct : SMALLINT {nullable — for RESOLVED_SPLIT}
+ sellerSharePct : SMALLINT {nullable — for RESOLVED_SPLIT}
+ adminResponseDeadline : TIMESTAMPTZ {disputeCreatedAt + 72 hours}
--
+ freezeEvidence() : void
  Sets isEvidence = true on all MeetupMessage records for this transaction
  Freezes all associated IMEI scan data, QR scan attempts
  Makes all evidence READ-ONLY
+ resolve(verdict : ENUM) : void
+ splitSettle(buyerPct : SMALLINT, sellerPct : SMALLINT) : void
```

**Dispute Default Resolution (GPR-08):**
If adminResponseDeadline passes (72 hours from dispute creation) with no admin resolution:
- IF no meetup was ever confirmed (MeetupSession.confirmedAt IS NULL): auto-refund to buyer, seller flagged for GPR-07
- IF meetup was confirmed (MeetupSession.confirmedAt IS NOT NULL): dispute REMAINS OPEN. No automatic default. Human review is mandatory. A confirmed meetup has too many possible outcomes to safely default.

**Disputed Escrow → Settlement Math (Gap 4 — RESOLVED):**
When admin resolves S8_ESCROW_DISPUTED → S5_SETTLED (full seller win):
- Full standard settlement math executes: WHT, ICT, platform fee all apply
- Rationale: the transaction completed, the buyer received the item, the settlement math should be identical to a clean settlement

When admin resolves S8_ESCROW_DISPUTED → S2_AVAILABLE (full buyer win / refund):
- Buyer receives full buyerTotalPaisa back (including the 2% buyer fee — refunded in full when dispute is admin-resolved in buyer's favour)
- No WHT, no ICT, no platform fee
- Seller receives nothing

When split settlement (TR-16):
- Admin specifies buyerPct + sellerPct (must sum to 100)
- Platform fee (but NOT WHT or ICT) is taken from the total as normal
- WHT applies only to seller's share on a pro-rata basis
- Banker's Rounding applies to any fractional Paisa

**AdminApproval (abstract base)**
```
+ approvalId : UUID {PK}
+ initiatorId : UUID {FK → User(admin) — the MAKER}
+ approverId : UUID {FK → User(admin) — the CHECKER, nullable until approved}
+ requestedAt : TIMESTAMPTZ
+ approvedAt : TIMESTAMPTZ {nullable}
+ status : ENUM {AWAITING_APPROVAL|APPROVED|REJECTED|EXPIRED}
+ cryptoSignatureMaker : TEXT {ECDSA signature by Maker's private key}
+ cryptoSignatureChecker : TEXT {nullable — ECDSA signature by Checker's private key}
+ expiresAt : TIMESTAMPTZ {requestedAt + 24 hours — approval requests expire}
--
INVARIANT: initiatorId != approverId (cannot approve your own request)
INVARIANT: Action executes ONLY when status = APPROVED
Action is ATOMIC: the approval and the action it authorises execute in the same database transaction.

Subclasses: ManualRefundApproval, DisputeResolutionApproval, PenaltyOverrideApproval,
            AccountActionApproval, WalletAdjustmentApproval
```

**Admin Bootstrap Problem (Gap 30 — RESOLVED):**
```
Deployment step 1: Run CLI command with environment secret
  go run ./cmd/bootstrap --create-superadmin --email=admin1@boli.pk --secret=$BOOTSTRAP_SECRET
  This creates the first admin with superadmin = true in UserSession metadata

Deployment step 2: Superadmin creates second admin via admin portal
  Second admin does NOT require Maker-Checker (bootstrapping exception, logged)

Deployment step 3: Both admins exist. Run CLI command to remove superadmin flag:
  go run ./cmd/bootstrap --revoke-superadmin --email=admin1@boli.pk --secret=$BOOTSTRAP_SECRET

From this point: all financial admin actions require Maker-Checker.
BOOTSTRAP_SECRET is a one-time environment variable, rotated and destroyed after setup.
```

**Penalty and Suspension Framework:**

All penalties require User.penaltyConsentRecord to exist (signed at registration). Without consent record, no penalty can be applied — the system must block the action and alert admin.

**BUYER PENALTIES:**

**GPR-01 — B1 Ghost Bidding (no meetup arranged within 72h):**
```
Auction < Rs.50,000:
  flat Rs.1,500 penalty
  → Rs.1,000 to seller wallet
  → Rs.500 to PLATFORM_REVENUE
  
Auction >= Rs.50,000:
  3% of winningBidPaisa
  → 2% to seller wallet
  → 1% to PLATFORM_REVENUE

Ledger entries for Rs.200,000 ghost bid (atomic, zero-sum):
  DEBIT buyer wallet: 3% × 20,000,000 = 600,000 Paisa (penalty)
  CREDIT PENALTY_POOL: 600,000 Paisa
  DEBIT PENALTY_POOL: 400,000 Paisa (seller share)
  CREDIT seller wallet: 400,000 Paisa
  DEBIT PENALTY_POOL: 200,000 Paisa (platform share)
  CREDIT PLATFORM_REVENUE: 200,000 Paisa
  DEBIT buyer wallet: 19,400,000 Paisa (refund of remaining bid)
  CREDIT buyer wallet: 19,400,000 Paisa (restores to S2_AVAILABLE)
  — Wait: refund is: totalWithFeePaisa - penalty = 20,400,000 - 600,000 = 19,800,000
  
CORRECTED for ghost bid: buyer had totalWithFeePaisa = winningBid × 1.02 reserved.
  On ghost: penalty deducted from reserved amount, remainder refunded.
  Ghost penalty deducted: 600,000 (3% of bid)
  Refund: 20,400,000 - 600,000 = 19,800,000 Paisa
  Ledger: DEBIT reserved 20,400,000 | CREDIT seller 400,000 | CREDIT PLATFORM_REVENUE 200,000 | CREDIT buyer available 19,800,000
  Zero-sum: 20,400,000 = 400,000 + 200,000 + 19,800,000 ✓

Escalation:
  2nd offence within 6 months: 5% (2% seller, 3% platform), 14-day bidding suspension
  3rd offence: 8% (2% seller, 6% platform), permanent bidding ban
  Seller always receives 2% regardless of offence number (their loss is the same each time)
```

**GPR-02 — B2 Meetup No-Show (confirmed meetup, buyer absent):**
```
Auction < Rs.50,000: flat Rs.2,500 (Rs.1,500 seller, Rs.1,000 platform)
Auction >= Rs.50,000: 4% of bid (3% seller, 1% platform)
Same 3-offence escalation as GPR-01.
Seller receives 3% (higher than ghost — seller physically travelled to meetup).
```

**GPR-03 — B3 Bad-Faith QR Refusal:**
Admin determines refusal was bad faith → 5% penalty (3% seller, 2% platform), 30-day bidding suspension.
Admin determines refusal was legitimate (item not as described) → no buyer penalty, becomes seller failure GPR-07 S4.

**GPR-04 — B4a Post-QR Condition Complaint:**
Once QR scan completes: transaction is FINAL for condition complaints. No recourse. Buyer informed at bidding AND at IMEI scan step. Auto-rejected with policy notice.

**GPR-05 — B4b Post-QR Fraudulent Reversal:**
Admin confirms fraud → 6% penalty (4% seller, 2% platform), 60-day bidding suspension.

**GPR-06 — B5 Shill Bidding:**
Admin confirms pattern → permanent ban all associated accounts, all wallets frozen, FBR/SBP referral logged.

**PENALTY LEDGER ENTRIES (Gap 35 — RESOLVED):**
All penalty flows route through PENALTY_POOL as an intermediate account to maintain zero-sum integrity at every step. The pool is never negative. Each penalty creates exactly 4 ledger entries:
1. DEBIT buyer wallet (penalty amount)
2. CREDIT PENALTY_POOL (penalty amount)
3. DEBIT PENALTY_POOL (seller share)
4. CREDIT seller wallet (seller share)
...then separately:
5. DEBIT PENALTY_POOL (platform share)
6. CREDIT PLATFORM_REVENUE (platform share)
All 6 entries are atomic within one PostgreSQL transaction. Zero-sum verified by pre-commit trigger.

**SELLER SUSPENSIONS (GPR-07):**
```
S1 Ghost Selling (no meetup arranged): 7 days | 7 days | PERMANENT
S2 Meetup No-Show (confirmed meetup, seller absent): 14 days | 14 days | PERMANENT  
S3 Wrong Device at Meetup (IMEI mismatch OR DIRBS blacklisted at meetup): 30 days | 30 days | PERMANENT
S4 Item Misrepresented (admin confirmed): 30 days | 30 days | PERMANENT
S5 Listing Fraud (non-existent/unowned item): PERMANENT on first offence
S6 Fake NTN: PERMANENT on first offence + FBR referral logged
```

Suspension during active auction (Gap 3 — RESOLVED):
- If seller suspended while auction is ACTIVE: auction continues to CLOSE_WITH_BIDS or CLOSE_NO_BIDS normally (buyers cannot be harmed by seller's suspension). Listing marked SUSPENDED_SELLER.
- After close: if CLOSED_WITH_BIDS, escrow is created but Escrow.qrSeedEncrypted cannot be generated (QR generator is disabled for suspended sellers). Admin must manually resolve.
- If seller suspended while Escrow is LOCKED: Escrow.status remains LOCKED. QR generator disabled. Admin notified. Admin must decide: allow escrow to proceed (seller completed meetup before suspension) or transition to DISPUTED.
- Suspended seller's existing active listings are immediately set to status = CANCELLED_BY_ADMIN with buyer notification.

---

### PACKAGE 7 — NOTIFICATIONS

**Notification (abstract base)**
```
+ notificationId : UUID {PK}
+ userId : UUID {FK → User}
+ channel : ENUM {PUSH|IN_APP|SMS}
+ status : ENUM {QUEUED|DISPATCHED|DELIVERED|FAILED}
+ dispatchedAt : TIMESTAMPTZ {nullable}
+ deliveredAt : TIMESTAMPTZ {nullable}
+ createdAt : TIMESTAMPTZ
--
+ dispatch() : void
+ retry() : void {max 3 retries with exponential backoff: 30s, 2min, 10min}
```

**7 Notification Subclasses:**

1. BidNotification: auctionId, currentHighestBidPaisa, userBidPaisa, type {OUTBID|AUCTION_WON}
2. MeetupNotification: transactionId, proposedLocation (JSONB), proposedTime, type {MEETUP_CONFIRM|MEETUP_REMINDER}
3. IMEINotification: transactionId, scannedImei, listedImei, type {IMEI_MATCH|IMEI_MISMATCH}
4. SettlementNotification: transactionId, amountPaisa, type {QR_SCANNED|FUNDS_RELEASED}
5. GovernanceNotification: transactionId (nullable), penaltyAmountPaisa (nullable), suspensionDays (nullable), type {DISPUTE_OPENED|PENALTY_APPLIED|SUSPENSION_APPLIED}
6. AdminAlertNotification: transactionId, alertType {DURESS|SHILL_DETECTED|AML_FREEZE|CHAIN_INTEGRITY_FAILURE}, priority {HIGH|CRITICAL}
7. VettingCompleteNotification: vettingId, listingId, classification, rejectionReasonCode (nullable)

**Notification Delivery Stack (Gap 34 — RESOLVED):**
- PUSH: FCM (Android) + APNs (iOS). For CEP: mocked with console log.
- IN_APP: On notification creation, Centrifugo WebSocket pushes to connected client. If client offline: notification persists in Notification table. Client fetches unread notifications on reconnect via GET /api/v1/notifications?status=QUEUED.
- SMS: Twilio. For CEP: mocked.
- In-app notification inbox: GET /api/v1/notifications queries Notification table WHERE userId = :userId ORDER BY createdAt DESC LIMIT 50.

---

## 7. THE 13-STATE MONEY LIFECYCLE

All states are properties of MONEY (Paisa), not of a user or listing. The same user's funds can be in different states simultaneously across different transactions.

```
S1_UNDEPOSITED     → Funds outside platform (user's bank account)
S2_AVAILABLE       → Funds in user wallet, free for bidding
S3_RESERVED        → Funds committed to an active bid (bid × 1.02 reserved)
S4_LOCKED          → Funds in escrow vault (auction closed, winner determined)
S5_SETTLED         → Funds released to seller (QR scan succeeded)
S6_WITHDRAWN       → Funds leaving platform (seller bank transfer initiated)
S7_RESERVED_FROZEN → Funds frozen due to shill bid detection (under admin review)
S8_ESCROW_DISPUTED → Funds in disputed escrow (meetup failed, IMEI mismatch, etc.)
S9_QUARANTINED     → Funds frozen post-settlement due to AML flag
S10_PENALTY_DEDUCTED → Funds deducted as penalty (routes through PENALTY_POOL)
S11_REFUND_PENDING → Funds being processed for return to buyer
S12_TAX_REMITTANCE_PENDING → WHT/ICT held pending FBR remittance
S13_EXPIRED_UNRESERVED → Funds released from auction with zero valid bids
```

**Legal State Transitions:**
```
[START] → S1_UNDEPOSITED
S1_UNDEPOSITED → S2_AVAILABLE (deposit confirmed)
S2_AVAILABLE → S3_RESERVED (bid placed × 1.02)
S2_AVAILABLE → S6_WITHDRAWN (seller withdrawal)
S2_AVAILABLE → S10_PENALTY_DEDUCTED (ghost/no-show penalty deducted)
S3_RESERVED → S2_AVAILABLE (outbid — previous bid released)
S3_RESERVED → S4_LOCKED (auction closed, this bid won)
S3_RESERVED → S7_RESERVED_FROZEN (shill detection flag)
S3_RESERVED → S13_EXPIRED_UNRESERVED (auction closed with zero valid bids)
S4_LOCKED → S2_AVAILABLE (72h no meetup confirmed → auto-refund; OR admin refund via Maker-Checker)
S4_LOCKED → S5_SETTLED (QR scan success, 2PC committed)
S4_LOCKED → S8_ESCROW_DISPUTED (IMEI mismatch; OR 4h after confirmed meetup, no QR; OR duress)
S4_LOCKED → S11_REFUND_PENDING (IMEI mismatch auto-refund processing)
S5_SETTLED → S6_WITHDRAWN (seller initiates withdrawal)
S5_SETTLED → S9_QUARANTINED (AML flag post-settlement)
S5_SETTLED → S12_TAX_REMITTANCE_PENDING (WHT/ICT isolated for FBR)
S6_WITHDRAWN → S1_UNDEPOSITED (funds reach seller's bank)
S6_WITHDRAWN → [END] (withdrawal complete)
S7_RESERVED_FROZEN → S2_AVAILABLE (admin clears, no fraud confirmed)
S8_ESCROW_DISPUTED → S2_AVAILABLE (admin resolves for buyer / auto-default after 72h with no confirmed meetup)
S8_ESCROW_DISPUTED → S5_SETTLED (admin resolves for seller — full settlement math executes)
S9_QUARANTINED → S6_WITHDRAWN (admin clears AML flag)
S10_PENALTY_DEDUCTED → S12_TAX_REMITTANCE_PENDING (penalty routed to platform accounts)
S11_REFUND_PENDING → S2_AVAILABLE (refund processed)
S12_TAX_REMITTANCE_PENDING → S6_WITHDRAWN (tax remitted to FBR, net revenue to platform)
S13_EXPIRED_UNRESERVED → [END]
```

---

## 8. TWO-PHASE COMMIT SETTLEMENT PROTOCOL

**Trigger:** Buyer scans seller's QR code. QR scanner submits scanned seed to POST /api/v1/settlement/initiate.

**Phase 1 — PREPARE (all-or-nothing pre-flight):**
```
Check 1: Verify QR seed hash matches Escrow.qrSeedHash
Check 2: Verify now() < Escrow.qrSeedTtlExpiry (not expired)
Check 3: Verify Escrow.qrSeedUsed == false (not already used)
Check 4: Verify MeetupSession.imeiScanResult == MATCH
Check 5: Verify MeetupSession.dirbs_recheck_result != BLACKLISTED
Check 6: Verify Escrow.status == LOCKED (not already disputed/released)
Check 7: Pre-calculate all 5 settlement amounts, verify zero-sum
Check 8: Verify seller wallet is active (not suspended in a way that blocks settlement)
Check 9: Acquire SELECT FOR UPDATE on Escrow row, Transaction row, all involved Wallet rows

If ALL checks pass: set Escrow.twopcPrepareAt = now(), set Escrow.qrSeedUsed = true
If ANY check fails: return error to client. "SCAN_FAILED — DO NOT HAND OVER ITEM."
```

**Phase 2 — COMMIT (all 5 ledger entries in single transaction):**
```
Entry 1: DEBIT buyer wallet (buyerTotalPaisa)
Entry 2: CREDIT seller wallet (sellerNetPaisa)
Entry 3: CREDIT WHT_HOLDING tax account (whtPaisa)
Entry 4: CREDIT ICT_SALES_TAX tax account (ictTaxPaisa)
Entry 5: CREDIT PLATFORM_REVENUE tax account (platformRevenuePaisa)

All 5 entries written atomically. Pre-commit trigger validates zero-sum.
If commit succeeds:
  - Escrow.status = RELEASED
  - Escrow.twopcCommitAt = now()
  - Transaction.moneyState = S5_SETTLED
  - SettlementReceipt created
  - SettlementNotification dispatched to both parties

If commit fails (DB error):
  - All 5 entries rolled back automatically (PostgreSQL ROLLBACK)
  - Escrow.qrSeedUsed reset to false (compensating update in separate transaction)
  - Return "SETTLEMENT_FAILED — funds remain safely in escrow"
  - New QR seed can be generated after biometric re-auth
```

---

## 9. AUTHENTICATION ARCHITECTURE (Gap 5 — RESOLVED)

```
POST /api/v1/auth/request-otp
  Body: {phone: string}
  → Generates 6-digit OTP, stores hash in Redis with 5-minute TTL
  → Sends OTP via SMS (mocked for CEP)

POST /api/v1/auth/verify-otp
  Body: {phone: string, otp: string}
  → Validates OTP hash in Redis
  → Creates User (accountStatus = PARTIAL_ACTIVE) if new
  → Creates UserSession
  → Returns: {accessToken: JWT, refreshToken: httponly-cookie}

POST /api/v1/auth/refresh
  → Reads refresh token from HTTP-only cookie
  → Validates against UserSession.refreshTokenHash
  → Issues new access token + new refresh token
  → Invalidates old refresh token in UserSession

POST /api/v1/auth/logout
  → Invalidates UserSession.isActive = false
  → Removes sessionId from Redis active_sessions:{userId}

All protected routes:
  → Extract JWT from Authorization: Bearer header
  → Verify JWT signature with server secret
  → Verify UserSession.isActive == true AND sessionId in Redis active_sessions:{userId}
  → If sessionId not in Redis: return 401 SESSION_TERMINATED
```

---

## 10. SEARCH ARCHITECTURE (Gap 32 — RESOLVED)

For CEP: PostgreSQL full-text search.

```sql
-- tsvector column on Listing table (maintained by trigger)
ALTER TABLE listings ADD COLUMN search_vector tsvector;
CREATE INDEX listings_search_idx ON listings USING GIN(search_vector);

-- Trigger updates search_vector on insert/update
search_vector = to_tsvector('english', make || ' ' || model || ' ' || category::text)

-- Search query
SELECT * FROM listings 
WHERE search_vector @@ plainto_tsquery('english', :query)
  AND status = 'ACTIVE'
  AND reservePricePaisa BETWEEN :minPrice AND :maxPrice
  AND conditionRating >= :minCondition
  AND ptaStatus = :ptaStatus  -- optional filter
ORDER BY ts_rank(search_vector, plainto_tsquery('english', :query)) DESC
LIMIT 20 OFFSET :offset;
```

Post-CEP: Elasticsearch for scale.

**Similar Listings Algorithm (Gap 23 — RESOLVED):**
```sql
-- Priority 1: Same make + model, similar price range
SELECT * FROM listings WHERE make = :make AND model = :model 
  AND reservePricePaisa BETWEEN :price * 0.7 AND :price * 1.3
  AND status = 'ACTIVE' AND listingId != :excludeListingId
ORDER BY createdAt ASC LIMIT 5;

-- Priority 2: Same make, similar price
-- Priority 3: Same category, similar price
-- Results merged, deduplicated, max 10 shown
```

---

## 11. KEY INVARIANTS — MUST NEVER BE VIOLATED

These are enforced at the database layer (triggers, constraints), not just application layer:

```
INVARIANT-01: Wallet balance sum
  availablePaisa + reservedPaisa + lockedPaisa = totalDepositedPaisa AT ALL TIMES
  Violation action: ROLLBACK + alert

INVARIANT-02: Zero-sum ledger
  SUM(DEBIT entries) = SUM(CREDIT entries) per atomic transaction
  Violation action: ROLLBACK + alert

INVARIANT-03: Append-only ledger
  No UPDATE or DELETE on LedgerEntry, MeetupMessage(when isEvidence=true), SettlementReceipt
  Violation action: DENY at PostgreSQL permission level + TAMPER_ATTEMPT security log

INVARIANT-04: Hash chain integrity
  LedgerEntry.currentHashSha256 = SHA-256(entryData + previousHashSha256)
  Background monitor runs every 5 minutes
  Violation action: CHAIN_INTEGRITY_FAILURE alert + admin notification

INVARIANT-05: QR seed one-time use
  Escrow.qrSeedUsed must be false before validateQrSeed() succeeds
  Set to true atomically in 2PC Phase 1
  Violation action: SEED_ALREADY_USED error

INVARIANT-06: State machine legal transitions
  Transaction.moneyState can only transition via defined paths in the state machine
  Illegal transition: REJECT + STATE_VIOLATION log

INVARIANT-07: Maker-Checker separation
  AdminApproval.initiatorId != AdminApproval.approverId
  Enforced at application layer AND database constraint

INVARIANT-08: IMEI-QR gate
  MeetupSession: IF imeiScanResult = MISMATCH THEN qrScannedAt MUST be NULL
  IF qrScannedAt IS NOT NULL THEN imeiScanResult MUST = MATCH
  Enforced by PostgreSQL CHECK constraint

INVARIANT-09: Money is integer only
  All financial columns are BIGINT (Paisa). No DECIMAL, FLOAT, or NUMERIC with decimal places.
  Violation action: API validation rejects any non-integer financial value

INVARIANT-10: 5-year data retention
  No financial record may be deleted before 5 years from createdAt
  Enforced by PostgreSQL row-level security policy
```

---

## 12. API CONVENTIONS

- Base URL: `/api/v1/`
- Authentication: `Authorization: Bearer {accessToken}` on all protected routes
- All monetary values: integers (Paisa), never decimals
- All UUIDs: v4 format
- All timestamps: ISO 8601 with timezone (TIMESTAMPTZ)
- Idempotency: All POST financial endpoints require `X-Idempotency-Key: {UUIDv4}` header
- Error format:
```json
{
  "error": {
    "code": "INSUFFICIENT_FUNDS",
    "message": "Available balance is insufficient for this bid.",
    "details": {}
  }
}
```
- Pagination: `?page=1&limit=20` (cursor-based for real-time feeds)
- All response bodies snake_case
- CORS: restricted to known frontend origins only

---

## 13. PROJECT FILE STRUCTURE

```
boli-pk/
├── CLAUDE.md                    ← THIS FILE
├── docker-compose.yml           ← Single-command CEP deployment
├── docker-compose.test.yml      ← Test environment
│
├── services/
│   ├── gateway/                 ← Go — API gateway + WebSocket bidding engine
│   │   ├── cmd/
│   │   │   ├── server/main.go
│   │   │   └── bootstrap/main.go  ← Admin bootstrap CLI
│   │   ├── internal/
│   │   │   ├── auth/            ← JWT, session management
│   │   │   ├── auction/         ← Auction state machine, bid processing
│   │   │   ├── escrow/          ← Escrow state machine, 2PC settlement
│   │   │   ├── wallet/          ← Wallet operations, zero-sum enforcement
│   │   │   ├── listing/         ← Listing CRUD, vetting trigger
│   │   │   ├── meetup/          ← Meetup coordination, IMEI scan
│   │   │   ├── notification/    ← Notification dispatch
│   │   │   ├── admin/           ← Admin portal, Maker-Checker
│   │   │   ├── middleware/      ← Auth, rate limiting, shill detection
│   │   │   └── websocket/       ← Centrifugo integration
│   │   ├── pkg/
│   │   │   ├── ledger/          ← LedgerEntry creation, hash chaining
│   │   │   ├── settlement/      ← Settlement math, zero-sum validator
│   │   │   └── statemachine/    ← Money state machine enforcer
│   │   └── migrations/          ← PostgreSQL migrations (ordered)
│   │
│   ├── ai-vetting/              ← Python FastAPI — AI pipeline
│   │   ├── main.py
│   │   ├── gates/
│   │   │   ├── gate1_luhn.py
│   │   │   ├── gate2_dirbs.py
│   │   │   └── gate3_tac.py
│   │   ├── checks/
│   │   │   ├── check4_image.py
│   │   │   ├── check5_condition.py
│   │   │   └── check6_price.py
│   │   ├── pipeline.py          ← Orchestrates all 6 checks
│   │   └── mocks/               ← Mock DIRBS, TAC, FBR services
│   │
│   └── frontend/                ← React + Next.js PWA
│       ├── src/
│       │   ├── app/             ← Next.js App Router
│       │   ├── components/
│       │   │   ├── auction/     ← Live auction room, bid input
│       │   │   ├── listing/     ← Listing creation, AI status
│       │   │   ├── meetup/      ← IMEI scanner, QR scanner, meetup chat
│       │   │   ├── wallet/      ← Wallet dashboard, top-up
│       │   │   └── admin/       ← Admin portal components
│       │   ├── hooks/
│       │   │   ├── useWebSocket.ts
│       │   │   ├── useAuction.ts
│       │   │   └── useWallet.ts
│       │   └── lib/
│       │       ├── api.ts       ← API client with idempotency key injection
│       │       └── imei/        ← Client-side OCR, barcode decode
│       └── public/
│
├── infrastructure/
│   ├── postgres/
│   │   ├── init.sql             ← Schema, triggers, constraints, RLS policies
│   │   └── seed.sql             ← Test data for CEP demo
│   ├── redis/
│   │   └── redis.conf
│   └── nginx/
│       └── nginx.conf           ← Reverse proxy, TLS termination
│
└── tests/
    ├── unit/                    ← Go test files alongside source
    ├── integration/             ← Multi-service integration tests
    ├── load/                    ← k6 load test scripts (C10K validation)
    └── e2e/                     ← Playwright E2E (CEP demo scenarios)
```

---

## 14. DEFERRED ITEMS (Post-CEP, Architecturally Designed)

These items have architectural decisions made but are NOT implemented for CEP:

| Item | Decision Made | Why Deferred |
|---|---|---|
| Auction timer extension on late bids | Extend by 30s, max 5 extensions | Adds complexity to CLOSING state for minimal CEP value |
| Centrifugo multi-node clustering | Redis pub/sub between nodes | Single node sufficient for CEP demo |
| Live PTA DIRBS API | Mock service with identical contract | PTA data-sharing agreement required |
| Live FBR NTN validation | Mock service with identical contract | FBR IRIS registration required |
| Live payment gateway (Raast) | Admin funding module replaces it | SBP EMI license required |
| Geographic proximity check | Warning at >50km, not hard block | Not critical for CEP |
| Elasticsearch for search | PostgreSQL FTS for CEP | Scale not needed for CEP |
| Cold storage archival (90-day) | PostgreSQL table partitioning + read replica | Not needed for CEP dataset size |
| Audit timer extension | N/A | N/A |
| SBP EMI License | Business track, parallel to CEP | 6-12 month process, PKR 200M capital |

---

## 15. KNOWN CEP DEMO SCENARIOS

The following scenarios must work end-to-end in the docker-compose offline environment:

**Scenario 1 — Happy Path:**
Admin funds buyer wallet → Buyer browses marketplace → Buyer joins auction → Buyer places winning bid → Auction closes → Escrow created → Buyer and seller coordinate meetup → Buyer scans IMEI (match) → Seller passes biometric → QR displayed → Buyer scans QR → 2PC commits → Seller receives funds → Both parties see settlement receipt

**Scenario 2 — IMEI Mismatch:**
Same as above through meetup → Buyer scans IMEI (mismatch) → Auto-refund → Seller suspended → Both notified

**Scenario 3 — Ghost Bidding:**
Buyer wins auction → 72 hours pass with no meetup confirmation → Auto-refund with penalty → Seller gets penalty share → Buyer's offence count incremented

**Scenario 4 — Duress:**
Normal meetup → Seller enters duress PIN instead of biometric → Fake success shown → Escrow frozen → Admin alert fired → Real settlement blocked

**Scenario 5 — Admin Dispute Resolution:**
Meetup confirmed → No QR scan within 4 hours → S8_ESCROW_DISPUTED → Admin reviews evidence → Admin resolves for buyer → Refund with full settlement math skipped

**Scenario 6 — AI Pipeline:**
Seller submits listing → Gate 1 Luhn passes → Gate 2 DIRBS returns REGISTERED_CLEAN → Gate 3 TAC matches → Checks 4-6 score 78/100 → VERIFIED badge assigned → Listing published → Vetting complete notification sent

---

## 16. DO NOT DO THESE THINGS

- Never use floating point for any monetary value anywhere
- Never write financial mutations outside of PostgreSQL transactions
- Never route financial data through Redis (Redis is cache and EDA bus only)
- Never allow UPDATE or DELETE on LedgerEntry table
- Never allow a user to approve their own AdminApproval request
- Never skip the zero-sum pre-commit trigger, even in tests
- Never expose rawMetadataJson (EXIF data) via any public API endpoint
- Never allow QR generation without biometric confirmation first
- Never allow IMEI mismatch to proceed to QR scan
- Never create a LedgerEntry without a corresponding hash linking to the previous entry
- Never allow money to skip states in the 13-state machine
- Never hardcode credentials, API keys, or secrets in source code
