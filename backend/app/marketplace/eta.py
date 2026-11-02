"""ETA estimation.

Dev uses straight-line distance ÷ an assumed urban speed. Production swaps in a
routing provider (Google Routes / validated alternative); the call site and the
returned shape (minutes + the freshness of the source location) do not change.
"""

from __future__ import annotations

import math

AVG_URBAN_SPEED_KMPH = 18.0
MIN_ETA_MIN = 2


def eta_minutes(distance_km: float) -> int:
    minutes = (distance_km / AVG_URBAN_SPEED_KMPH) * 60
    return max(MIN_ETA_MIN, math.ceil(minutes))
