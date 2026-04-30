package ledger

// LedgerEntry creation and hash chaining.
// Every entry hashes: entryId + transactionId + amountPaisa + purpose + previousHashSha256.
// Append-only — no UPDATE or DELETE permitted at any role level.
// Background monitor validates chain integrity every 5 minutes.
// See CLAUDE.md Section 6 (Package 4, LedgerEntry) and Section 11 (INVARIANT-03, INVARIANT-04).
