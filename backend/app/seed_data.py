"""Regenerate the in-memory Indian demo dataset for local development.

The running API invokes this automatically at startup. This helper is useful
only when working interactively in the same Python process; it does not create
or persist a database file.
"""

from app.routes import bins


if __name__ == "__main__":
    bins.generate_demo_bins()
    print(
        f"Generated {len(bins.BINS)} smart bins across "
        f"{len(bins.CITY_LOCATIONS)} Indian cities."
    )
