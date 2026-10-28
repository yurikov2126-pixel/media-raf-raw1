#!/usr/bin/env python3
import importlib.util
import sqlite3
import tempfile
import unittest
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
                    "queuedLocal": 0, "failedSends": 0
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


if __name__ == "__main__":
    unittest.main()
