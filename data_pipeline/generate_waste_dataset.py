"""Generate a large, realistic-looking smart-waste IoT dataset.

Run from the repository root, for example:
    python data_pipeline/generate_waste_dataset.py --rows 250000
"""

import argparse
import csv
from datetime import datetime, timedelta, timezone
from pathlib import Path
import random


CITIES = {
    "Mumbai": ["CSMT", "Bandra Kurla Complex", "Dadar Market", "Juhu Beach"],
    "Delhi": ["Connaught Place", "Kashmere Gate", "Nehru Place", "India Gate"],
    "Kolkata": ["Howrah Station", "Park Street", "New Market", "Salt Lake"],
    "Bengaluru": ["Majestic", "MG Road", "Whitefield", "Cubbon Park"],
    "Chennai": ["Chennai Central", "T Nagar", "Marina Beach", "Guindy"],
    "Hyderabad": ["Secunderabad", "HITEC City", "Charminar", "Begum Bazaar"],
    "Pune": ["Pune Junction", "FC Road", "Hinjawadi", "Shivajinagar"],
    "Ahmedabad": ["Ahmedabad Junction", "CG Road", "Manek Chowk", "Sabarmati"],
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create raw smart-waste sensor data.")
    parser.add_argument("--rows", type=int, default=250_000, help="Number of readings to write.")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/raw/waste_sensor_readings.csv"),
        help="Destination CSV path.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.rows <= 0:
        raise ValueError("--rows must be greater than zero")

    randomizer = random.Random(20261006)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    start = datetime.now(timezone.utc) - timedelta(days=90)
    cities = list(CITIES.items())

    with args.output.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(
            csv_file,
            fieldnames=[
                "timestamp",
                "device_id",
                "city",
                "location",
                "fill_level",
                "temperature_c",
                "battery_percent",
                "gas_ppm",
                "source",
            ],
        )
        writer.writeheader()

        for row_number in range(args.rows):
            city, locations = cities[row_number % len(cities)]
            location = locations[row_number % len(locations)]
            hour = (row_number // len(cities)) % 24
            rush_hour_effect = 14 if hour in {8, 9, 18, 19, 20} else 0
            fill_level = max(0, min(100, round(randomizer.gauss(54 + rush_hour_effect, 24), 1)))

            # A small amount of imperfect raw data lets the Spark job demonstrate cleaning.
            if row_number % 997 == 0:
                fill_level = ""
            elif row_number % 1231 == 0:
                fill_level = 135

            writer.writerow(
                {
                    "timestamp": (start + timedelta(minutes=row_number * 5)).isoformat(),
                    "device_id": f"{city[:3].upper()}-{row_number % 600:03}",
                    "city": city,
                    "location": location,
                    "fill_level": fill_level,
                    "temperature_c": round(randomizer.uniform(20, 42), 1),
                    "battery_percent": round(randomizer.uniform(15, 100), 1),
                    "gas_ppm": round(randomizer.uniform(0, 85), 1),
                    "source": "iot_sensor",
                }
            )

    print(f"Created {args.rows:,} raw readings at {args.output}")


if __name__ == "__main__":
    main()
