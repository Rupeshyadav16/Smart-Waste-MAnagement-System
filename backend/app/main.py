from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import analytics, bins
from app.routes.bins import generate_demo_bins
from app.services.analytics import reset_and_seed_history

app = FastAPI(title="Smart Waste Management API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Generate the live network and its cleaned historical IoT telemetry.
generate_demo_bins()
reset_and_seed_history(bins.BINS)

app.include_router(bins.router)
app.include_router(analytics.router)


@app.get("/")
def root():
    return {"message": "Smart Waste Management API is running"}
