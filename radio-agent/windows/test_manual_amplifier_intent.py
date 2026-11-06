import unittest
from manual_amplifier_intent import authorized_manual_power
from power_policy import allowed_power


class ManualAmplifierIntentTests(unittest.TestCase):
    def setUp(self):
        self.intent = {
            "permit": True,
            "policyMode": "MANUAL",
            "reason": "Ручной режим",
            "emergencyOff": False,
            "hardwareExpected": "POWER_CONTROL_V1",
            "esp32Ip": "192.168.10.32",
        }

    def allowed(self, intent=None, armed=True, isolated=False):
        return authorized_manual_power(
            self.intent if intent is None else intent,
            esp32_ip="192.168.10.32", hardware_armed=armed,
            isolated=isolated)

    def test_authorized_manual_power_without_audio(self):
        self.assertTrue(self.allowed())
        self.assertEqual(
            allowed_power(True, False, True, 0, 100,
                          manual_override=self.allowed()),
            (True, "SERVER_AUTHORIZED_MANUAL"))

    def test_manual_off_rejected_by_server(self):
        self.assertFalse(self.allowed({**self.intent, "permit": False}))
        self.assertEqual(allowed_power(False, False, True, 0, 100,
                            manual_override=False),
                         (False, "SERVER_OR_NETWORK_OFF"))

    def test_emergency_off_is_not_bypassed(self):
        self.assertFalse(self.allowed({**self.intent, "emergencyOff": True}))

    def test_only_explicit_manual_mode_can_skip_audio_gate(self):
        self.assertFalse(self.allowed({**self.intent, "policyMode": "AUTO"}))
        self.assertFalse(self.allowed({**self.intent, "reason": "Нет активной трансляции"}))
        self.assertFalse(self.allowed({**self.intent, "reason": "Ручное управление"}))
        self.assertEqual(
            allowed_power(True, False, False, 0, 100, manual_override=False),
            (False, "LOCAL_STOP"))

    def test_disarmed_agent_cannot_power_on(self):
        self.assertFalse(self.allowed(armed=False))
        self.assertFalse(self.allowed(isolated=True))

    def test_mismatched_controller_and_firmware_are_rejected(self):
        self.assertFalse(self.allowed({**self.intent, "esp32Ip": "192.168.10.33"}))
        self.assertFalse(self.allowed({**self.intent, "hardwareExpected": "SAFE_PILOT"}))

    def test_network_failure_or_missing_data_cannot_authorize_manual(self):
        self.assertFalse(authorized_manual_power(
            None, esp32_ip="192.168.10.32", hardware_armed=True))
        for missing in self.intent:
            incomplete = {k: v for k, v in self.intent.items() if k != missing}
            self.assertFalse(self.allowed(incomplete), f"required: {missing}")


if __name__ == "__main__":
    unittest.main()
