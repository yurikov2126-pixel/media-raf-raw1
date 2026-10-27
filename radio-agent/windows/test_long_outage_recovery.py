"""Safety regressions for multi-hour outages and operator ESP32 maintenance."""
import pathlib
import unittest
from unittest.mock import patch
from urllib.error import URLError
import esp32_local

class RecoveryContractTests(unittest.TestCase):
    def test_worker_waits_for_fresh_permission_instead_of_exiting_after_grace(self):
        source=(pathlib.Path(__file__).with_name('central_playout.py')).read_text(encoding='utf-8')
        self.assertIn('PLAYBACK_PERMISSION_EXPIRED_WAITING_FOR_NETWORK',source)
        self.assertIn('network_ok=False\n                PLAYBACK_STATE',source)
        self.assertIn('stop_vlc(primary)\n                    stop_vlc(fallback)',source)
        self.assertNotIn("if denied or now-last_authorized>args.offline_grace:",source)

    def test_esp32_restart_rejects_public_address(self):
        with self.assertRaises(ValueError):
            esp32_local.restart_esp32('8.8.8.8','x'*32)

    def test_esp32_restart_requires_secret(self):
        with self.assertRaises(ValueError):
            esp32_local.restart_esp32('192.168.1.10','short')

    def test_esp32_restart_reports_unreachable_device(self):
        with patch.object(esp32_local.urllib.request,'urlopen',side_effect=URLError('offline')):
            with self.assertRaises(URLError):
                esp32_local.restart_esp32('192.168.1.10','x'*32,timeout=0.1)

if __name__=='__main__':
    unittest.main()
