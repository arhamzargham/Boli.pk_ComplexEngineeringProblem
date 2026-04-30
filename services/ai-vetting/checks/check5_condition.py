"""
Check 5 — Condition Assessment Score (Probabilistic, 0-30 points).

Visual analysis of screen/body condition vs seller-stated conditionRating (1-10).
Significant mismatch (e.g. rating=9 but images show heavy scratches) → score penalty.

See CLAUDE.md Section 5, Check 5.
"""


def score(image_path: str, seller_condition_rating: int) -> int:
    # TODO: analyse screen and body condition via OpenCV
    # TODO: compare AI-assessed condition against seller_condition_rating
    # TODO: apply mismatch penalty if delta is large
    # TODO: return score 0-30
    raise NotImplementedError
