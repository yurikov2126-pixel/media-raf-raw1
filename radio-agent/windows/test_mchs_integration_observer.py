import unittest
from unittest.mock import patch
import central_playout


class MchsObserverTests(unittest.TestCase):
    @patch("central_playout.urlopen")
    def test_observer_uses_authenticated_read_only_get(self, mock_open):
        mock_open.return_value.__enter__.return_value.read.return_value = b'{"mode":"OBSERVE_ONLY","revision":2}'
        result = central_playout.read_mchs_observer("https://example.test", "rr_test")
        self.assertEqual(result["revision"], 2)
        request = mock_open.call_args.args[0]
        self.assertEqual(request.get_method(), "GET")
        self.assertTrue(request.full_url.endswith("/api/radio-agent/agent/mchs-integration-observe"))
        self.assertEqual(request.headers["Authorization"], "Bearer rr_test")


if __name__ == "__main__":
    unittest.main()
