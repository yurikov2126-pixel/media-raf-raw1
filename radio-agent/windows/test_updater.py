import unittest
from updater import select_update, version_tuple

class UpdateTests(unittest.TestCase):
    def test_versions(self):
        self.assertEqual(version_tuple("v0.2"), (0,2,0))
        self.assertGreater(version_tuple("0.10.0"), version_tuple("0.9.9"))
        with self.assertRaises(ValueError):
            version_tuple("1.2.3-beta")
    def test_only_versioned_radio_release_with_digest(self):
        asset = {"name":"MediaRafRaw-RadioAgent.exe",
                 "browser_download_url":"https://github.com/yurikov2126-pixel/media-raf-raw1/releases/download/radio-agent-v0.3.0/MediaRafRaw-RadioAgent.exe",
                 "digest":"sha256:"+"a"*64}
        release={"tag_name":"radio-agent-v0.3.0","draft":False,"prerelease":False,"assets":[asset]}
        self.assertEqual(select_update(release,"0.2.0")["version"],"0.3.0")
        self.assertIsNone(select_update(release,"0.3.0"))
        self.assertIsNone(select_update({**release,"prerelease":True},"0.2.0"))
        self.assertIsNone(select_update({**release,"tag_name":"site-v0.3.0"},"0.2.0"))
        self.assertIsNone(select_update({**release,"assets":[{**asset,"digest":None}]},"0.2.0"))
if __name__=="__main__":unittest.main()
