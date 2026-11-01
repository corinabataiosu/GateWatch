"""Read-only readiness checks. Does not reset data or generate attacks."""
import argparse
import json
import urllib.error
import urllib.request


def get(url):
    with urllib.request.urlopen(url, timeout=5) as response:
        return json.load(response)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sim', default='http://127.0.0.1:8001')
    parser.add_argument('--soc', default='http://127.0.0.1:8000')
    parser.add_argument('--video', action='store_true', help='also require real CAM-01 telemetry and a JPEG')
    parser.add_argument('--stream', default='http://127.0.0.1:8002')
    args = parser.parse_args()
    failed = []

    def check(ok, description):
        print(('OK   ' if ok else 'FAIL ') + description)
        if not ok:
            failed.append(description)

    try:
        sim = get(args.sim.rstrip('/') + '/sim/health')
        soc = get(args.soc.rstrip('/') + '/api/health')
        devices = get(args.soc.rstrip('/') + '/api/devices')
        check(sim.get('status') == 'ok', 'simulator reachable')
        ingestion = soc.get('ingestion', {})
        check(ingestion.get('connected') is True, f"SOC ingestion connected (error={ingestion.get('error')})")
        check(ingestion.get('run_id') == sim.get('run_id'), 'SOC follows current simulator run')
        check(not ingestion.get('catching_up', False), 'SOC caught up with event backlog')
        check(soc.get('model', {}).get('loaded') is True, 'SOC event model loaded')
        check(len(devices) == 15, f'{len(devices)} devices (expected 15)')
        camera = next((d for d in devices if d['device_id'] == 'CAM-01'), None)
        check(camera is not None, 'CAM-01 registered')
        if args.video:
            video = (camera or {}).get('video') or {}
            check(video.get('source') == 'camera' and video.get('stale') is False,
                  'CAM-01 has recent real-camera telemetry')
            with urllib.request.urlopen(args.stream.rstrip('/') + '/cadru.jpg', timeout=5) as response:
                check(response.headers.get_content_type() == 'image/jpeg' and response.read(2) == b'\xff\xd8',
                      'webcam JPEG endpoint responds')
    except (urllib.error.URLError, OSError, ValueError, KeyError) as error:
        check(False, str(error))
    return 1 if failed else 0


if __name__ == '__main__':
    raise SystemExit(main())
