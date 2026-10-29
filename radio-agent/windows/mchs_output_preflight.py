"""Read-only preflight gate for a future physically isolated MCHS audio test.

This module never sends audio or changes Windows devices, VLC, amplifier or ESP32.
"""
def evaluate_isolated_output_preflight(*, observer, pa_cable_disconnected,
                                       separate_output_confirmed, operator_present):
    checks = {
        'observerFresh': isinstance(observer,dict) and observer.get('code')=='OBSERVABLE_ONLY',
        'paCableDisconnected': pa_cable_disconnected is True,
        'separateOutputConfirmed': separate_output_confirmed is True,
        'operatorPresent': operator_present is True,
    }
    return {
        'mode':'PREFLIGHT_ONLY',
        'checks':checks,
        'readyForControlledAudioTrial':all(checks.values()),
        'audioInterruptionVerified':False,
        'physicalIsolationVerifiedBySoftware':False,
        'hardwareSwitchAuthorized':False,
    }
