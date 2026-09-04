import numpy as np
from ml.train_tabular import _metric_report, _select_group_split


def test_group_split_has_no_spatial_overlap_and_retains_classes() -> None:
    labels = np.asarray(
        ["industrial", "vegetation", "agricultural", "unknown"] * 20,
        dtype=str,
    )
    groups = np.asarray([f"block-{index // 4:02d}" for index in range(80)], dtype=str)

    train_indices, test_indices = _select_group_split(labels, groups)

    assert not set(groups[train_indices]) & set(groups[test_indices])
    assert set(labels[train_indices]) == set(labels)
    assert set(labels[test_indices]) == set(labels)


def test_metric_report_emphasizes_industrial_precision_and_recall() -> None:
    expected = np.asarray(["industrial", "industrial", "vegetation", "unknown"])
    predicted = np.asarray(["industrial", "unknown", "vegetation", "unknown"])
    report = _metric_report(
        expected,
        predicted,
        ["industrial", "vegetation", "unknown"],
    )

    assert report["industrial_precision"] == 1.0
    assert report["industrial_recall"] == 0.5
    assert len(report["confusion_matrix"]) == 3
