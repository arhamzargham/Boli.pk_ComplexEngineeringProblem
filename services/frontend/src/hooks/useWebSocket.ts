// Centrifugo WebSocket connection hook.
// Handles connection lifecycle, reconnection, and session-terminated events.
// See CLAUDE.md Section 4 (Centrifugo) and Section 9 (concurrent session termination).

export function useWebSocket() {
  // TODO: connect to Centrifugo via centrifuge-js
  // TODO: handle SESSION_TERMINATED event → redirect to login
  // TODO: expose subscribe(channel) / unsubscribe(channel) / publish(channel, data)
}
