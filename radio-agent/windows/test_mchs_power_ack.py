import unittest
from mchs_power_ack import require_power_command_ack


class MainStationPowerAcknowledgment(unittest.TestCase):
    def test_must_match_requested_gpio_command(self):
        self.assertEqual(require_power_command_ack(
            {"ok": True, "amplifierPower": "ON_COMMANDED"}, True), "ON_COMMANDED")
        self.assertEqual(require_power_command_ack(
            {"ok": True, "amplifierPower": "OFF_COMMANDED"}, False), "OFF_COMMANDED")

    def test_refuse_generic_success_when_gpio_state_disagrees(self):
        for requested,actual in (
            (True,"OFF_COMMANDED"),(False,"ON_COMMANDED"),
            (True,None),(True,"UNCONTROLLED"),
        ):
            with self.subTest(requested=requested,actual=actual):
                with self.assertRaisesRegex(RuntimeError,"ESP32_POWER_STATE_MISMATCH"):
                    require_power_command_ack({"ok":True,"amplifierPower":actual},requested)

    def test_refuse_incomplete_and_invalid_response(self):
        for data in (None,{},{"ok":False,"amplifierPower":"ON_COMMANDED"}):
            with self.assertRaises(RuntimeError):
                require_power_command_ack(data,True)
        with self.assertRaises(ValueError):
            require_power_command_ack({"ok":True,"amplifierPower":"ON_COMMANDED"},1)


if __name__ == "__main__":
    unittest.main()
