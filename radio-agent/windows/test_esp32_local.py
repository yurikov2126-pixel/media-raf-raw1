import unittest
from unittest.mock import patch
from esp32_local import send_heartbeat

class TestLocalEsp32(unittest.TestCase):
    def test_reject_public_host(self):
        with self.assertRaises(ValueError):
            send_heartbeat("8.8.8.8", "x"*32,"CENTRAL",True,True)
    def test_secret_required(self):
        with self.assertRaises(ValueError):
            send_heartbeat("192.168.1.10", "short","CENTRAL",True,True)
    def test_mode_validated(self):
        with self.assertRaises(ValueError):
            send_heartbeat("192.168.1.10", "x"*32,"UNKNOWN",True,True)
if __name__=="__main__":
    unittest.main()
