"""
Gate 1 — IMEI Format Validation (Deterministic HARD GATE).

Validates 15-digit numeric format and applies the Luhn algorithm (ISO/IEC 7812).
Policy: accept IMEI1 only. Dual-SIM sellers must specify first-slot IMEI.
FAIL → listing REJECTED immediately. No badge. No public listing.

See CLAUDE.md Section 5, Gate 1.
"""


def validate(imei: str) -> bool:
    # TODO: check length == 15, all digits
    # TODO: apply Luhn algorithm
    raise NotImplementedError
