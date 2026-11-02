"""Money helpers. Prices are stored as integer paise and shown as rupees."""

from __future__ import annotations


def rupees_to_paise(rupees: int | None) -> int | None:
    if rupees is None:
        return None
    return int(rupees) * 100


def paise_to_rupees(paise: int | None) -> int | None:
    if paise is None:
        return None
    return paise // 100


def price_display(paise: int | None) -> str:
    """Human-readable price, e.g. '₹2,100' — or 'On request' when unpriced."""
    if paise is None:
        return "On request"
    rupees = paise // 100
    return f"₹{rupees:,}"
