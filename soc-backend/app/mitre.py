"""MITRE ATT&CK techniques referenced by GateWatch detections."""

TECHNIQUES: dict[str, dict[str, str]] = {
    "T1498": {"technique": "Network Denial of Service", "tactic": "Impact"},
    "T1021": {"technique": "Remote Services", "tactic": "Lateral Movement"},
    "T1041": {"technique": "Exfiltration Over C2 Channel", "tactic": "Exfiltration"},
    "T1133": {"technique": "External Remote Services", "tactic": "Initial Access"},
    "T1046": {"technique": "Network Service Discovery", "tactic": "Discovery"},
    "T1110": {"technique": "Brute Force", "tactic": "Credential Access"},
    "T1078": {"technique": "Valid Accounts", "tactic": "Persistence"},
    "T1562": {"technique": "Impair Defenses", "tactic": "Defense Evasion"},
    "T1005": {"technique": "Data from Local System", "tactic": "Collection"},
    "T1070": {"technique": "Indicator Removal", "tactic": "Defense Evasion"},
}

# Order used to describe the attack progression in incident summaries.
TACTIC_ORDER = [
    "Initial Access", "Discovery", "Credential Access", "Persistence",
    "Defense Evasion", "Lateral Movement", "Collection", "Exfiltration", "Impact",
]


def mitre(technique_id: str | None) -> dict[str, str] | None:
    if not technique_id or technique_id not in TECHNIQUES:
        return None
    return {"technique_id": technique_id, **TECHNIQUES[technique_id]}
