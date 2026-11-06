import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from mchs_power_evidence import read_power_evidence


class TestPowerEvidence(unittest.TestCase):
    def test_only_sanitized_events_and_no_secrets(self):
        now=datetime(2026,11,6,8,0,0,tzinfo=timezone.utc)
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/"power-diagnostics.log"
            records=[
                '2026-11-06 07:59:59,000 INTENT_RESPONSE '+json.dumps({
                    "permit": True,"reason":"INTENT_ALLOWED",
                    "token":"rr_should_never_send","url":"https://example.test/secret"}),
                '2026-11-06 07:59:59,100 POWER_ERROR '+json.dumps({
                    "httpStatus":503,"errorType":"ConnectionResetError",
                    "headers":{"Authorization":"Bearer secret"},"reason":"BAD TOKEN"}),
                '2026-11-06 07:59:59,300 USER_LOGIN {"secret":"abc"}',
            ]
            path.write_text("\n".join(records)+"\n",encoding="utf-8")
            result=read_power_evidence(path,now=now)
            self.assertEqual(len(result),2)
            self.assertEqual(result[0]["kind"],"INTENT_RESPONSE")
            self.assertEqual(result[0]["reason"],"INTENT_ALLOWED")
            self.assertEqual(result[1]["httpStatus"],503)
            serialized=json.dumps(result)
            self.assertNotIn("secret",serialized)
            self.assertNotIn("Authorization",serialized)
            self.assertNotIn("BAD TOKEN",serialized)

    def test_missing_file_and_old_events(self):
        now=datetime(2026,11,6,8,0,0,tzinfo=timezone.utc)
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/"power-diagnostics.log"
            self.assertEqual(read_power_evidence(path,now=now),[])
            path.write_text('2026-11-06 07:45:00,000 POWER_COMMAND {"permit": true}\n')
            self.assertEqual(read_power_evidence(path,now=now),[])

    def test_deduplication_identifier_is_stable(self):
        now=datetime(2026,11,6,8,0,0,tzinfo=timezone.utc)
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/"power-diagnostics.log"
            path.write_text('2026-11-06 07:59:58,000 RELAY_TRANSITION {"transition":"OFF_SERVER_DENIED"}\n')
            first=read_power_evidence(path,now=now)
            self.assertEqual(first,read_power_evidence(path,now=now))
            self.assertEqual(len(first[0]["id"]),24)


if __name__=="__main__":
    unittest.main()
