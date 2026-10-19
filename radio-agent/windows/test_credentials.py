import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from credentials import save_credentials,load_credentials,clear_credentials

class CredentialStoreTests(unittest.TestCase):
    def test_secret_never_written_in_plaintext(self):
        # Simulate reversible OS encryption without requiring DPAPI in CI.
        with tempfile.TemporaryDirectory() as directory:
            def crypt(data,encrypt):
                return b"ENCRYPTED:" + data[::-1] if encrypt else data[len(b"ENCRYPTED:"):][::-1]
            with patch("credentials._crypt",side_effect=crypt):
                save_credentials(directory,"rr_sensitive","device_pair_sensitive")
                raw=Path(directory,"credentials.dpapi").read_bytes()
                self.assertNotIn(b"rr_sensitive",raw)
                self.assertNotIn(b"device_pair_sensitive",raw)
                self.assertEqual(load_credentials(directory)["token"],"rr_sensitive")
                clear_credentials(directory)
                self.assertEqual(load_credentials(directory),{})
if __name__=="__main__":
    unittest.main()
