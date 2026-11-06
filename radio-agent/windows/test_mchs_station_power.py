import unittest
from mchs_station_power import authorized_mchs_station_power
from power_policy import allowed_power


class MainStationPowerTests(unittest.TestCase):
    def setUp(self):
        self.intent = {
            'permit': True,
            'policyMode': 'MCHS',
            'reason': 'Основное оповещение МЧС',
            'emergencyOff': False,
            'hardwareExpected': 'POWER_CONTROL_V1',
            'esp32Ip': '192.168.10.32',
            'mchsEventId': 'real-station-missile-123',
        }

    def approved(self, intent=None, armed=True, isolated=False):
        return authorized_mchs_station_power(
            self.intent if intent is None else intent,
            esp32_ip='192.168.10.32', hardware_armed=armed,
            isolated=isolated)

    def test_real_main_station_alarm_is_independent_of_normal_music(self):
        self.assertTrue(self.approved())
        self.assertTrue(allowed_power(
            True, False, True, 0, 100,
            manual_override=self.approved())[0])

    def test_an_explicit_server_off_wins(self):
        self.assertFalse(self.approved({**self.intent, 'permit': False}))
        self.assertFalse(allowed_power(
            False, False, True, 0, 100,
            manual_override=True)[0])

    def test_never_bypass_emergency_off_or_operator_disarm(self):
        self.assertFalse(self.approved({**self.intent, 'emergencyOff': True}))
        self.assertFalse(self.approved(armed=False))
        self.assertFalse(self.approved(isolated=True))

    def test_invalid_and_unbound_alerts_cannot_power_gpio(self):
        for name in ('mchsEventId', 'reason', 'permit', 'policyMode',
                     'esp32Ip', 'emergencyOff', 'hardwareExpected'):
            incomplete = {k: v for k, v in self.intent.items() if k != name}
            self.assertFalse(self.approved(incomplete), name)
        self.assertFalse(self.approved({**self.intent, 'policyMode': 'AUTO'}))
        self.assertFalse(self.approved({**self.intent, 'esp32Ip': '192.168.10.99'}))
        self.assertFalse(self.approved({**self.intent, 'mchsEventId': ''}))

    def test_no_server_answer_means_no_new_authorization(self):
        self.assertFalse(authorized_mchs_station_power(
            None, esp32_ip='192.168.10.32', hardware_armed=True))


if __name__ == '__main__':
    unittest.main()
