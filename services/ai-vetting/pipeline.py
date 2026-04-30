"""
Orchestrates the 6-check AI vetting pipeline.

Order: Gate1 → Gate2 → Gate3 → Check4 → Check5 → Check6 → badge assignment
Any HARD GATE failure short-circuits the pipeline immediately (no score computed).
compositeScore = check4 + check5 + check6  (0-100)
  >= 75 → VERIFIED
  >= 50 → REVIEWED
   < 50 → PENDING_REVIEW

See CLAUDE.md Section 5.
"""


def run_pipeline(listing_data: dict) -> dict:
    # TODO: call gate1_luhn, gate2_dirbs, gate3_tac in sequence (hard gates)
    # TODO: call check4_image, check5_condition, check6_price (probabilistic)
    # TODO: compute composite score and assign badge
    # TODO: return full VettingResult with gate results + scores + classification
    raise NotImplementedError
