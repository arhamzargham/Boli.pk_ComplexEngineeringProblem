// Wallet balance and transaction history hook.
// All monetary values are integer Paisa — format to Rs. only in display layer.
// See CLAUDE.md Section 6 (Package 1, Wallet).

export function useWallet() {
  // TODO: GET /api/v1/wallet → { availablePaisa, reservedPaisa, lockedPaisa }
  // TODO: refresh on settlement / bid / penalty notifications
  // TODO: expose formatted display helpers (paisa → "Rs. X,XXX")
}
