"""Rule-based detection engine.

Rules are evaluated per event in event time (``occurred_at``), so replaying a run yields the
same alerts as watching it live. Rules never read ``details.scenario_stage``: the SOC must detect
the attack from behaviour alone.
"""
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Any, Optional

from .models import Event

SEVERITY_RANK = {"low": 1, "medium": 2, "high": 3, "critical": 4}


@dataclass
class AlertDraft:
    rule_id: str
    severity: str
    device_id: str
    title: str
    description: str
    technique_id: Optional[str]
    event_ids: list[str]
    entities: dict[str, list[str]]
    dedup_key: str
    source: str = "rule"
    score: Optional[float] = None


def entities_of(event: Event) -> dict[str, list[str]]:
    ents: dict[str, list[str]] = {"devices": [event.device_id], "ips": [], "users": [], "badges": []}
    if event.source.ip:
        ents["ips"].append(event.source.ip)
    if event.source.user:
        ents["users"].append(event.source.user)
    assigned = event.details.get("assigned_ip")
    if assigned:
        ents["ips"].append(str(assigned))
    badge = event.details.get("badge_id")
    if badge:
        ents["badges"].append(str(badge))
    return ents


class Window:
    """Sliding window of (timestamp, value) entries keyed by an arbitrary tuple."""

    def __init__(self, seconds: float):
        self.seconds = seconds
        self.items: dict[Any, deque] = defaultdict(deque)

    def add(self, key: Any, ts: float, value: Any) -> deque:
        items = self.items[key]
        items.append((ts, value))
        return self._trim(items, ts)

    def recent(self, key: Any, ts: float) -> deque:
        return self._trim(self.items.get(key, deque()), ts)

    def _trim(self, items: deque, ts: float) -> deque:
        while items and ts - items[0][0] > self.seconds:
            items.popleft()
        return items


class Rule:
    rule_id = ""
    name = ""

    def evaluate(self, event: Event) -> list[AlertDraft]:
        raise NotImplementedError


class BruteForceRule(Rule):
    """GW-R01: repeated authentication failures against one device from one source."""

    rule_id = "GW-R01"
    name = "Autentificări eșuate repetate"
    threshold = 5

    def __init__(self, failures: Window):
        self.failures = failures

    def evaluate(self, event: Event) -> list[AlertDraft]:
        if event.event_type != "auth_login" or event.outcome != "failure":
            return []
        items = self.failures.add((event.device_id, event.source.ip), event.ts, event.event_id)
        if len(items) < self.threshold:
            return []
        return [AlertDraft(
            rule_id=self.rule_id, severity="high", device_id=event.device_id,
            title=f"Atac de tip brute force asupra {event.device_id}",
            description=(f"{len(items)} autentificări eșuate în {int(self.failures.seconds)} s "
                         f"de la {event.source.ip} (utilizator {event.source.user or 'necunoscut'})."),
            technique_id="T1110", event_ids=[e for _, e in items], entities=entities_of(event),
            dedup_key=f"{self.rule_id}:{event.device_id}:{event.source.ip}",
        )]


class SuccessAfterBruteForceRule(Rule):
    """GW-R02: a successful login from a source that just brute-forced the same device."""

    rule_id = "GW-R02"
    name = "Autentificare reușită după brute force"
    min_failures = 5

    def __init__(self, failures: Window):
        self.failures = failures

    def evaluate(self, event: Event) -> list[AlertDraft]:
        if event.event_type != "auth_login" or event.outcome != "success":
            return []
        items = self.failures.recent((event.device_id, event.source.ip), event.ts)
        if len(items) < self.min_failures:
            return []
        return [AlertDraft(
            rule_id=self.rule_id, severity="critical", device_id=event.device_id,
            title=f"Cont compromis pe {event.device_id}",
            description=(f"Autentificare reușită ca „{event.source.user}” de la "
                         f"{event.source.ip} după {len(items)} încercări eșuate."),
            technique_id="T1078", event_ids=[e for _, e in items] + [event.event_id],
            entities=entities_of(event), dedup_key=f"{self.rule_id}:{event.device_id}:{event.source.ip}",
        )]


class OffHoursVendorVpnRule(Rule):
    """GW-R03: third-party (vendor) VPN session outside business hours."""

    rule_id = "GW-R03"
    name = "Sesiune VPN furnizor în afara programului"

    def evaluate(self, event: Event) -> list[AlertDraft]:
        if event.event_type != "vpn_session" or event.outcome != "success":
            return []
        user = event.source.user or ""
        vendor = user.startswith("vendor") or bool(event.details.get("third_party"))
        if not (vendor and event.details.get("off_hours")):
            return []
        return [AlertDraft(
            rule_id=self.rule_id, severity="medium", device_id=event.device_id,
            title="Acces VPN al unui furnizor în afara programului",
            description=(f"Utilizatorul {user} s-a conectat din {event.source.ip} la ora locală "
                         f"{event.details.get('local_hour', '?')}; IP intern alocat "
                         f"{event.details.get('assigned_ip', 'necunoscut')}."),
            technique_id="T1133", event_ids=[event.event_id], entities=entities_of(event),
            dedup_key=f"{self.rule_id}:{user}",
        )]


class NetworkScanRule(Rule):
    """GW-R04: one source probing many devices (explicit scan events or contact fan-out)."""

    rule_id = "GW-R04"
    name = "Scanare rețea internă"
    fanout = 5

    def __init__(self) -> None:
        self.contacts = Window(60)

    def evaluate(self, event: Event) -> list[AlertDraft]:
        ip = event.source.ip
        if not ip:
            return []
        if event.event_type == "network_scan":
            targets = [str(t) for t in event.details.get("targets", [])]
            if len(targets) < self.fanout:
                return []
            return [self._alert(event, len(targets), [event.event_id])]
        if event.origin == "synthetic" or event.event_type == "heartbeat":
            return []
        items = self.contacts.add(ip, event.ts, (event.device_id, event.event_id))
        devices = {d for _, (d, _) in items}
        if len(devices) < self.fanout:
            return []
        return [self._alert(event, len(devices), [e for _, (_, e) in items])]

    def _alert(self, event: Event, count: int, event_ids: list[str]) -> AlertDraft:
        return AlertDraft(
            rule_id=self.rule_id, severity="medium", device_id=event.device_id,
            title=f"Scanare a rețelei interne de la {event.source.ip}",
            description=f"Sursa {event.source.ip} a sondat {count} ținte într-un interval scurt.",
            technique_id="T1046", event_ids=event_ids, entities=entities_of(event),
            dedup_key=f"{self.rule_id}:{event.source.ip}",
        )


class DefenseImpairmentRule(Rule):
    """GW-R05: camera configuration changes that blind surveillance."""

    rule_id = "GW-R05"
    name = "Dezactivarea funcțiilor de supraveghere"
    risky = {"stream_disabled", "motion_detection_off", "recording_disabled"}

    def evaluate(self, event: Event) -> list[AlertDraft]:
        if event.event_type != "config_change" or event.outcome == "failure":
            return []
        change = str(event.details.get("change", ""))
        motion_off = event.details.get("motion_detection") in (False, "off")
        if change not in self.risky and not motion_off:
            return []
        return [AlertDraft(
            rule_id=self.rule_id, severity="high", device_id=event.device_id,
            title=f"Funcții de supraveghere dezactivate pe {event.device_id}",
            description=(f"Modificare „{change or 'motion_detection=off'}” efectuată de "
                         f"{event.source.user or 'necunoscut'} de la {event.source.ip}."),
            technique_id="T1562", event_ids=[event.event_id], entities=entities_of(event),
            dedup_key=f"{self.rule_id}:{event.device_id}",
        )]


class RecordingExfiltrationRule(Rule):
    """GW-R06: burst of recording exports from an NVR."""

    rule_id = "GW-R06"
    name = "Export masiv de înregistrări"
    threshold = 3

    def __init__(self) -> None:
        self.exports = Window(300)

    def evaluate(self, event: Event) -> list[AlertDraft]:
        if event.event_type != "recording_export" or event.outcome != "success":
            return []
        items = self.exports.add((event.device_id, event.source.ip), event.ts, event.event_id)
        if len(items) < self.threshold:
            return []
        return [AlertDraft(
            rule_id=self.rule_id, severity="high", device_id=event.device_id,
            title=f"Export neobișnuit de înregistrări de pe {event.device_id}",
            description=f"{len(items)} înregistrări exportate în 5 minute de la {event.source.ip}.",
            technique_id="T1005", event_ids=[e for _, e in items], entities=entities_of(event),
            dedup_key=f"{self.rule_id}:{event.device_id}:{event.source.ip}",
        )]


class ImpossibleBadgeTravelRule(Rule):
    """GW-R07: the same badge read at two different access-control units too quickly."""

    rule_id = "GW-R07"
    name = "Utilizare imposibilă a unui badge"
    seconds = 120

    def __init__(self) -> None:
        self.last_seen: dict[str, tuple[float, str, str]] = {}

    def evaluate(self, event: Event) -> list[AlertDraft]:
        if event.event_type != "badge_access" or not event.details.get("badge_id"):
            return []
        badge = str(event.details["badge_id"])
        previous = self.last_seen.get(badge)
        self.last_seen[badge] = (event.ts, event.device_id, event.event_id)
        if not previous:
            return []
        prev_ts, prev_device, prev_event = previous
        if prev_device == event.device_id or event.ts - prev_ts > self.seconds:
            return []
        restricted = " (zonă restricționată)" if event.details.get("restricted") else ""
        return [AlertDraft(
            rule_id=self.rule_id, severity="high", device_id=event.device_id,
            title=f"Badge {badge} folosit în două locații",
            description=(f"Badge-ul {badge} ({event.details.get('holder', 'titular necunoscut')}) a fost "
                         f"citit la {prev_device} și apoi la {event.device_id}{restricted} în "
                         f"{int(event.ts - prev_ts)} s: posibil badge clonat."),
            technique_id="T1078", event_ids=[prev_event, event.event_id], entities=entities_of(event),
            dedup_key=f"{self.rule_id}:{badge}",
        )]


class AntiForensicsRule(Rule):
    """GW-R08: deletion of recordings or clearing of logs."""

    rule_id = "GW-R08"
    name = "Ștergere de probe"

    def evaluate(self, event: Event) -> list[AlertDraft]:
        if event.event_type not in ("recording_delete", "log_cleared") or event.outcome == "failure":
            return []
        what = "jurnalele au fost golite" if event.event_type == "log_cleared" else "au fost șterse înregistrări"
        return [AlertDraft(
            rule_id=self.rule_id, severity="critical", device_id=event.device_id,
            title=f"Ștergere de probe pe {event.device_id}",
            description=f"Pe {event.device_id} {what} de {event.source.user or 'necunoscut'} ({event.source.ip}).",
            technique_id="T1070", event_ids=[event.event_id], entities=entities_of(event),
            dedup_key=f"{self.rule_id}:{event.device_id}",
        )]


class RuleEngine:
    def reset_device(self, device_id: str) -> None:
        """Remove only this device's evidence, including shared scan/badge windows."""
        for rule in self.rules:
            for name in ("failures", "exports"):
                window = getattr(rule, name, None)
                if window:
                    for key in list(window.items):
                        if key[0] == device_id:
                            del window.items[key]
            if isinstance(rule, NetworkScanRule):
                for key, entries in list(rule.contacts.items.items()):
                    remaining = deque((ts, value) for ts, value in entries if value[0] != device_id)
                    if remaining:
                        rule.contacts.items[key] = remaining
                    else:
                        del rule.contacts.items[key]
            if isinstance(rule, ImpossibleBadgeTravelRule):
                rule.last_seen = {k: v for k, v in rule.last_seen.items() if v[1] != device_id}
            window = getattr(rule, "window", None)  # observation rules: (run, device, src, dst)
            if window:
                for key in list(window.items):
                    if key[1] == device_id:
                        del window.items[key]

    def __init__(self) -> None:
        failures = Window(120)
        from .manual_rules import observation_rules
        self.rules: list[Rule] = [
            BruteForceRule(failures),
            SuccessAfterBruteForceRule(failures),
            OffHoursVendorVpnRule(),
            NetworkScanRule(),
            DefenseImpairmentRule(),
            RecordingExfiltrationRule(),
            ImpossibleBadgeTravelRule(),
            AntiForensicsRule(),
            *observation_rules(),
        ]

    def evaluate(self, event: Event) -> list[AlertDraft]:
        drafts: list[AlertDraft] = []
        for rule in self.rules:
            drafts.extend(rule.evaluate(event))
        return drafts

    def catalog(self) -> list[dict[str, str]]:
        return [{"rule_id": r.rule_id, "name": r.name} for r in self.rules]
