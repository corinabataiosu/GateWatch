# Attacker demo

`attack_cam01.py` runs a live attack against the simulator's **interactive services**. It needs only the Python standard library. Every request becomes an `observed_http` event with your machine's real IP, so the SOC detects it the same way it detects scenario traffic.

```bash
python attacker-demo/attack_cam01.py --target http://127.0.0.1:8001
```

Steps:

1. Brute force on `POST /devices/CAM-01/login`. The wordlist ends with the real password.
2. `GET /devices/CAM-01/snapshot` with the obtained bearer session.
3. Three badge attempts at the restricted ACS-03 door (two unknown badges, one valid).

Once the SOC has isolated CAM-01, the script stops at the first 403.

Use this only against the GateWatch simulator.
