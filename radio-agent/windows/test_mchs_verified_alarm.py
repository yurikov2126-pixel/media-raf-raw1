import hashlib
import tempfile
import unittest
from pathlib import Path
from mchs_verified_alarm import verify_cached_alarm

class VerifiedAlarmTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        self.data=b'isolated sample fixture'
        (self.root/'alarm1.alarm').write_bytes(self.data)
        self.command=dict(action='START',eventId='event1',
            assetId='alarm1',eventType='MISSILE_DANGER',repeats=2,
            sha256=hashlib.sha256(self.data).hexdigest())
    def test_exact_file(self):
        path,error=verify_cached_alarm(self.command,self.root)
        self.assertEqual(path, (self.root/'alarm1.alarm').resolve())
        self.assertIsNone(error)
    def test_mutated_file_denied(self):
        (self.root/'alarm1.alarm').write_bytes(b'other')
        self.assertEqual(verify_cached_alarm(self.command,self.root)[1],'ASSET_DIGEST_MISMATCH')
    def test_paths_and_wrong_repeat_denied(self):
        self.assertEqual(verify_cached_alarm({**self.command,'assetId':'../secret'},self.root)[1],'INVALID_ASSET_ID')
        self.assertEqual(verify_cached_alarm({**self.command,'eventType':'MISSILE_ALL_CLEAR'},self.root)[1],'INVALID_ALL_CLEAR_REPEATS')
    def test_no_unchecked_url_or_missing_asset(self):
        self.assertEqual(verify_cached_alarm({**self.command,'assetId':'missing'},self.root)[1],'ASSET_UNAVAILABLE')

if __name__=='__main__':
    unittest.main()
