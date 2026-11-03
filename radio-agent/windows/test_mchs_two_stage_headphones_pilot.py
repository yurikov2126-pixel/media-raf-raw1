import tempfile
import unittest
import wave
from pathlib import Path

from mchs_two_stage_headphones_pilot import (
    run_isolated_two_stage_pilot,verify_local_training_wav)


class FakeProcess:
    def __init__(self,exit_code=None):
        self.returncode=exit_code
    def poll(self):return self.returncode
    def terminate(self):self.returncode=-15
    def wait(self,timeout=None):return self.returncode
    def kill(self):self.returncode=-9


def make_wav(path,sample):
    with wave.open(str(path),'wb') as out:
        out.setnchannels(2)
        out.setsampwidth(2)
        out.setframerate(48000)
        out.writeframes(sample.to_bytes(2,'little',signed=True)*2*2400)


class TwoStageHeadphonesTests(unittest.TestCase):
    def setup_files(self,td):
        base=Path(td)
        vlc=base/'vlc.exe';vlc.write_bytes(b'exe')
        music=base/'music.mp3';music.write_bytes(b'long-music')
        danger=base/'danger.wav';make_wav(danger,200)
        clear=base/'clear.wav';make_wav(clear,300)
        return vlc,music,danger,clear

    def test_real_local_vlc_sequence_all_repeats_and_both_returns(self):
        with tempfile.TemporaryDirectory() as td:
            vlc,music,danger,clear=self.setup_files(td)
            launched=[]
            def launch(file):
                name=Path(file).name
                proc=FakeProcess(0 if name.endswith('.wav') else None)
                launched.append((name,proc))
                return proc
            log=[]
            result=run_isolated_two_stage_pilot(
                vlc=vlc,program_file=music,danger_wav=danger,all_clear_wav=clear,
                danger_repeats=4,launch=launch,ask=lambda _: 'ISOLATED',
                output=lambda *items:log.append(items),sleep=lambda _:None,
                between_s=0,final_listen_s=0)
            self.assertTrue(result['ok'])
            self.assertEqual([x[0] for x in launched],
                ['music.mp3']+['danger.wav']*4+
                ['music.mp3','clear.wav','music.mp3'])
            self.assertEqual([x['stage'] for x in result['stages']],['DANGER','ALL_CLEAR'])
            self.assertEqual([x['repeats'] for x in result['stages']],[4,1])
            self.assertTrue(all(x['natural'] and x['programRestored'] for x in result['stages']))
            self.assertTrue(all(proc.poll() is not None for _,proc in launched))
            self.assertFalse(result['publicPlaybackAuthorized'])
            self.assertFalse(result['physicalPAConfirmed'])

    def test_danger_failure_prevents_all_clear_and_restores_program(self):
        with tempfile.TemporaryDirectory() as td:
            vlc,music,danger,clear=self.setup_files(td)
            launched=[]
            def launch(file):
                name=Path(file).name
                launched.append(name)
                return FakeProcess(1 if name=='danger.wav' else None)
            result=run_isolated_two_stage_pilot(
                vlc=vlc,program_file=music,danger_wav=danger,all_clear_wav=clear,
                launch=launch,ask=lambda _: 'ISOLATED',sleep=lambda _:None,
                between_s=0,final_listen_s=0)
            self.assertFalse(result['ok'])
            self.assertEqual(len(result['stages']),1)
            self.assertEqual(launched,['music.mp3','danger.wav','music.mp3'])
            self.assertTrue(result['stages'][0]['programRestored'])

    def test_isolation_rejection_never_launches_audio(self):
        with tempfile.TemporaryDirectory() as td:
            vlc,music,danger,clear=self.setup_files(td)
            with self.assertRaises(PermissionError):
                run_isolated_two_stage_pilot(
                    vlc=vlc,program_file=music,danger_wav=danger,all_clear_wav=clear,
                    ask=lambda _: 'NO',launch=lambda _: self.fail('VLC SPAWNED'))

    def test_identical_audio_and_invalid_repeat_counts_rejected_before_launch(self):
        with tempfile.TemporaryDirectory() as td:
            vlc,music,danger,clear=self.setup_files(td)
            for change in (
                {'all_clear_wav':danger},
                {'danger_repeats':0},
                {'danger_repeats':6},
            ):
                args=dict(vlc=vlc,program_file=music,danger_wav=danger,
                          all_clear_wav=clear,ask=lambda _:self.fail('ASKED'),
                          launch=lambda _:self.fail('SPAWNED'))
                args.update(change)
                with self.assertRaises(ValueError):
                    run_isolated_two_stage_pilot(**args)

    def test_invalid_wav_content_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            file=Path(td)/'bad.wav'
            file.write_bytes(b'not a wave')
            with self.assertRaises((wave.Error,ValueError)):
                verify_local_training_wav(file)
            valid=Path(td)/'valid.wav'
            make_wav(valid,200)
            result=verify_local_training_wav(valid)
            self.assertGreater(result['duration'],0)
            self.assertEqual(len(result['sha256']),64)

if __name__=='__main__':
    unittest.main()
