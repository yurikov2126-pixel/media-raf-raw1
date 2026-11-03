import unittest
from mchs_integrated_headphones_cycle import IntegratedHeadphonesCycle


def completed(repeats):
    return dict(state='COMPLETED',naturalCompletion=True,
                completedRepeats=repeats,expectedRepeats=repeats,
                processRunning=False,failureReason=None)


def step(c,now,**values):
    kw=dict(now=now,central_ready=False,authorized=True,
            session=None,returned=None,conflicting=False)
    kw.update(values)
    return c.tick(**kw)


class IntegratedCycleTests(unittest.TestCase):
    def new(self):
        return IntegratedHeadphonesCycle(danger_repeats=4,
                                          danger_duration=25,clear_duration=15)

    def test_two_stage_natural_completion_and_two_independent_central_returns(self):
        c=self.new()
        self.assertEqual(step(c,1,central_ready=True),'START_DANGER')
        c.started('DANGER',True,1)
        self.assertIsNone(step(c,2,session=dict(state='PLAYING')))
        self.assertEqual(step(c,101,session=completed(4)),'RESTORE_PROGRAM')
        c.restored(now=101,monitor_armed=True)
        self.assertIsNone(step(c,102,returned={'status':'PENDING'}))
        self.assertIsNone(step(c,104,returned={'status':'CONFIRMED'}))
        self.assertIsNone(step(c,107,central_ready=True))
        self.assertEqual(step(c,108,central_ready=True),'START_ALL_CLEAR')
        c.started('ALL_CLEAR',True,108)
        self.assertEqual(step(c,125,session=completed(1)),'RESTORE_PROGRAM')
        c.restored(now=125,monitor_armed=True)
        self.assertEqual(step(c,130,returned={'status':'CONFIRMED'}),'FINISHED')
        self.assertTrue(c.terminal)
        self.assertEqual(c.phase,'DONE')
        self.assertEqual(c.history,[{'stage':'DANGER','repeats':4,'natural':True},
             {'returnedAfter':'DANGER','centralPackets':True},
             {'stage':'ALL_CLEAR','repeats':1,'natural':True},
             {'returnedAfter':'ALL_CLEAR','centralPackets':True}])
        self.assertIsNone(step(c,140,central_ready=True))

    def test_failed_danger_does_not_start_all_clear_but_requests_program_return(self):
        c=self.new()
        step(c,1,central_ready=True);c.started('DANGER',True,1)
        self.assertEqual(step(c,3,session={'state':'STOPPED'}),'RESTORE_FAULT')
        c.restored(now=3,monitor_armed=True)
        self.assertEqual(step(c,5,returned={'status':'CONFIRMED'}),'FAULT_RETURNED')
        self.assertEqual(c.phase,'FAILED')
        self.assertFalse(any(x.get('stage')=='ALL_CLEAR' for x in c.history))

    def test_missing_natural_receipt_cannot_advance(self):
        c=self.new()
        step(c,1,central_ready=True);c.started('DANGER',True,1)
        receipt=completed(3)
        self.assertIsNone(step(c,10,session=receipt))
        self.assertEqual(step(c,126,session=receipt),'RESTORE_FAULT')

    def test_unconfirmed_central_return_never_plays_clear(self):
        c=self.new()
        step(c,1,central_ready=True);c.started('DANGER',True,1)
        step(c,90,session=completed(4))
        c.restored(now=90,monitor_armed=True)
        step(c,95,returned={'status':'UNCONFIRMED'})
        self.assertEqual(c.phase,'FAILED')
        self.assertEqual(c.failure,'CENTRAL_RETURN_UNCONFIRMED')

    def test_reject_stage_without_local_authorization(self):
        c=self.new()
        self.assertIsNone(step(c,1,central_ready=True,authorized=False))
        self.assertEqual(c.phase,'WAIT_BASELINE')
        self.assertIsNone(step(c,100,central_ready=True,authorized=False))
        self.assertEqual(c.phase,'FAILED')

    def test_local_start_failure_is_terminal(self):
        c=self.new()
        step(c,1,central_ready=True)
        c.started('DANGER',False,1)
        self.assertEqual(c.phase,'FAILED')

    def test_authorization_loss_during_playing_requests_restore(self):
        c=self.new()
        step(c,1,central_ready=True);c.started('DANGER',True,1)
        self.assertEqual(step(c,5,authorized=False),'RESTORE_FAULT')

    def test_trial_conflict_blocks_start(self):
        c=self.new()
        self.assertIsNone(step(c,1,central_ready=True,conflicting=True))
        self.assertEqual(step(c,2,central_ready=True),'START_DANGER')

    def test_reject_invalid_repeats(self):
        for n in [0,6,True,'4']:
            with self.assertRaises(ValueError):
                IntegratedHeadphonesCycle(danger_repeats=n,
                    danger_duration=20,clear_duration=20)


if __name__=='__main__':
    unittest.main()
