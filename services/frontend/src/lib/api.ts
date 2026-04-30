// API client with automatic idempotency key injection.
// All POST financial endpoints require X-Idempotency-Key: {UUIDv4} header.
// All monetary values sent/received as integers (Paisa) — never strings, never floats.
// Base URL: /api/v1/
// Auth: Authorization: Bearer {accessToken} injected automatically.
// See CLAUDE.md Section 12 (API Conventions).

export const api = {
  // TODO: get(path) — authenticated GET
  // TODO: post(path, body) — authenticated POST with auto-generated X-Idempotency-Key
  // TODO: token refresh interceptor (refresh on 401, retry once)
  // TODO: error normaliser → { error: { code, message, details } }
};
