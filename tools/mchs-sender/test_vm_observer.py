#!/usr/bin/env python3
import importlib.util
import sqlite3
import tempfile
import unittest
from unittest.mock import patch
import json
from pathlib import Path

ROOT = Path(__file__).resolve().with_name("vm_observer.py")
spec = importlib.util.spec_from_file_location("mchs_vm_observer", ROOT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class TelemetryTests(unittest.TestCase):
    def test_empty_queue(self):
        with tempfile.TemporaryDirectory() as directory:
            db = module.state_db(Path(directory) / "queue.db")
            try:
                self.assertEqual(module.queue_telemetry(db), {
                    "queuedLocal": 0, "failedSends": 0, "retryPending": 0, "oldestPendingAt": None
                })
            finally:
                db.close()

    def test_pending_retries_and_last_ack(self):
        with tempfile.TemporaryDirectory() as directory:
            db = module.state_db(Path(directory) / "queue.db")
            try:
                db.executemany(
                    "INSERT INTO queue(event_id,payload_json,attempt,ack_at) VALUES (?,?,?,?)",
                    [("waiting", "{}", 3, None),
                     ("sent", "{}", 1, 1761652800)])
                db.commit()
                metrics = module.queue_telemetry(db)
                self.assertEqual(metrics["queuedLocal"], 1)
                self.assertEqual(metrics["failedSends"], 3)
                self.assertTrue(metrics["lastSentAt"].endswith("Z"))
            finally:
                db.close()


    def test_outage_retry_then_ack_after_reopen(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "queue.db"
            db = module.state_db(path)
            db.execute("INSERT INTO queue(event_id,payload_json) VALUES (?,?)",
                       ("test-event", json.dumps({"eventId": "test-event"})))
            db.commit()
            with patch.object(module, "post", side_effect=OSError("offline")), patch.object(module.time, "time", return_value=1000):
                module.drain(db, "dummy", "127.0.0.1")
            self.assertEqual(db.execute("SELECT attempt,next_retry,ack_at FROM queue").fetchone(), (1,1015,None))
            db.close()
            db = module.state_db(path)
            try:
                with patch.object(module, "post", return_value={"accepted":True,"eventId":"test-event","verified":False,"id":"server-1"}) as sent, patch.object(module.time, "time", return_value=1016):
                    module.drain(db,"dummy","127.0.0.1")
                sent.assert_called_once()
                self.assertEqual(db.execute("SELECT ack_id,ack_at FROM queue").fetchone(), ("server-1",1016))
                with patch.object(module, "post") as resent:
                    module.drain(db,"dummy","127.0.0.1")
                resent.assert_not_called()
            finally:
                db.close()

    def test_invalid_ack_keeps_pending_row(self):
        with tempfile.TemporaryDirectory() as directory:
            db = module.state_db(Path(directory) / "queue.db")
            try:
                db.execute("INSERT INTO queue(event_id,payload_json) VALUES (?,?)",("test-event","{}"))
                db.commit()
                with patch.object(module, "post", return_value={"accepted":True,"eventId":"wrong","verified":False,"id":"server-1"}), patch.object(module.time, "time", return_value=1000):
                    module.drain(db,"dummy","127.0.0.1")
                self.assertEqual(db.execute("SELECT attempt,ack_at FROM queue").fetchone(),(1,None))
            finally:
                db.close()

    def test_retry_backoff_waits_until_due(self):
        with tempfile.TemporaryDirectory() as directory:
            db = module.state_db(Path(directory) / "queue.db")
            try:
                db.execute("INSERT INTO queue(event_id,payload_json,next_retry) VALUES (?,?,?)",("test-event","{}",2000))
                db.commit()
                with patch.object(module, "post") as sent, patch.object(module.time, "time", return_value=1999):
                    module.drain(db,"dummy","127.0.0.1")
                sent.assert_not_called()
            finally:
                db.close()
    def test_retry_telemetry_and_clear_queue(self):
        with tempfile.TemporaryDirectory() as directory:
            db = module.state_db(Path(directory) / "queue.db")
            try:
                db.execute("INSERT INTO queue(event_id,payload_json,attempt,next_retry) VALUES (?,?,?,?)",
                           ("waiting", "{}", 2, 1800000000))
                db.commit()
                metrics = module.queue_telemetry(db)
                self.assertEqual(metrics["retryPending"], 1)
                self.assertEqual(metrics["queuedLocal"], 1)
                self.assertTrue(metrics["nextRetryAt"].endswith("Z"))
                db.execute("UPDATE queue SET ack_at=1800000001 WHERE event_id='waiting'")
                db.commit()
                cleared = module.queue_telemetry(db)
                self.assertEqual(cleared["retryPending"], 0)
                self.assertNotIn("nextRetryAt", cleared)
            finally:
                db.close()

    def test_oldest_pending_time_stays_stable_across_snapshot_retries(self):
        with tempfile.TemporaryDirectory() as directory:
            db = module.state_db(Path(directory) / "queue.db")
            try:
                db.execute("INSERT INTO queue(event_id,payload_json,first_queued_at) VALUES (?,?,?)",
                           ("new", "{}", 1000))
                db.commit()
                first = module.queue_telemetry(db)["oldestPendingAt"]
                db.execute("UPDATE queue SET attempt=attempt+1,next_retry=2000 WHERE event_id='new'")
                db.commit()
                self.assertEqual(first, module.queue_telemetry(db)["oldestPendingAt"])
                db.execute("UPDATE queue SET ack_at=2001 WHERE event_id='new'")
                db.commit()
                self.assertIsNone(module.queue_telemetry(db)["oldestPendingAt"])
            finally:
                db.close()

    def test_legacy_pending_row_has_unknown_oldest_time(self):
        with tempfile.TemporaryDirectory() as directory:
            db = module.state_db(Path(directory) / "queue.db")
            try:
                db.execute("INSERT INTO queue(event_id,payload_json) VALUES (?,?)", ("legacy", "{}"))
                db.commit()
                self.assertNotIn("oldestPendingAt", module.queue_telemetry(db))
            finally:
                db.close()


if __name__ == "__main__":
    unittest.main()
