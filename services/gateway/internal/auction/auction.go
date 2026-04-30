package auction

// Auction state machine and bid processing.
// States: DRAFT → SCHEDULED → ACTIVE → CLOSING → CLOSED_WITH_BIDS | CLOSED_NO_BIDS | CANCELLED
// Bid flow: proof-of-funds check (Redis) → Redis Stream → PostgreSQL write worker → Centrifugo broadcast.
// See CLAUDE.md Sections 4 and 6 (Package 3).
