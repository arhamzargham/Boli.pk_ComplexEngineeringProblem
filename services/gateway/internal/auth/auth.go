package auth

// JWT issuance, OTP verification, session management.
// Token TTL: access = 15 min, refresh = 7 days (HTTP-only Secure cookie).
// Concurrent session termination: Redis set active_sessions:{userId}.
// See CLAUDE.md Section 9 for full auth flow.
