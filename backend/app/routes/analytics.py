from fastapi import APIRouter

from app.routes import bins
from app.services.analytics import get_dashboard_analytics

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/dashboard")
def get_dashboard():
    """Provide cleaned IoT telemetry aggregates for the dashboard charts."""
    return get_dashboard_analytics(bins.BINS)
