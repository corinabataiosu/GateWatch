"""Export hours of simulator baseline traffic as JSONL, on a virtual clock.

Drives the real BaselineEngine one simulated second per tick, so the SOC's ML model can be trained
on exactly the behaviour the simulator produces (see soc-backend/app/ml/train.py --events).

Usage (from the repo root):
    python simulator/tools/export_baseline.py --hours 6 --out soc-backend/data/sim_baseline.jsonl
"""
import argparse
import json
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import events as events_module  # noqa: E402
from app import store as store_module  # noqa: E402
from app.config import Settings  # noqa: E402
from app.state import Simulator  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--hours", type=float, default=6)
    parser.add_argument("--rate", type=float, default=1.0, help="baseline rate multiplier")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    clock = {"now": datetime(2026, 10, 1, 6, 0, tzinfo=timezone.utc)}

    def virtual_now() -> str:
        return clock["now"].strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

    events_module.utc_now = virtual_now
    store_module.utc_now = virtual_now

    sim = Simulator(Settings(db_path=":memory:", background=False, baseline_rate=args.rate))
    sim.baseline._rng = random.Random(args.seed)
    run_id = sim.store.current_run_id
    for second in range(int(args.hours * 3600)):
        clock["now"] += timedelta(seconds=1)
        sim.baseline.tick(float(second))

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    count, after = 0, 0
    with out.open("w", encoding="utf-8") as fh:
        while True:
            page = sim.store.get_events(run_id, after_seq=after, limit=5000)
            if not page:
                break
            for event in page:
                fh.write(json.dumps(event) + "\n")
            count += len(page)
            after = page[-1]["seq"]
    print(f"wrote {count} baseline events ({args.hours} h simulated) to {out}")


if __name__ == "__main__":
    main()
