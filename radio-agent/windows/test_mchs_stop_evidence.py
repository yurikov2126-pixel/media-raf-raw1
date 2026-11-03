import unittest
from mchs_stop_evidence import can_confirm_local_stop
class Stub:
 def __init__(self,state='COMPLETED',live=False):
  self._state=state
  self._thread=type('Thread',(),{'is_alive':lambda self:live})()
  self._process=None
 def status(self):return {'state':self._state}
class StopEvidenceTests(unittest.TestCase):
 def test_no_audio(self):
  self.assertTrue(can_confirm_local_stop(None,False,None))
 def test_lab_still_active(self):
  self.assertFalse(can_confirm_local_stop(object(),False,None))
  self.assertFalse(can_confirm_local_stop(None,True,None))
 def test_new_alarm_still_playing(self):
  self.assertFalse(can_confirm_local_stop(None,False,Stub('PLAYING',True)))
  self.assertFalse(can_confirm_local_stop(None,False,Stub('STOPPED',True)))
 def test_completed_and_exited(self):
  self.assertTrue(can_confirm_local_stop(None,False,Stub('COMPLETED',False)))
if __name__=='__main__':unittest.main()
