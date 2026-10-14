from pydantic import BaseModel
from datetime import datetime


class BinBase(BaseModel):
    bin_name: str
    city: str
    location: str
    area: str
    fill_level: int
    status: str


class BinCreate(BinBase):
    pass


class BinUpdate(BaseModel):
    bin_name: str
    city: str
    location: str
    area: str
    fill_level: int
    status: str


class BinResponse(BinBase):
    id: int
    last_updated: datetime

    class Config:
        from_attributes = True