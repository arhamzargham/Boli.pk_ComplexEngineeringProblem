package settlement

// Settlement math and zero-sum validator.
// All arithmetic uses integer Paisa (BIGINT) — no floats.
// Banker's Rounding for fractional Paisa; dust goes to RECONCILIATION_DUST account.
// Zero-sum: buyerTotalPaisa = sellerNetPaisa + whtPaisa + ictTaxPaisa + platformRevenuePaisa
// See CLAUDE.md Section 6 (Package 4, Transaction) and Section 8.
