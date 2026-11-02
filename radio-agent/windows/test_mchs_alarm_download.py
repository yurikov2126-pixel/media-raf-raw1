import hashlib
import io
import tempfile
import unittest
from pathlib import Path
from mchs_alarm_download import cache_verified_alarm

class _Response(io.BytesIO):
    def __enter__(self):return self
    def __exit__(self,*args):self.close()

class MchsAlarmDownloadTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)
        self.data=b'only a harmless audio fixture'
        self.cmd={'action':'START','eventId':'evt1','eventType':'MISSILE_DANGER',
                  'assetId':'alarm1','repeats':2,
                  'sha256':hashlib.sha256(self.data).hexdigest()}
    def test_authenticated_atomic_download(self):
        seen=[]
        def opener(req,timeout):
            seen.append((req.full_url,req.get_header('Authorization')))
            return _Response(self.data)
        path,err=cache_verified_alarm(self.cmd,self.root,'https://example.test','token',
                                      opener=opener)
        self.assertIsNone(err)
        self.assertEqual(path.read_bytes(),self.data)
        self.assertEqual(seen[0],('https://example.test/api/radio-agent/agent/mchs-alarm-assets/alarm1','Bearer token'))
        self.assertFalse((self.root/'alarm1.alarm.part').exists())
    def test_corrupt_file_not_committed(self):
        path,err=cache_verified_alarm(self.cmd,self.root,'https://example.test','token',
                                      opener=lambda *a,**kw:_Response(b'wrong'))
        self.assertIsNone(path)
        self.assertEqual(err,'ASSET_DIGEST_MISMATCH')
        self.assertFalse((self.root/'alarm1.alarm').exists())
    def test_reject_http_and_path_traversal(self):
        self.assertEqual(cache_verified_alarm(self.cmd,self.root,'http://example.test','token')[1],'HTTPS_REQUIRED')
        self.assertEqual(cache_verified_alarm({**self.cmd,'assetId':'../escape'},self.root,
                                              'https://example.test','token')[1],'INVALID_ASSET_ID')

if __name__=='__main__':unittest.main()
