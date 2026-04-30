"""
Check 6 — Price Sanity Score (Probabilistic, 0-30 points).

Compares reservePricePaisa against market price data for make/model/condition.
If price is >40% below market: priceBelowMarketFlag = True (potential stolen device signal).

See CLAUDE.md Section 5, Check 6.
"""


def score(reserve_price_paisa: int, make: str, model: str, condition_rating: int) -> tuple[int, bool]:
    # TODO: query mock market price data for make+model+condition
    # TODO: compute % deviation from market price
    # TODO: set price_below_market_flag if >40% below
    # TODO: return (score 0-30, price_below_market_flag bool)
    raise NotImplementedError
