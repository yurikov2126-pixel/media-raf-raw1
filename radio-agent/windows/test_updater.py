import unittest
from unittest.mock import patch, MagicMock
from urllib.error import HTTPError, URLError
import socket
from updater import check_latest, UpdateCheckError
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
    def test_github_offline_reports_network(self):
        with patch("updater.urlopen",side_effect=URLError("offline")):
            with self.assertRaisesRegex(UpdateCheckError,"api.github.com"):
                check_latest("0.2.0")

    def test_dns_failure_is_specific_and_retried_once(self):
        with patch("updater.time.sleep"), patch("updater.urlopen",side_effect=URLError(socket.gaierror(11001,"host not found"))) as opener:
            with self.assertRaisesRegex(UpdateCheckError,"DNS"):
                check_latest("0.5.7")
            self.assertEqual(opener.call_count,2)

    def test_transient_failure_recovers(self):
        from io import BytesIO
        with patch("updater.time.sleep"), patch("updater.urlopen",side_effect=[
            URLError(socket.timeout("timed out")), BytesIO(b"[]")]) as opener:
            self.assertIsNone(check_latest("0.5.7"))
            self.assertEqual(opener.call_count,2)

    def test_tls_failure_is_specific(self):
        import ssl
        with patch("updater.time.sleep"), patch("updater.urlopen",side_effect=URLError(ssl.SSLError("tls"))):
            with self.assertRaisesRegex(UpdateCheckError,"TLS"):
                check_latest("0.5.7")

    def test_rate_limit_is_readable(self):
        with patch("updater.urlopen",side_effect=HTTPError("https://api.github.com",403,"limit",{},None)):
            with self.assertRaisesRegex(UpdateCheckError,"403"):
                check_latest("0.2.0")

    def test_empty_release_list_means_no_new_release(self):
        from unittest.mock import MagicMock
        from io import BytesIO
        with patch("updater.urlopen",return_value=MagicMock(__enter__=lambda _s:BytesIO(b"[]"),
                   __exit__=lambda *_:None)):
            self.assertIsNone(check_latest("0.2.0"))

if __name__=="__main__":unittest.main()
