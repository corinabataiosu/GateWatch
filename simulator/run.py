"""Start the simulator: python simulator/run.py [--port 8001]."""
import argparse
import sys
from pathlib import Path

import uvicorn

sys.path.insert(0, str(Path(__file__).resolve().parent))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="GateWatch simulator")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8001)
    args = parser.parse_args()
    uvicorn.run("app.main:app", host=args.host, port=args.port)
