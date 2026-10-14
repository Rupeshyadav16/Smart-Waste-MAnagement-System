"""Telemetry cleaning, in-memory history, and dashboard-ready analytics.

The local application uses this lightweight store so it can run without a
Hadoop cluster. The batch Spark job in ``data_pipeline/spark`` uses the same
data contract for large files stored in HDFS.
"""

from collections import defaultdict
from datetime import datetime, timedelta, timezone
import random
from typing import Any


HISTORICAL_READINGS: list[dict[str, Any]] = []
DATA_QUALITY = {"raw_rows": 0, "accepted_rows": 0, "dropped_rows": 0, "normalized_rows": 0}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _clean_reading(reading: dict[str, Any]) -> dict[str, Any] | None:
    """Validate one IoT message and normalize its fill level to 0-100."""
    try:
        fill_level = float(reading["fill_level"])
        timestamp = reading["timestamp"]
        datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        bin_id = int(reading["bin_id"])
        city = str(reading["city"]).strip()
    except (KeyError, TypeError, ValueError):
        return None

    if not city:
        return None

    normalized_level = max(0, min(100, round(fill_level, 1)))
    if normalized_level != fill_level:
        DATA_QUALITY["normalized_rows"] += 1

    return {
        "timestamp": timestamp,
        "bin_id": bin_id,
        "city": city,
        "fill_level": normalized_level,
        "source": reading.get("source", "iot_sensor"),
    }


def reset_and_seed_history(bins: list[dict[str, Any]], days: int = 30) -> None:
    """Build deterministic historic sensor data for the local demo.

    One reading is created every three hours for each bin: 11,520 readings for
    the standard 48-bin network. The offline generator can create millions of
    records for the Hadoop/Spark workflow.
    """
    HISTORICAL_READINGS.clear()
    DATA_QUALITY.update(raw_rows=0, accepted_rows=0, dropped_rows=0, normalized_rows=0)

    randomizer = random.Random(20261006)
    start = _utc_now().replace(minute=0, second=0, microsecond=0) - timedelta(days=days)
    intervals = days * 8

    for interval in range(intervals):
        timestamp = (start + timedelta(hours=interval * 3)).isoformat()
        hour = (interval * 3) % 24
        rush_hour_effect = 8 if hour in {8, 9, 18, 19, 20} else 0

        for bin_obj in bins:
            base = bin_obj["fill_level"]
            daily_wave = ((interval % 8) - 3.5) * 2.2
            noise = randomizer.uniform(-20, 20)
            reading = {
                "timestamp": timestamp,
                "bin_id": bin_obj["id"],
                "city": bin_obj["city"],
                "fill_level": base + daily_wave + rush_hour_effect + noise,
                "source": "seeded_iot_history",
            }
            _append_reading(reading)


def _append_reading(reading: dict[str, Any]) -> None:
    DATA_QUALITY["raw_rows"] += 1
    cleaned = _clean_reading(reading)
    if cleaned is None:
        DATA_QUALITY["dropped_rows"] += 1
        return
    DATA_QUALITY["accepted_rows"] += 1
    HISTORICAL_READINGS.append(cleaned)


def record_sensor_snapshot(bins: list[dict[str, Any]], source: str = "sensor_simulation") -> None:
    """Append the latest smart-bin values after an IoT sensor update."""
    timestamp = _utc_now().isoformat()
    for bin_obj in bins:
        _append_reading(
            {
                "timestamp": timestamp,
                "bin_id": bin_obj["id"],
                "city": bin_obj["city"],
                "fill_level": bin_obj["fill_level"],
                "source": source,
            }
        )


def get_dashboard_analytics(bins: list[dict[str, Any]]) -> dict[str, Any]:
    """Return aggregate results that the React analytics dashboard can render."""
    daily = defaultdict(lambda: {"total_fill": 0.0, "count": 0, "critical": 0})
    hourly = defaultdict(lambda: {"total_fill": 0.0, "count": 0})
    distribution = {"Low (0-39%)": 0, "Medium (40-79%)": 0, "Critical (80-100%)": 0}

    for reading in HISTORICAL_READINGS:
        timestamp = datetime.fromisoformat(reading["timestamp"].replace("Z", "+00:00"))
        fill_level = reading["fill_level"]
        date_key = timestamp.date().isoformat()
        daily[date_key]["total_fill"] += fill_level
        daily[date_key]["count"] += 1
        daily[date_key]["critical"] += int(fill_level >= 80)
        hourly[timestamp.hour]["total_fill"] += fill_level
        hourly[timestamp.hour]["count"] += 1

        if fill_level >= 80:
            distribution["Critical (80-100%)"] += 1
        elif fill_level >= 40:
            distribution["Medium (40-79%)"] += 1
        else:
            distribution["Low (0-39%)"] += 1

    city_bins: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for bin_obj in bins:
        city_bins[bin_obj["city"]].append(bin_obj)

    city_demand = []
    for city, city_bin_list in city_bins.items():
        average_fill = round(sum(item["fill_level"] for item in city_bin_list) / len(city_bin_list), 1)
        critical_count = sum(item["fill_level"] >= 80 for item in city_bin_list)
        # The demand score combines current load and collection urgency.
        demand_score = round(min(100, average_fill * 0.75 + critical_count * 8), 1)
        city_demand.append(
            {
                "city": city,
                "average_fill": average_fill,
                "critical_bins": critical_count,
                "collection_demand": demand_score,
                "total_bins": len(city_bin_list),
            }
        )
    city_demand.sort(key=lambda item: item["collection_demand"], reverse=True)

    daily_trend = [
        {
            "date": date,
            "average_fill": round(stats["total_fill"] / stats["count"], 1),
            "critical_rate": round(stats["critical"] * 100 / stats["count"], 1),
        }
        for date, stats in sorted(daily.items())[-14:]
    ]
    hourly_pattern = [
        {
            "hour": hour,
            "average_fill": round(stats["total_fill"] / stats["count"], 1),
        }
        for hour, stats in sorted(hourly.items())
    ]
    total_current_fill = sum(item["fill_level"] for item in bins)
    current_critical = sum(item["fill_level"] >= 80 for item in bins)

    return {
        "generated_at": _utc_now().isoformat(),
        "data_quality": dict(DATA_QUALITY),
        "kpis": {
            "total_bins": len(bins),
            "current_average_fill": round(total_current_fill / len(bins), 1) if bins else 0,
            "current_critical_bins": current_critical,
            "historic_readings": len(HISTORICAL_READINGS),
        },
        "daily_fill_trend": daily_trend,
        "hourly_fill_pattern": hourly_pattern,
        "fill_distribution": [
            {"label": label, "count": count} for label, count in distribution.items()
        ],
        "city_collection_demand": city_demand,
    }
