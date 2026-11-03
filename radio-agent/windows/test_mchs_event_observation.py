import io
import json
import unittest
from unittest.mock import Mock
from mchs_event_observation import make_event_observation, post_event_observation


class FakeController:
    def __init__(self,state='COMPLETE',reason=None,kind='MISSILE_DANGER'):
        self.event_type=kind
        self._state=state
        self._reason=reason
    def snapshot(self):
        return {'state':self._state,'eventId':'demo-1','repeats':4,
                'failure':self._reason,'history':[
                    {'eventId':'demo-1','naturalCompletion':True,'repeats':4},
                    {'eventId':'demo-1','centralReturned':True}]}


class Response:
    status=200
    def __enter__(self):return self
    def __exit__(self,*args):pass
    def read(self,*args):return b'{"accepted":true,"localProcessObservationOnly":true}'


class ObservationTests(unittest.TestCase):
    def test_completed_event_requires_matched_full_session_and_return(self):
        session={'eventId':'demo-1','completedRepeats':4,
                 'processRunning':False}
        result=make_event_observation(FakeController(),session)
        self.assertEqual(result['phase'],'COMPLETE')
        self.assertTrue(result['centralReturnConfirmed'])
        self.assertTrue(result['naturalCompletion'])
        self.assertIsNone(make_event_observation(FakeController(),{
            **session,'completedRepeats':3}))
        self.assertIsNone(make_event_observation(FakeController(),{
            **session,'eventId':'wrong'}))
        self.assertIsNone(make_event_observation(FakeController(),{
            **session,'processRunning':True}))

    def test_failure_keeps_error_and_never_claims_public_pa(self):
        ctrl=FakeController('FAILED','SERVER_STOP')
        report=make_event_observation(ctrl,{
            'eventId':'demo-1','completedRepeats':2,'processRunning':False})
        self.assertEqual(report['failureReason'],'SERVER_STOP')
        self.assertEqual(report['completedRepeats'],2)

    def test_nonterminal_never_reported(self):
        self.assertIsNone(make_event_observation(FakeController('PLAYING'),{}))

    def test_http_authenticated_local_report(self):
        seen=[]
        def opener(req,timeout):
            self.assertEqual(timeout,3)
            seen.append((req.full_url,req.headers['Authorization'],
                         json.loads(req.data)))
            return Response()
        self.assertTrue(post_event_observation(
            'https://example.test','rr_test',
            {'eventId':'demo-1','phase':'COMPLETE'},opener=opener))
        self.assertTrue(seen[0][0].endswith('/api/radio-agent/agent/mchs-event-execution-observation'))
        self.assertEqual(seen[0][1],'Bearer rr_test')

    def test_fail_closed_on_invalid_transport(self):
        with self.assertRaises(ValueError):
            post_event_observation('http://example.test','rr_test',{'eventId':'x'})
        with self.assertRaises(ValueError):
            post_event_observation('https://example.test','invalid',{'eventId':'x'})


if __name__=='__main__':
    unittest.main()
