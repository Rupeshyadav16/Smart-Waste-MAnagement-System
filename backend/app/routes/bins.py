from datetime import datetime
import random

from fastapi import APIRouter, HTTPException

from app.services.analytics import record_sensor_snapshot

router = APIRouter(prefix="/bins", tags=["Bins"])

BINS = []

# Each city has representative public locations. Add a city here to extend the
# demo network; its bins will be generated automatically on application start.
CITY_LOCATIONS = {
    "Mumbai": [
        ("Chhatrapati Shivaji Maharaj Terminus", "Transit"),
        ("Bandra Kurla Complex", "Business District"),
        ("Marine Drive", "Promenade"),
        ("Dadar Market", "Market"),
        ("IIT Bombay", "Campus"),
        ("Juhu Beach", "Tourism"),
    ],
    "Delhi": [
        ("Connaught Place", "Commercial"),
        ("Kashmere Gate ISBT", "Transit"),
        ("India Gate", "Tourism"),
        ("Nehru Place", "Business District"),
        ("Delhi University North Campus", "Campus"),
        ("Sarojini Nagar Market", "Market"),
    ],
    "Kolkata": [
        ("Howrah Station", "Transit"),
        ("Park Street", "Commercial"),
        ("New Market", "Market"),
        ("Victoria Memorial", "Tourism"),
        ("Salt Lake Sector V", "Business District"),
        ("Jadavpur University", "Campus"),
    ],
    "Bengaluru": [
        ("Majestic Bus Station", "Transit"),
        ("MG Road", "Commercial"),
        ("Cubbon Park", "Park"),
        ("Whitefield IT Park", "Business District"),
        ("KR Market", "Market"),
        ("Indian Institute of Science", "Campus"),
    ],
    "Chennai": [
        ("Chennai Central", "Transit"),
        ("T Nagar", "Commercial"),
        ("Marina Beach", "Tourism"),
        ("Guindy Industrial Estate", "Industrial"),
        ("Anna University", "Campus"),
        ("Koyambedu Market", "Market"),
    ],
    "Hyderabad": [
        ("Secunderabad Junction", "Transit"),
        ("HITEC City", "Business District"),
        ("Charminar", "Tourism"),
        ("Begum Bazaar", "Market"),
        ("Hussain Sagar", "Park"),
        ("University of Hyderabad", "Campus"),
    ],
    "Pune": [
        ("Pune Junction", "Transit"),
        ("FC Road", "Commercial"),
        ("Shivajinagar Market", "Market"),
        ("Hinjawadi IT Park", "Business District"),
        ("Savitribai Phule Pune University", "Campus"),
        ("Saras Baug", "Park"),
    ],
    "Ahmedabad": [
        ("Ahmedabad Junction", "Transit"),
        ("CG Road", "Commercial"),
        ("Manek Chowk", "Market"),
        ("Sabarmati Riverfront", "Tourism"),
        ("GIFT City", "Business District"),
        ("IIM Ahmedabad", "Campus"),
    ],
}

CITY_CODES = {
    "Mumbai": "MUM",
    "Delhi": "DEL",
    "Kolkata": "KOL",
    "Bengaluru": "BLR",
    "Chennai": "CHE",
    "Hyderabad": "HYD",
    "Pune": "PUN",
    "Ahmedabad": "AMD",
}


def now_str():
    return datetime.utcnow().isoformat()


def get_status(fill_level: int) -> str:
    if fill_level >= 80:
        return "Full"
    if fill_level >= 40:
        return "Half Full"
    return "Empty"


def generate_demo_bins():
    """Create a fresh Indian smart-bin network for the in-memory demo."""
    global BINS

    bins = []
    counter = 1

    for city, locations in CITY_LOCATIONS.items():
        for idx, (location, area) in enumerate(locations, start=1):
            fill_level = random.randint(5, 100)
            bins.append(
                {
                    "id": counter,
                    "bin_name": f"{CITY_CODES[city]}-{idx:02}",
                    "city": city,
                    "location": location,
                    "area": area,
                    "fill_level": fill_level,
                    "status": get_status(fill_level),
                    "last_updated": now_str(),
                }
            )
            counter += 1

    BINS = bins


@router.get("/")
def get_bins():
    return BINS


@router.get("/{bin_id}")
def get_bin(bin_id: int):
    for bin_obj in BINS:
        if bin_obj["id"] == bin_id:
            return bin_obj
    raise HTTPException(status_code=404, detail="Bin not found")


@router.post("/")
def create_bin(bin_data: dict):
    global BINS

    new_id = max((b["id"] for b in BINS), default=0) + 1
    fill_level = max(0, min(100, int(bin_data.get("fill_level", 0))))

    new_bin = {
        "id": new_id,
        "bin_name": bin_data.get("bin_name", f"BIN-{new_id:02}"),
        "city": bin_data.get("city", "Mumbai"),
        "location": bin_data.get("location", "Unknown"),
        "area": bin_data.get("area", "General"),
        "fill_level": fill_level,
        "status": get_status(fill_level),
        "last_updated": now_str(),
    }

    BINS.append(new_bin)
    return new_bin


@router.put("/{bin_id}")
def update_bin(bin_id: int, bin_data: dict):
    for bin_obj in BINS:
        if bin_obj["id"] == bin_id:
            fill_level = max(
                0, min(100, int(bin_data.get("fill_level", bin_obj["fill_level"])))
            )

            bin_obj["bin_name"] = bin_data.get("bin_name", bin_obj["bin_name"])
            bin_obj["city"] = bin_data.get("city", bin_obj["city"])
            bin_obj["location"] = bin_data.get("location", bin_obj["location"])
            bin_obj["area"] = bin_data.get("area", bin_obj["area"])
            bin_obj["fill_level"] = fill_level
            bin_obj["status"] = get_status(fill_level)
            bin_obj["last_updated"] = now_str()

            return bin_obj

    raise HTTPException(status_code=404, detail="Bin not found")


@router.delete("/{bin_id}")
def delete_bin(bin_id: int):
    global BINS

    for bin_obj in BINS:
        if bin_obj["id"] == bin_id:
            BINS = [b for b in BINS if b["id"] != bin_id]
            return {"message": "Bin deleted successfully"}

    raise HTTPException(status_code=404, detail="Bin not found")


@router.post("/simulate")
def simulate_sensor_updates():
    updated_count = 0

    for bin_obj in BINS:
        action = random.choices(
            ["increase", "same", "decrease"], weights=[60, 25, 15], k=1
        )[0]

        if action == "increase":
            bin_obj["fill_level"] = min(bin_obj["fill_level"] + random.randint(5, 15), 100)
        elif action == "decrease":
            bin_obj["fill_level"] = max(bin_obj["fill_level"] - random.randint(10, 40), 0)

        bin_obj["status"] = get_status(bin_obj["fill_level"])
        bin_obj["last_updated"] = now_str()
        updated_count += 1

    record_sensor_snapshot(BINS)

    return {
        "message": "Sensor simulation completed",
        "updated_bins": updated_count,
    }
