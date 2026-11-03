import unittest
from mchs_local_handover import run_isolated_handover as run

def completed(n):
    return dict(state='COMPLETED',naturalCompletion=True,
                completedRepeats=n,expectedRepeats=n,
                processRunning=False,failureReason=None)

class HandoverTests(unittest.TestCase):
    def fixture(self,**overrides):
        events=[]
        args=dict(is_isolated=True,
          pause_program=lambda:events.append('pause') or True,
          play_training=lambda n:events.append('alarm') or completed(n),
          resume_program=lambda:events.append('resume') or True,
          confirm_restored=lambda:events.append('confirm') or True,
          repeats=4)
        args.update(overrides)
        return events,args

    def test_successful_local_handover_natural_completion(self):
        events,args=self.fixture()
        result=run(**args)
        self.assertTrue(result.ok)
        self.assertTrue(result.alarm_natural_completion)
        self.assertTrue(result.program_restored)
        self.assertEqual(events,['pause','alarm','resume','confirm'])

    def test_never_play_without_physical_isolation(self):
        events,args=self.fixture(is_isolated=False)
        result=run(**args)
        self.assertFalse(result.ok)
        self.assertEqual(result.reason,'PHYSICAL_ISOLATION_REQUIRED')
        self.assertEqual(events,[])

    def test_never_play_when_pause_unconfirmed(self):
        events,args=self.fixture(pause_program=lambda:events.append('pause') or False)
        result=run(**args)
        self.assertEqual(result.reason,'PROGRAM_PAUSE_UNCONFIRMED')
        self.assertEqual(events,['pause'])

    def test_short_repeat_count_does_not_pass_but_restores_program(self):
        events,args=self.fixture(play_training=lambda n:events.append('alarm') or
                                completed(n-1))
        result=run(**args)
        self.assertEqual(result.reason,'TRAINING_NOT_NATURALLY_COMPLETED')
        self.assertFalse(result.alarm_natural_completion)
        self.assertTrue(result.program_restored)
        self.assertEqual(events,['pause','alarm','resume','confirm'])

    def test_player_exception_also_restores_program(self):
        def broken(_):
            raise RuntimeError('player failed')
        events,args=self.fixture(play_training=broken)
        result=run(**args)
        self.assertEqual(result.reason,'ADAPTER_EXCEPTION')
        self.assertEqual(events,['pause','resume','confirm'])

    def test_missing_fresh_program_confirmation_is_not_success(self):
        events,args=self.fixture(confirm_restored=lambda:False)
        result=run(**args)
        self.assertEqual(result.reason,'PROGRAM_RETURN_UNCONFIRMED')
        self.assertFalse(result.program_restored)
        self.assertTrue(result.alarm_natural_completion)

    def test_failed_resume_is_not_success(self):
        events,args=self.fixture(resume_program=lambda:False)
        result=run(**args)
        self.assertEqual(result.reason,'PROGRAM_RETURN_UNCONFIRMED')
        self.assertFalse(result.program_restored)
        self.assertEqual(events,['pause','alarm'])

    def test_invalid_repeats_and_missing_adapter_do_not_touch_audio(self):
        for repeats in (0,6,1.5):
            events,args=self.fixture(repeats=repeats)
            self.assertEqual(run(**args).reason,'INVALID_REPEATS')
            self.assertEqual(events,[])
        events,args=self.fixture(play_training=None)
        self.assertEqual(run(**args).reason,'ADAPTER_REQUIRED')
        self.assertEqual(events,[])

if __name__=='__main__':
    unittest.main()
