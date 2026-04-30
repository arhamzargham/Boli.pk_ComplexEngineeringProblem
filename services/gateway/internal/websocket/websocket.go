package websocket

// Centrifugo integration: publish auction state updates, session-terminated events.
// Circuit breaker: opens after 3 consecutive Redis failures → HTTP 503 for new bids.
// Active auction timer paused server-side during Redis outage.
// See CLAUDE.md Section 4 (Redis Failure Handling / Gap 24).
