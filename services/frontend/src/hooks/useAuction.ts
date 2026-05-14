// Live auction state hook — subscribes to Centrifugo auction channel.
// READ path: Redis-cached auction state delivered via WebSocket.
// Bid placement goes through POST /api/v1/auctions/{id}/bids with idempotency key.
// See CLAUDE.md Section 4 (CQRS-Lite) and Section 6 (Package 3).

export function useAuction(_auctionId: string) {
  // TODO: subscribe to Centrifugo channel `auction:{auctionId}`
  // TODO: maintain local auction state (bids, currentHighest, status, timeRemaining)
  // TODO: expose placeBid(amountPaisa: number) — injects X-Idempotency-Key header
  // TODO: handle CLOSING state (show 60-second countdown)
}
