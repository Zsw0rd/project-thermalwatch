import argparse
import json
import sys
import time

from app.config import get_settings
from app.services.ingestion_operations import run_firms_ingestion_cycle


def _arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run an attributed NASA FIRMS refresh and immutable archive cycle."
    )
    parser.add_argument(
        "--loop",
        action="store_true",
        help="Repeat using FIRMS_REFRESH_INTERVAL_MINUTES; default is one cycle.",
    )
    return parser.parse_args()


def main() -> int:
    args = _arguments()
    settings = get_settings()
    while True:
        exit_code = 0
        try:
            response = run_firms_ingestion_cycle("scheduler", settings)
            print(response.model_dump_json())
        except Exception as error:  # noqa: BLE001 - scheduler must audit and continue
            exit_code = 1
            print(
                json.dumps(
                    {
                        "status": "failed",
                        "error_type": type(error).__name__,
                        "message": "FIRMS ingestion cycle failed; details are recorded in the audit.",
                    }
                ),
                file=sys.stderr,
            )
        if not args.loop:
            return exit_code
        time.sleep(max(60, settings.firms_refresh_interval_minutes * 60))


if __name__ == "__main__":
    raise SystemExit(main())
