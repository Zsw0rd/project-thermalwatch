"""Create initial geospatial intelligence schema."""

from collections.abc import Sequence

import sqlalchemy as sa
from geoalchemy2 import Geography
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.create_table(
        "thermal_clusters",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("centroid", Geography("POINT", srid=4326, spatial_index=False), nullable=False),
        sa.Column("first_seen", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=False),
        sa.Column("detection_count", sa.Integer(), nullable=False),
        sa.Column("sensor_count", sa.Integer(), nullable=False),
        sa.Column("persistence_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("baseline_frp_mw", sa.Float()),
    )
    op.create_index(
        "ix_thermal_clusters_centroid", "thermal_clusters", ["centroid"], postgresql_using="gist"
    )
    op.create_table(
        "thermal_events",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("source", sa.String(64), nullable=False),
        sa.Column("geom", Geography("POINT", srid=4326, spatial_index=False), nullable=False),
        sa.Column("acquired_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("satellite", sa.String(32), nullable=False),
        sa.Column("confidence", sa.String(16), nullable=False),
        sa.Column("frp_mw", sa.Float(), nullable=False),
        sa.Column("brightness_i4_k", sa.Float()),
        sa.Column("brightness_i5_k", sa.Float()),
        sa.Column("brightness_delta_k", sa.Float()),
        sa.Column("day_night", sa.String(1), nullable=False),
        sa.Column("raw_payload", postgresql.JSONB(), nullable=False),
        sa.Column(
            "cluster_id", sa.String(32), sa.ForeignKey("thermal_clusters.id", ondelete="SET NULL")
        ),
        sa.Column("processing_status", sa.String(32), nullable=False, server_default="normalized"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_thermal_events_geom", "thermal_events", ["geom"], postgresql_using="gist")
    op.create_index("ix_thermal_events_acquired_at", "thermal_events", ["acquired_at"])
    op.create_index("ix_thermal_events_cluster_id", "thermal_events", ["cluster_id"])
    op.create_table(
        "industrial_facilities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("osm_id", sa.String(64), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("facility_type", sa.String(64), nullable=False),
        sa.Column("operator", sa.String(255)),
        sa.Column("geom", Geography("POINT", srid=4326, spatial_index=False), nullable=False),
        sa.Column("tags", postgresql.JSONB(), nullable=False),
        sa.Column("source", sa.String(32), nullable=False, server_default="OpenStreetMap"),
        sa.Column("last_updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_industrial_facilities_geom", "industrial_facilities", ["geom"], postgresql_using="gist"
    )
    op.create_index("ix_industrial_facilities_type", "industrial_facilities", ["facility_type"])
    op.create_table(
        "predictions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "event_id",
            sa.String(64),
            sa.ForeignKey("thermal_events.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("model_version", sa.String(64), nullable=False),
        sa.Column("feature_version", sa.String(64), nullable=False),
        sa.Column("predicted_class", sa.String(64), nullable=False),
        sa.Column("probability", sa.Float(), nullable=False),
        sa.Column("explanation", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "alerts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "event_id",
            sa.String(64),
            sa.ForeignKey("thermal_events.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("alert_type", sa.String(64), nullable=False),
        sa.Column("severity", sa.String(16), nullable=False),
        sa.Column("status", sa.String(24), nullable=False, server_default="open"),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("acknowledged", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True)),
    )


def downgrade() -> None:
    op.drop_table("alerts")
    op.drop_table("predictions")
    op.drop_index("ix_industrial_facilities_type", table_name="industrial_facilities")
    op.drop_index("ix_industrial_facilities_geom", table_name="industrial_facilities")
    op.drop_table("industrial_facilities")
    op.drop_index("ix_thermal_events_cluster_id", table_name="thermal_events")
    op.drop_index("ix_thermal_events_acquired_at", table_name="thermal_events")
    op.drop_index("ix_thermal_events_geom", table_name="thermal_events")
    op.drop_table("thermal_events")
    op.drop_index("ix_thermal_clusters_centroid", table_name="thermal_clusters")
    op.drop_table("thermal_clusters")
