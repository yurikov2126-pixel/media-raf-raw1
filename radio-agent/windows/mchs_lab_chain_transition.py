"""Read-only lab diagnostic edge tracking; not a safety interlock."""
class LabChainTransition:
    def __init__(self):
        self.previous = None

    def observe(self, diagnostic):
        if not isinstance(diagnostic, dict) or diagnostic.get('mode') != 'DIAGNOSTIC_ONLY':
            return None
        checks = diagnostic.get('checks')
        if not isinstance(checks, dict):
            return None
        current = {key: str(value) for key, value in checks.items()}
        prior = self.previous
        if prior == current:
            return None
        self.previous = current
        changes = {key: {'from': prior.get(key) if prior else None, 'to': val}
                   for key, val in current.items() if prior is None or prior.get(key) != val}
        return {'event': 'BASELINE' if prior is None else 'STATE_CHANGE',
                'changes': changes,
                'realEmergencyReady': False,
                'physicalPAPathVerified': False}
