"""
Gate 3 — GSMA TAC Match (Deterministic HARD GATE).

Extracts TAC (first 8 digits of IMEI), queries mock GSMA TAC database,
verifies make + model returned by TAC matches make + model entered by seller.
MISMATCH → listing REJECTED (IMEI does not match the described device).

See CLAUDE.md Section 5, Gate 3.
"""


def validate(imei: str, seller_make: str, seller_model: str) -> bool:
    # TODO: extract TAC from imei[:8]
    # TODO: query mock GSMA TAC DB
    # TODO: compare returned make+model against seller_make+seller_model
    raise NotImplementedError
