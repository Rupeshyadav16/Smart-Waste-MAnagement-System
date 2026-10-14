from sqlalchemy import Column, Integer, String, Float, Boolean, JSON
from app.database import Base


class Bin(Base):
    __tablename__ = "bins"

    id = Column(Integer, primary_key=True, index=True)
    load_status = Column(String, nullable=False)
    gas_status = Column(JSON, nullable=False)
    weight = Column(Float, nullable=False)
    alert = Column(Boolean, default=False)
    light_indicator = Column(Boolean, default=False)
    buzzer = Column(Boolean, default=False)
    last_updated = Column(String, nullable=False)