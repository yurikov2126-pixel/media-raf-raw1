import tempfile
import unittest
from pathlib import Path
from release_version import app_version

class ReleaseVersionTests(unittest.TestCase):
    def test_real_gui_version(self):
        self.assertRegex(app_version(),r"^[0-9]+[.][0-9]+[.][0-9]+$")
    def test_rejects_invalid_version(self):
        with tempfile.TemporaryDirectory() as tmp:
            file=Path(tmp)/"gui.py"
            file.write_text("AGENT_VERSION = '0.3.5-beta'",encoding="utf-8")
            with self.assertRaises(ValueError):app_version(file)
    def test_requires_literal_assignment(self):
        with tempfile.TemporaryDirectory() as tmp:
            file=Path(tmp)/"gui.py"
            file.write_text("AGENT_VERSION = get_version()",encoding="utf-8")
            with self.assertRaises(ValueError):app_version(file)
if __name__=="__main__":unittest.main()
