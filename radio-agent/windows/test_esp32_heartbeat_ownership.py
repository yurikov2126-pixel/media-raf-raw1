import unittest
from esp32_heartbeat_ownership import gui_owns_esp32_heartbeat

class GuiEsp32HeartbeatOwnershipTests(unittest.TestCase):
    def test_idle_gui_owns_heartbeat(self):
        self.assertTrue(gui_owns_esp32_heartbeat(worker_alive=False,
                                                 isolated_mode=False))

    def test_normal_running_agent_owns_its_heartbeat_not_gui(self):
        self.assertFalse(gui_owns_esp32_heartbeat(worker_alive=True,
                                                  isolated_mode=False))

    def test_isolated_mchs_running_gui_keeps_esp32_watchdog_fresh(self):
        self.assertTrue(gui_owns_esp32_heartbeat(worker_alive=True,
                                                 isolated_mode=True))

    def test_isolated_gui_without_worker_still_owns_heartbeat(self):
        self.assertTrue(gui_owns_esp32_heartbeat(worker_alive=False,
                                                 isolated_mode=True))

if __name__=='__main__':
    unittest.main()
