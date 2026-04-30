"""
Gate 2 — PTA DIRBS Lookup (Deterministic HARD GATE).

REGISTERED_CLEAN  → proceed to Gate 3
BLACKLISTED       → listing REJECTED immediately
UNREGISTERED      → REVIEWED badge (disclosure, not rejection); seller must acknowledge

For CEP: mock service with 3 pre-configured test IMEIs (CLEAN / BLACKLISTED / UNREGISTERED).
Live PTA DIRBS API deferred to post-CEP (requires PTA data-sharing agreement).

See CLAUDE.md Section 5, Gate 2.
"""


def lookup(imei: str) -> str:
    # TODO: call mock DIRBS service (or live when available)
    # TODO: return "REGISTERED_CLEAN" | "BLACKLISTED" | "UNREGISTERED"
    raise NotImplementedError
