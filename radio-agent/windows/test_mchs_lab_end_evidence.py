import unittest
from mchs_lab_end_evidence import assess_lab_trial_end as assess

class EndEvidenceTests(unittest.TestCase):
    def test_clean_eof_and_successful_player_exit_only_observe_pcm_end(self):
        r=assess(stop_reason='VLC_EXITED',vlc_exit_code=0,
                 pcm_eof_at=12.0,bytes_forwarded=200000)
        self.assertEqual(r['classification'],'PCM_EOF_AND_VLC_EXIT_OBSERVED')
        self.assertTrue(r['naturalPcmEndObserved'])
        self.assertFalse(r['fullAlarmCompletionVerified'])

    def test_vlc_exit_without_eof_is_not_natural(self):
        for change in (
            {'pcm_eof_at':None},
            {'vlc_exit_code':1},
            {'bytes_forwarded':0},
            {'stream_failed':True},
            {'capped':True},
        ):
            args=dict(stop_reason='VLC_EXITED',vlc_exit_code=0,
                      pcm_eof_at=12.0,bytes_forwarded=200000)
            args.update(change)
            r=assess(**args)
            self.assertFalse(r['naturalPcmEndObserved'])

    def test_watchdog_and_operator_stop_not_mistaken_for_natural_exit(self):
        args=dict(vlc_exit_code=0,pcm_eof_at=12.0,bytes_forwarded=200000)
        for reason in ('MAX_DURATION','PCM_STALLED','AUTHORIZATION_LOST',
                       'PCM_CONNECT_TIMEOUT','OPERATOR_STOP'):
            r=assess(stop_reason=reason,**args)
            self.assertFalse(r['naturalPcmEndObserved'])
            self.assertFalse(r['fullAlarmCompletionVerified'])

    def test_empty_or_invalid_bytes_do_not_prove_a_complete_file(self):
        r=assess(stop_reason='VLC_EXITED',vlc_exit_code=0,
                 pcm_eof_at=1.0,bytes_forwarded=True)
        self.assertFalse(r['naturalPcmEndObserved'])

if __name__=='__main__':
    unittest.main()
