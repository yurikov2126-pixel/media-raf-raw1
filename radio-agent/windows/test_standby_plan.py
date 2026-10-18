import hashlib
import tempfile
import unittest
from pathlib import Path
from standby_plan import standby_selection

class StandbyPlanTest(unittest.TestCase):
    def test_autodj_from_verified_cache(self):
        with tempfile.TemporaryDirectory() as root:
            cache=Path(root)
            data=b'example-track'
            (cache/'track1.audio').write_bytes(data)
            track={'id':'track1','durationMs':60000,'sha256':hashlib.sha256(data).hexdigest()}
            snapshot={'slots':[],'autoDj':{'enabled':True,'tracks':[track]}}
            self.assertEqual(standby_selection(snapshot,cache,when=12.0)['source'],'AUTO_DJ')
            (cache/'track1.audio').write_bytes(b'corrupted')
            self.assertIsNone(standby_selection(snapshot,cache,when=12.0))
    def test_disabled_is_silent(self):
        self.assertIsNone(standby_selection({'slots':[],'autoDj':{'enabled':False,'tracks':[]}},Path('.'),when=0))
if __name__=='__main__': unittest.main()
