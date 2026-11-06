"""Validate the reported ESP32 power command outcome before calling it ACK.

An HTTP success or the firmware's generic ok flag is not enough to claim
that the requested GPIO13 state was commanded. This still cannot measure
mains voltage or establish speaker audibility.
"""


def require_power_command_ack(reply, permit):
    if type(permit) is not bool:
        raise ValueError("Power permit must be boolean")
    if not isinstance(reply, dict):
        raise RuntimeError("ESP32 power reply missing")
    expected = "ON_COMMANDED" if permit else "OFF_COMMANDED"
    if reply.get("ok") is not True or reply.get("amplifierPower") != expected:
        raise RuntimeError("ESP32_POWER_STATE_MISMATCH")
    return expected
