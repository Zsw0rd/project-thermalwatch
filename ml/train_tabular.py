from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import time
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import sklearn
import xgboost as xgb
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
)
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from app.config import get_settings
from app.services.cluster_review import cluster_review_collection
from app.services.firms import load_events
from app.services.model_pipeline import (
    FEATURE_NAMES,
    FEATURE_VERSION,
    TARGET_CLASSES,
    TrainingSample,
    build_training_samples,
    model_training_readiness,
)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REPORT_PATH = PROJECT_ROOT / "backend/data/samples/model_benchmark_report.json"
DEFAULT_ARTIFACT_DIR = PROJECT_ROOT / "ml/models"
RANDOM_SEED = 26162


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train spatially separated AegisFire tabular development benchmarks."
    )
    parser.add_argument(
        "--label-source",
        choices=("weak", "reviewed"),
        default="weak",
        help="Weak labels are development-only; reviewed labels must pass the readiness gate.",
    )
    parser.add_argument(
        "--device",
        choices=("auto", "cuda", "cpu"),
        default="auto",
        help="Use CUDA for XGBoost when available, with an explicit CPU fallback in auto mode.",
    )
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT_PATH)
    parser.add_argument("--artifacts", type=Path, default=DEFAULT_ARTIFACT_DIR)
    return parser.parse_args()


def _gpu_inventory() -> dict[str, object]:
    command = [
        "nvidia-smi",
        "--query-gpu=name,memory.total,driver_version",
        "--format=csv,noheader,nounits",
    ]
    try:
        result = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
            timeout=10,
        )
    except (OSError, subprocess.SubprocessError):
        return {"available": False, "devices": []}
    devices = []
    for line in result.stdout.splitlines():
        parts = [part.strip() for part in line.split(",")]
        if len(parts) == 3:
            devices.append(
                {
                    "name": parts[0],
                    "memory_mib": int(parts[1]),
                    "driver_version": parts[2],
                }
            )
    return {"available": bool(devices), "devices": devices}


def _select_group_split(
    labels: np.ndarray[Any, np.dtype[np.str_]],
    groups: np.ndarray[Any, np.dtype[np.str_]],
) -> tuple[np.ndarray[Any, np.dtype[np.int64]], np.ndarray[Any, np.dtype[np.int64]]]:
    expected_labels = set(labels.tolist())
    splitter = GroupShuffleSplit(
        n_splits=100,
        test_size=0.25,
        random_state=RANDOM_SEED,
    )
    placeholder = np.zeros((len(labels), 1), dtype=np.float32)
    for train_indices, test_indices in splitter.split(placeholder, labels, groups):
        if (
            set(labels[train_indices].tolist()) == expected_labels
            and set(labels[test_indices].tolist()) == expected_labels
        ):
            return train_indices, test_indices
    raise RuntimeError(
        "No spatial-group split retained every class in both partitions; collect broader labels."
    )


def _top_importances(values: np.ndarray[Any, np.dtype[np.float64]]) -> dict[str, float]:
    ranked = sorted(
        zip(FEATURE_NAMES, values.tolist(), strict=True),
        key=lambda item: item[1],
        reverse=True,
    )[:12]
    return {name: round(float(value), 6) for name, value in ranked}


def _metric_report(
    expected: np.ndarray[Any, np.dtype[np.str_]],
    predicted: np.ndarray[Any, np.dtype[np.str_]],
    labels: list[str],
) -> dict[str, object]:
    report = classification_report(
        expected,
        predicted,
        labels=labels,
        output_dict=True,
        zero_division=0,
    )
    per_class = {
        label: {
            "precision": round(float(report[label]["precision"]), 6),
            "recall": round(float(report[label]["recall"]), 6),
            "f1": round(float(report[label]["f1-score"]), 6),
            "support": int(report[label]["support"]),
        }
        for label in labels
    }
    return {
        "balanced_accuracy": round(float(balanced_accuracy_score(expected, predicted)), 6),
        "macro_precision": round(float(report["macro avg"]["precision"]), 6),
        "macro_recall": round(float(report["macro avg"]["recall"]), 6),
        "macro_f1": round(float(report["macro avg"]["f1-score"]), 6),
        "weighted_f1": round(float(report["weighted avg"]["f1-score"]), 6),
        "industrial_precision": per_class.get("industrial", {}).get("precision", 0),
        "industrial_recall": per_class.get("industrial", {}).get("recall", 0),
        "industrial_f1": per_class.get("industrial", {}).get("f1", 0),
        "labels": labels,
        "confusion_matrix": confusion_matrix(expected, predicted, labels=labels).tolist(),
        "per_class": per_class,
    }


def _rules_baseline(sample: TrainingSample) -> str:
    features = dict(zip(FEATURE_NAMES, sample.features, strict=True))
    close_facility = (
        features["facility_present"] == 1
        and features["facility_distance_log_ratio_25km"]
        <= math_log_distance_ratio(3_000)
    )
    if close_facility and features["persistence_score"] >= 0.55:
        return "industrial"
    if features["land_cover_cropland"] == 1:
        return "agricultural"
    if features["land_cover_vegetation"] == 1:
        return "vegetation"
    return "unknown"


def math_log_distance_ratio(distance_m: float) -> float:
    return float(np.log1p(distance_m) / np.log1p(25_000))


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _save_json(path: Path, payload: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(f"{path.suffix}.tmp")
    with temporary.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2, sort_keys=True)
        handle.write("\n")
    temporary.replace(path)


def main() -> int:
    args = _parse_args()
    settings = get_settings()
    events = load_events(settings)
    review_collection = cluster_review_collection(settings)
    readiness = model_training_readiness(events, settings)
    samples = build_training_samples(events, review_collection.reviews)

    if args.label_source == "reviewed":
        if readiness.status != "ready_for_reviewed_training":
            print(json.dumps({"status": readiness.status, "blockers": readiness.blockers}, indent=2))
            return 2
        selected_samples = [sample for sample in samples if sample.reviewed_label]
        label_provenance = "analyst_reviewed"
        evaluation_language = "held-out reviewed-label evaluation"
    else:
        selected_samples = samples
        label_provenance = "weak_rules"
        evaluation_language = "held-out weak-label agreement; not validation accuracy"

    labels = np.asarray(
        [
            sample.reviewed_label
            if args.label_source == "reviewed"
            else sample.weak_label
            for sample in selected_samples
        ],
        dtype=str,
    )
    features = np.asarray([sample.features for sample in selected_samples], dtype=np.float32)
    groups = np.asarray([sample.spatial_group for sample in selected_samples], dtype=str)
    train_indices, test_indices = _select_group_split(labels, groups)
    train_features = features[train_indices]
    test_features = features[test_indices]
    train_labels = labels[train_indices]
    test_labels = labels[test_indices]
    ordered_labels = [label for label in TARGET_CLASSES if label in set(labels.tolist())]

    args.artifacts.mkdir(parents=True, exist_ok=True)
    candidates: list[dict[str, object]] = []
    artifact_manifest: list[dict[str, object]] = []

    baseline_predictions = np.asarray(
        [_rules_baseline(selected_samples[index]) for index in test_indices],
        dtype=str,
    )
    rules_report = {
        "model": "model_v1_rules_baseline",
        "device": "cpu",
        "training_seconds": 0.0,
        "evaluation_language": evaluation_language,
        "metrics": _metric_report(test_labels, baseline_predictions, ordered_labels),
        "feature_importances": {},
    }

    logistic = Pipeline(
        [
            ("scale", StandardScaler()),
            (
                "classifier",
                LogisticRegression(
                    class_weight="balanced",
                    max_iter=2_000,
                    random_state=RANDOM_SEED,
                ),
            ),
        ]
    )
    started = time.perf_counter()
    logistic.fit(train_features, train_labels)
    duration = time.perf_counter() - started
    logistic_predictions = logistic.predict(test_features).astype(str)
    logistic_coefficients = np.mean(
        np.abs(logistic.named_steps["classifier"].coef_), axis=0
    ).astype(np.float64)
    logistic_path = args.artifacts / "model_v2_logistic.joblib"
    joblib.dump(logistic, logistic_path)
    candidates.append(
        {
            "model": "model_v2_logistic",
            "device": "cpu",
            "training_seconds": round(duration, 6),
            "evaluation_language": evaluation_language,
            "metrics": _metric_report(test_labels, logistic_predictions, ordered_labels),
            "feature_importances": _top_importances(logistic_coefficients),
        }
    )
    artifact_manifest.append(
        {"model": "model_v2_logistic", "file": logistic_path.name, "sha256": _sha256(logistic_path)}
    )

    forest = RandomForestClassifier(
        n_estimators=400,
        max_depth=12,
        min_samples_leaf=2,
        class_weight="balanced_subsample",
        random_state=RANDOM_SEED,
        n_jobs=-1,
    )
    started = time.perf_counter()
    forest.fit(train_features, train_labels)
    duration = time.perf_counter() - started
    forest_predictions = forest.predict(test_features).astype(str)
    forest_path = args.artifacts / "model_v3_random_forest.joblib"
    joblib.dump(forest, forest_path)
    candidates.append(
        {
            "model": "model_v3_random_forest",
            "device": "cpu",
            "training_seconds": round(duration, 6),
            "evaluation_language": evaluation_language,
            "metrics": _metric_report(test_labels, forest_predictions, ordered_labels),
            "feature_importances": _top_importances(forest.feature_importances_.astype(np.float64)),
        }
    )
    artifact_manifest.append(
        {"model": "model_v3_random_forest", "file": forest_path.name, "sha256": _sha256(forest_path)}
    )

    class_to_index = {label: index for index, label in enumerate(ordered_labels)}
    index_to_class = np.asarray(ordered_labels, dtype=str)
    encoded_train_labels = np.asarray(
        [class_to_index[label] for label in train_labels], dtype=np.int32
    )
    gpu_inventory = _gpu_inventory()
    requested_cuda = args.device == "cuda" or (
        args.device == "auto" and bool(gpu_inventory["available"])
    )
    xgboost_device = "cuda" if requested_cuda else "cpu"
    fallback_reason: str | None = None

    def new_xgboost(device: str) -> xgb.XGBClassifier:
        return xgb.XGBClassifier(
            objective="multi:softprob",
            num_class=len(ordered_labels),
            n_estimators=450,
            max_depth=7,
            learning_rate=0.04,
            subsample=0.85,
            colsample_bytree=0.85,
            min_child_weight=2,
            reg_lambda=1.5,
            tree_method="hist",
            device=device,
            random_state=RANDOM_SEED,
            eval_metric="mlogloss",
        )

    boosted = new_xgboost(xgboost_device)
    started = time.perf_counter()
    try:
        boosted.fit(train_features, encoded_train_labels, verbose=False)
    except xgb.core.XGBoostError as error:
        if args.device != "auto" or xgboost_device != "cuda":
            raise
        fallback_reason = f"CUDA training failed and auto mode used CPU: {type(error).__name__}"
        xgboost_device = "cpu"
        boosted = new_xgboost(xgboost_device)
        boosted.fit(train_features, encoded_train_labels, verbose=False)
    duration = time.perf_counter() - started
    probability_matrix = boosted.get_booster().predict(xgb.DMatrix(test_features))
    boosted_predictions = index_to_class[np.argmax(probability_matrix, axis=1)]
    booster_configuration = json.loads(boosted.get_booster().save_config())
    resolved_booster_device = booster_configuration["learner"]["generic_param"]["device"]
    boosted_path = args.artifacts / "model_v4_xgboost.ubj"
    boosted.save_model(boosted_path)
    candidates.append(
        {
            "model": "model_v4_xgboost",
            "device": resolved_booster_device,
            "requested_device": args.device,
            "fallback_reason": fallback_reason,
            "training_seconds": round(duration, 6),
            "evaluation_language": evaluation_language,
            "metrics": _metric_report(test_labels, boosted_predictions, ordered_labels),
            "feature_importances": _top_importances(
                boosted.feature_importances_.astype(np.float64)
            ),
        }
    )
    artifact_manifest.append(
        {"model": "model_v4_xgboost", "file": boosted_path.name, "sha256": _sha256(boosted_path)}
    )

    selected_model = max(
        candidates,
        key=lambda candidate: float(candidate["metrics"]["macro_f1"]),  # type: ignore[index]
    )["model"]
    fingerprint_material = "|".join(
        sorted(f"{sample.cluster_id}:{label}" for sample, label in zip(selected_samples, labels, strict=True))
    )
    report: dict[str, object] = {
        "report_version": "model_benchmark_v1",
        "generated_at": datetime.now(UTC).isoformat(),
        "status": "development_only" if args.label_source == "weak" else "reviewed_evaluation",
        "label_provenance": label_provenance,
        "evaluation_language": evaluation_language,
        "dataset_fingerprint": hashlib.sha256(
            f"{FEATURE_VERSION}|{fingerprint_material}".encode()
        ).hexdigest(),
        "sample_count": len(selected_samples),
        "feature_version": FEATURE_VERSION,
        "feature_count": len(FEATURE_NAMES),
        "feature_names": list(FEATURE_NAMES),
        "class_counts": dict(Counter(labels.tolist())),
        "spatial_group_size_degrees": 2.0,
        "spatial_group_count": len(set(groups.tolist())),
        "train_samples": len(train_indices),
        "test_samples": len(test_indices),
        "train_spatial_groups": len(set(groups[train_indices].tolist())),
        "test_spatial_groups": len(set(groups[test_indices].tolist())),
        "spatial_group_overlap": sorted(
            set(groups[train_indices].tolist()) & set(groups[test_indices].tolist())
        ),
        "random_seed": RANDOM_SEED,
        "rules_baseline": rules_report,
        "candidate_models": candidates,
        "selected_development_candidate": selected_model,
        "gpu_inventory": gpu_inventory,
        "library_versions": {
            "numpy": np.__version__,
            "scikit_learn": sklearn.__version__,
            "xgboost": xgb.__version__,
        },
        "artifacts": artifact_manifest,
        "production_eligible": False,
        "operational_model_unchanged": "rules_temporal_metric_v3",
        "limitations": [
            "Weak-label scores measure agreement with existing rules, not real-world classification accuracy."
            if args.label_source == "weak"
            else "Reviewed-label evaluation requires acceptance criteria and error analysis before deployment.",
            "The source archive covers eight UTC dates and cannot support seasonal generalization claims.",
            "Two-degree spatial blocks prevent direct block overlap but do not prove cross-region generalization.",
            "No trained candidate is loaded into operational inference automatically.",
        ],
    }
    _save_json(args.report, report)
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
