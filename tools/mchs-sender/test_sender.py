import unittest
from datetime import datetime, timezone
from mchs_sender import parse

class ParseTests(unittest.TestCase):
    def test_valid(self):
        line = '{"event":"posted","package":"io.citizens.security","key":"test-key",' + \
               '"postTime":1793000000000,"channel":"emercom_channel",' + \
               '"title":"Тестовый заголовок","text":"Тест"}'
        parsed = parse(line)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["channelId"], "emercom_channel")
        self.assertEqual(len(parsed["eventId"]), 64)
        self.assertEqual(parse(line)["eventId"], parsed["eventId"])
    def test_foreign_app(self):
        self.assertIsNone(parse('{"event":"posted","package":"com.android.shell","key":"1","postTime":1,"title":"x"}'))
    def test_removed_event(self):
        self.assertIsNone(parse('{"event":"removed","package":"io.citizens.security","key":"1","postTime":1}'))
    def test_non_json(self):
        self.assertIsNone(parse("LISTENER_CONNECTED TEST_MODE=true"))

if __name__ == "__main__":
    unittest.main()
