package middleware

// HTTP middleware: JWT auth, rate limiting, shill bid detection.
// Shill detection: flags bid when bidder IP+fingerprint matches seller's active session.
// JWT validation must also check sessionId against Redis active_sessions:{userId}.
// See CLAUDE.md Sections 6 (Package 3, Shill Bidding / Gap 29) and 9.
