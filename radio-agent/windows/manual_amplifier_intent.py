"""Explicit manual amplifier permission from the server's authenticated intent.

Never infer a MANUAL power request from local audio state, stale cache, or
a diagnostic report. A network failure must not manufacture authorization.
"""
def authorized_manual_power(intent, *, esp32_ip, hardware_armed, isolated=False):
    if not hardware_armed or isolated or not isinstance(intent, dict):
        return False
    return (
        intent.get("permit") is True
        and intent.get("policyMode") == "MANUAL"
        and intent.get("reason") == "Ручной режим"
        and intent.get("emergencyOff") is False
        and intent.get("hardwareExpected") == "POWER_CONTROL_V1"
        and intent.get("esp32Ip") == esp32_ip
    )
