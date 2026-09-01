from datetime import datetime

from pydantic import BaseModel, Field


class IndustrialFacility(BaseModel):
    osm_id: str
    osm_type: str
    name: str
    facility_type: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    operator: str | None = None
    tags: dict[str, str]


class FacilityCollection(BaseModel):
    generated_at: datetime
    source: str
    total: int
    facilities: list[IndustrialFacility]


class FacilityRefreshResponse(BaseModel):
    refreshed_at: datetime
    facilities: int
    cache_file: str
    message: str
