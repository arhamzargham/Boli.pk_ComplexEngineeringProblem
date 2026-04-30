"""
Boli.pk AI Vetting Microservice — FastAPI entry point.

Pipeline: Gate 1 (Luhn) → Gate 2 (DIRBS) → Gate 3 (TAC) → Check 4 (Image) → Check 5 (Condition) → Check 6 (Price)
Hard gates are deterministic REJECT/PASS. Checks produce composite score 0-100 → badge assignment.
5,000ms hard timeout enforced by Go gateway; timeout → MANUAL_REVIEW_REQUIRED.

See CLAUDE.md Section 5 for full pipeline specification.
"""

from fastapi import FastAPI

app = FastAPI(title="Boli.pk AI Vetting Service")

# TODO: import and wire pipeline.py
# TODO: POST /vetting/submit endpoint
# TODO: GET  /vetting/{vettingId} status endpoint
# TODO: POST /vetting/image/upload endpoint (EXIF strip + store)
