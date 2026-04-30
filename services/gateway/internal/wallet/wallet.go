package wallet

// Wallet operations: reserve, release, lock, unlock, deductPenalty.
// INVARIANT: availablePaisa + reservedPaisa + lockedPaisa = totalDepositedPaisa AT ALL TIMES.
// All amounts are BIGINT Paisa — no floats, no decimals anywhere.
// See CLAUDE.md Section 6 (Package 1, Wallet) and Section 11 (INVARIANT-01).
