"""GUI-integrated isolated Android event audio preflight (no Tk display needed)."""
import tempfile
import unittest
import wave
from pathlib import Path

from mchs_gui_isolated_session import prepare_isolated_gui_session

TOKEN = 'rr_' + 'a' * 64

class IntegratedMchsGuiStartTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        base = Path(self.temp.name)
        self.vlc = base / 'vlc.exe'
        self.vlc.write_bytes(b'MZ-example')
        self.danger = base / 'danger.wav'
        self.clear = base / 'clear.wav'
        for path, byte in ((self.danger,b'\x01\x02'),(self.clear,b'\x03\x04')):
            with wave.open(str(path),'wb') as out:
                out.setnchannels(2)
                out.setsampwidth(2)
                out.setframerate(48000)
                out.writeframes(byte * 9600)
        self.settings = {
            'server':'https://mediarafraw.ru', 'token':TOKEN,
            'vlc':str(self.vlc), 'danger_wav':str(self.danger),
            'all_clear_wav':str(self.clear), 'power_armed':False,
            'operator_confirmation':'ISOLATED'
        }

    def test_gui_session_matches_previous_cli_isolated_mode(self):
        prepared=prepare_isolated_gui_session(**self.settings)
        self.assertTrue(prepared['isolated_event_audio'])
        self.assertFalse(prepared['isolated_event_admission'])
        self.assertEqual(prepared['esp32_host'],'')
        self.assertEqual(prepared['esp32_secret'],'')
        self.assertIsNone(prepared['isolated_cycle_assets'])
        self.assertEqual(set(prepared['isolated_event_assets']),
                         {'MISSILE_DANGER','MISSILE_ALL_CLEAR'})
        self.assertEqual(len(prepared['isolated_event_assets']['MISSILE_DANGER']['sha256']),64)
        self.assertNotEqual(prepared['isolated_event_assets']['MISSILE_DANGER']['sha256'],
                            prepared['isolated_event_assets']['MISSILE_ALL_CLEAR']['sha256'])

    def test_no_operator_consent_or_armed_power_cannot_start(self):
        for changes,reason in [
            ({'operator_confirmation':''},PermissionError),
            ({'operator_confirmation':'isolated'},PermissionError),
            ({'power_armed':True},ValueError),
        ]:
            with self.subTest(changes=changes):
                with self.assertRaises(reason):
                    prepare_isolated_gui_session(**{**self.settings,**changes})

    def test_server_token_and_vlc_are_validated(self):
        for changes in [
            {'server':'http://mediarafraw.ru'}, {'token':'bad'},
            {'vlc':str(Path(self.temp.name)/'missing.exe')}
        ]:
            with self.subTest(changes=changes),self.assertRaises(ValueError):
                prepare_isolated_gui_session(**{**self.settings,**changes})

    def test_two_distinct_valid_local_wavs_are_required(self):
        with self.assertRaises(ValueError):
            prepare_isolated_gui_session(**{**self.settings,
                                            'all_clear_wav':str(self.danger)})
        with self.assertRaises(ValueError):
            prepare_isolated_gui_session(**{**self.settings,
                                            'danger_wav':str(Path(self.temp.name)/'missing.wav')})

if __name__ == '__main__':
    unittest.main()
