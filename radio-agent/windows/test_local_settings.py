import tempfile
import unittest
from local_settings import load_settings,save_settings

class SettingsTest(unittest.TestCase):
    def test_persists_only_nonsecret_preferences(self):
        with tempfile.TemporaryDirectory() as temp:
            save_settings(temp,{"server":"https://mediarafraw.ru","vlc":"vlc.exe","esp32_ip":"10.0.1.58","esp32_secret":"private","token":"rr_private"})
            content=(__import__('pathlib').Path(temp)/"settings.json").read_text()
            self.assertNotIn("private",content)
            self.assertEqual(load_settings(temp)["esp32_ip"],"10.0.1.58")
if __name__=="__main__":unittest.main()
