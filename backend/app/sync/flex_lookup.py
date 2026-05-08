"""
ChromeOS Flex model lookup.

Checks a device's model string against Google's certified Flex models list
and returns the EOL year + certification status if matched.

Matching strategy (in order):
1. Exact case-insensitive match on model name
2. Case-insensitive "starts with" match (handles Google Admin appending suffixes)
3. Case-insensitive "contains" match for the core model token
"""

import json
import logging
import re
from functools import lru_cache
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

_DATA_FILE = Path(__file__).parent.parent / "data" / "flex_models.json"


@lru_cache(maxsize=1)
def _load_flex_models() -> list[dict]:
    """Load and cache the flex models list."""
    try:
        with open(_DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error("Failed to load flex_models.json: %s", e)
        return []


@lru_cache(maxsize=1)
def _build_lookup() -> dict[str, dict]:
    """
    Build a normalised lookup dict keyed by lowercased model name.
    Strips common noise: extra spaces, punctuation variants.
    """
    models = _load_flex_models()
    lookup: dict[str, dict] = {}
    for entry in models:
        key = _normalise(entry["model"])
        lookup[key] = entry
    return lookup


def _normalise(s: str) -> str:
    """Lowercase and collapse whitespace for comparison."""
    return re.sub(r"\s+", " ", s.strip().lower())


def lookup_flex(model: str) -> Optional[dict]:
    """
    Given a device model string from Google Admin, return the matching
    Flex entry dict {manufacturer, model, status, eol_year} or None.
    """
    if not model:
        return None

    lookup = _build_lookup()
    norm = _normalise(model)

    # 1. Exact match
    if norm in lookup:
        return lookup[norm]

    # 2. Device model starts with a known flex model name
    #    e.g. "HP ProDesk 400 G3 SFF" starts with "prodesk 400 g3"
    for key, entry in lookup.items():
        if norm.startswith(key) or key.startswith(norm):
            return entry

    # 3. Substring match — the flex model name appears inside the device string
    #    or vice versa (useful for minor suffix/prefix differences)
    for key, entry in lookup.items():
        # Only consider keys with at least 8 chars to avoid false positives
        if len(key) >= 8 and (key in norm or norm in key):
            return entry

    return None


def is_flex_device(model: str) -> tuple[bool, Optional[int], Optional[str]]:
    """
    Returns (is_flex, eol_year, flex_status).
    eol_year and flex_status are None if not a Flex device.
    """
    entry = lookup_flex(model)
    if entry is None:
        return False, None, None
    return True, entry["eol_year"], entry["status"]
