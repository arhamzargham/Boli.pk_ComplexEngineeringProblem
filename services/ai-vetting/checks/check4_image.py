"""
Check 4 — Image Consistency Score (Probabilistic, 0-40 points).

Uses Python Pillow + OpenCV to detect real physical device vs stock photo/screenshot.
Also checks for AI editing metadata and EXIF anomalies.
GPS from EXIF stored in ListingImage.rawMetadataJson (restricted — NEVER in public API).
Pillow strips EXIF from the publicly served image before permanent storage.

See CLAUDE.md Section 5, Check 4 and Image Storage Architecture (Gap 26).
"""


def score(image_path: str, raw_metadata: dict) -> int:
    # TODO: load image with OpenCV
    # TODO: detect stock photo signatures, screenshot artifacts
    # TODO: check image editing metadata
    # TODO: return score 0-40
    raise NotImplementedError
