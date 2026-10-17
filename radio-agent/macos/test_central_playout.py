"""Pure timeline/cache checks for opt-in Mac fallback (no audio devices required)."""
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from central_playout import cached_file, local_cursor


class FallbackTests(unittest.TestCase):
    def setUp(self):
        self.snapshot = {"slots": [{
            "id": "s1", "startAt": "2026-10-18T00:00:00Z",
            "endAt": "2026-10-18T00:01:00Z", "tracks": [
                {"id": "t1", "durationMs": 20000},
                {"id": "t2", "durationMs": 30000},
            ]
        }]}

    def test_late_join_uses_second_track_offset(self):
        # Check against explicit timestamp rather than local timezone.
        from datetime import datetime, timezone
        now = datetime(2026, 10, 18, 0, 0, 35, tzinfo=timezone.utc).timestamp()
        track, offset, remaining = local_cursor(self.snapshot, now)
        self.assertEqual(track["id"], "t2")
        self.assertAlmostEqual(offset, 15)
        self.assertAlmostEqual(remaining, 15)

    def test_unfilled_tail_never_loops(self):
        from datetime import datetime, timezone
        now = datetime(2026, 10, 18, 0, 0, 55, tzinfo=timezone.utc).timestamp()
        self.assertIsNone(local_cursor(self.snapshot, now))

    def test_cache_integrity(self):
        with tempfile.TemporaryDirectory() as dirname:
            cache = Path(dirname)
            content = b"trusted audio bytes"
            file = cache / "t1.audio"
            file.write_bytes(content)
            track = {"id": "t1", "sha256": hashlib.sha256(content).hexdigest()}
            self.assertEqual(cached_file(cache, track), file)
            file.write_bytes(b"corrupted")
            self.assertIsNone(cached_file(cache, track))


if __name__ == "__main__":
    unittest.main()
