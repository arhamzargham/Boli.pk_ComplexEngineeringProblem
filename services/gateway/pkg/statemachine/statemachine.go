package statemachine

// Money state machine enforcer — validates legal S1..S13 transitions.
// Illegal transition → REJECT + STATE_VIOLATION log (never silently ignore).
// See CLAUDE.md Section 7 (13-State Money Lifecycle) and Section 11 (INVARIANT-06).
