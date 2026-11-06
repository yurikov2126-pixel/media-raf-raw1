"""Guard production radio GUI from reintroducing obsolete MCHS test toggles."""
import ast
from pathlib import Path
import unittest

GUI = Path(__file__).with_name("gui.py")


class ProductionGuiContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = GUI.read_text(encoding="utf-8")
        cls.tree = ast.parse(cls.source)

    def test_gui_version(self):
        from release_version import app_version
        self.assertEqual(app_version(GUI), "0.5.22")

    def test_no_obsolete_mchs_test_widgets(self):
        for label in (
            "Принимать Android-события изолированно",
            "Отдельное аппаратное испытание GPIO13",
            "АВТОМАТИЧЕСКОЕ ОПОВЕЩЕНИЕ МЧС · ТОЛЬКО НАУШНИКИ",
            "Тест в наушниках · усилитель не включается",
            "Учебный звук МЧС (кабель PA отключён)",
            "Разрешить ОДНО учебное событие МЧС",
            "Проверить реле: ON до 8 секунд",
            "СТОП МЧС / вернуть радио",
            "Выбрать учебный PCM WAV",
        ):
            self.assertNotIn(label, self.source, label)

    def test_production_start_only(self):
        app = next(x for x in self.tree.body
                   if isinstance(x, ast.ClassDef) and x.name == "RadioAgentApp")
        start = next(x for x in app.body
                     if isinstance(x, ast.FunctionDef) and x.name == "start")
        code = ast.get_source_segment(self.source, start)
        self.assertIn("args = Config(", code)
        self.assertIn("STOP.clear()", code)
        self.assertNotIn("prepare_isolated_gui_session", code)
        self.assertNotIn("relay_requested", code)
        self.assertNotIn("isolated = ", code)
        self.assertNotIn("self.agreed", code)

    def test_hardware_guard_and_update_are_retained(self):
        self.assertIn("authorized_mchs_station_power", self.source)
        self.assertIn("authorized_manual_power", self.source)
        self.assertIn("self.power_arm.get()", self.source)
        self.assertIn("signed_power(host,secret,permit", self.source)
        self.assertIn("check_latest(AGENT_VERSION)", self.source)
        self.assertIn("save_credentials(", self.source)


if __name__ == "__main__":
    unittest.main()
