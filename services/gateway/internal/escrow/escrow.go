package escrow

// Escrow state machine and 2PC settlement protocol.
// States: LOCKED → RELEASED | REFUNDED | DISPUTED | DURESS_FROZEN
// QR seed is ONE-TIME USE — qrSeedUsed set true atomically in 2PC Phase 1.
// See CLAUDE.md Sections 6 (Package 5) and 8.
