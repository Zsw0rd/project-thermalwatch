from app.schemas.facilities import IndustrialFacility
from app.services.osm import build_facility_index, nearest_facility


def test_nearest_facility_uses_metric_distance_and_limit() -> None:
    refinery = IndustrialFacility(
        osm_id="node/1",
        osm_type="node",
        name="Test refinery",
        facility_type="refinery",
        latitude=22.0,
        longitude=72.0,
        tags={"industrial": "refinery"},
    )

    nearby = nearest_facility(22.005, 72.0, [refinery], max_distance_m=2_000)
    assert nearby is not None
    assert 500 < nearby.distance_m < 600

    outside = nearest_facility(23.0, 72.0, [refinery], max_distance_m=2_000)
    assert outside is None

    indexed = nearest_facility(
        22.005,
        72.0,
        [refinery],
        max_distance_m=2_000,
        facility_index=build_facility_index([refinery]),
    )
    assert indexed is not None
    assert indexed.osm_id == refinery.osm_id
