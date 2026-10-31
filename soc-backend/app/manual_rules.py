"""SOC-owned policy and thresholds; execution labels are never detection inputs."""
from .rules import AlertDraft, Rule, Window, entities_of


def device_type(ip):
    if ip in {f"10.20.1.{n}" for n in range(11, 19)}:
        return "camera"
    if ip in {"10.20.2.21", "10.20.2.22"}:
        return "nvr"
    if ip in {"10.20.3.31", "10.20.3.32", "10.20.3.33"}:
        return "access_control"
    return {"10.20.0.2": "iot_gateway", "10.20.0.1": "vpn_gateway"}.get(ip)


def allowed_link(source, target, port):
    return (source == "camera" and target == "nvr" and port in (443, 554)
            or source == "iot_gateway" and port == 8883
            or source == "vpn_gateway" and target == "iot_gateway" and port == 443)


class ObservationRule(Rule):
    def __init__(self, rule_id, name, kind, threshold, technique, response):
        self.rule_id, self.name, self.kind = rule_id, name, kind
        self.threshold, self.technique, self.response = threshold, technique, response
        self.window = Window(60)

    def evaluate(self, e):
        if e.event_type != self.kind:
            return []
        key = (e.run_id, e.device_id, e.source.ip, e.target.ip)
        evidence = None
        if self.rule_id == "GW-R09":
            if not e.target.port:
                return []
            items = self.window.add(key, e.ts, (e.target.port, e.event_id))
            if len({v[0] for _, v in items}) >= self.threshold:
                evidence = [v[1] for _, v in items]
        elif self.rule_id == "GW-R11":
            if e.outcome != "failure" or e.details.get("authorization") != "denied":
                return []
            items = self.window.add(key, e.ts, e.event_id)
            if len(items) >= self.threshold:
                evidence = [v for _, v in items]
        elif self.rule_id == "GW-R12":
            src, dst = device_type(e.source.ip), device_type(e.target.ip)
            if src and dst and e.source.ip != e.target.ip and not allowed_link(src, dst, e.target.port):
                evidence = [e.event_id]
        else:
            # Reject inconsistent flow measurements rather than accepting a test label.
            d = e.details
            try:
                duration, size, packets = float(d["duration_s"]), int(d["total_bytes"]), int(d["packet_count"])
                rate = float(d["packets_per_second"])
                if duration <= 0 or size < 0 or packets < 0 or abs(packets - rate * duration) > 1:
                    return []
                if self.rule_id == "GW-R10":
                    suspicious = rate >= 1000  # normal virtual profile: 100 pps
                else:
                    # Known internal source, unexpected external destination, >1 MB/s.
                    suspicious = bool(device_type(e.source.ip) and not device_type(e.target.ip)
                                      and not str(e.target.ip).startswith("10.") and size / duration >= 1000000)
            except (KeyError, TypeError, ValueError, OverflowError):
                return []
            if not suspicious:
                self.window.items.pop(key, None)
                return []
            items = self.window.add(key, e.ts, e.event_id)
            if len(items) >= self.threshold:
                evidence = [v for _, v in items]
        if not evidence:
            return []
        return [AlertDraft(
            rule_id=self.rule_id, severity="high", device_id=e.device_id,
            title=f"{self.name} · {e.device_id}",
            description=f"{e.source.ip} → {e.target.ip}; {len(evidence)} observations. {self.response}",
            technique_id=self.technique, event_ids=evidence, entities=entities_of(e),
            dedup_key=f"{self.rule_id}:{':'.join(str(v) for v in key)}")]


def observation_rules():
    return [
        ObservationRule("GW-R09", "Port scanning", "connection_attempt", 10, "T1046", "Block the virtual source."),
        ObservationRule("GW-R10", "Traffic flood", "network_flow", 3, "T1498", "Apply virtual rate limiting and filtering."),
        ObservationRule("GW-R11", "Repeated unauthorized access", "access_denied", 5, "T1078", "Revoke the virtual session or block access."),
        ObservationRule("GW-R12", "Network policy violation", "connection_attempt", 1, "T1021", "Block the virtual link and consider source isolation."),
        ObservationRule("GW-R13", "Abnormal outbound transfer", "network_flow", 3, "T1041", "Block the virtual destination and consider source isolation."),
    ]
