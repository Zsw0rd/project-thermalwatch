from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from geoalchemy2 import Geography
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ThermalEventRecord(Base):
    __tablename__ = "thermal_events"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    source: Mapped[str] = mapped_column(String(64), index=True)
    geom: Mapped[Any] = mapped_column(Geography("POINT", srid=4326, spatial_index=True))
    acquired_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    satellite: Mapped[str] = mapped_column(String(32))
    confidence: Mapped[str] = mapped_column(String(16), index=True)
    frp_mw: Mapped[float] = mapped_column(Float)
    brightness_i4_k: Mapped[float | None] = mapped_column(Float)
    brightness_i5_k: Mapped[float | None] = mapped_column(Float)
    brightness_delta_k: Mapped[float | None] = mapped_column(Float)
    day_night: Mapped[str] = mapped_column(String(1))
    raw_payload: Mapped[dict[str, Any]] = mapped_column(JSONB)
    cluster_id: Mapped[str | None] = mapped_column(
        ForeignKey("thermal_clusters.id", ondelete="SET NULL"), index=True
    )
    processing_status: Mapped[str] = mapped_column(String(32), default="normalized")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class IndustrialFacilityRecord(Base):
    __tablename__ = "industrial_facilities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    osm_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    facility_type: Mapped[str] = mapped_column(String(64), index=True)
    operator: Mapped[str | None] = mapped_column(String(255))
    geom: Mapped[Any] = mapped_column(Geography("POINT", srid=4326, spatial_index=True))
    tags: Mapped[dict[str, Any]] = mapped_column(JSONB)
    source: Mapped[str] = mapped_column(String(32), default="OpenStreetMap")
    last_updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ThermalClusterRecord(Base):
    __tablename__ = "thermal_clusters"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    centroid: Mapped[Any] = mapped_column(Geography("POINT", srid=4326, spatial_index=True))
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    detection_count: Mapped[int] = mapped_column(Integer)
    sensor_count: Mapped[int] = mapped_column(Integer)
    persistence_score: Mapped[float] = mapped_column(Float, default=0)
    baseline_frp_mw: Mapped[float | None] = mapped_column(Float)


class PredictionRecord(Base):
    __tablename__ = "predictions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[str] = mapped_column(
        ForeignKey("thermal_events.id", ondelete="CASCADE"), index=True
    )
    model_version: Mapped[str] = mapped_column(String(64))
    feature_version: Mapped[str] = mapped_column(String(64))
    predicted_class: Mapped[str] = mapped_column(String(64), index=True)
    probability: Mapped[float] = mapped_column(Float)
    explanation: Mapped[dict[str, Any]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AlertRecord(Base):
    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[str] = mapped_column(
        ForeignKey("thermal_events.id", ondelete="CASCADE"), index=True
    )
    alert_type: Mapped[str] = mapped_column(String(64), index=True)
    severity: Mapped[str] = mapped_column(String(16), index=True)
    status: Mapped[str] = mapped_column(String(24), default="open", index=True)
    reason: Mapped[str] = mapped_column(Text)
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
