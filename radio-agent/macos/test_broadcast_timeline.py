import unittest
from datetime import datetime,timezone
from broadcast_timeline import current_track, locate_track, stream_windows

def iso(second):
    return datetime.fromtimestamp(second,timezone.utc).isoformat()

def slot(id,start,end,durations):
    return {'id':id,'startAt':iso(start),'endAt':iso(end),
            'tracks':[{'id':str(i),'durationMs':d} for i,d in enumerate(durations)]}

class TimelineTests(unittest.TestCase):
    def test_takeover_selects_correct_track_and_position(self):
        s=slot('a',1000,1100,[20000,30000,50000])
        self.assertEqual(locate_track(s,1037)['index'],1)
        self.assertEqual(locate_track(s,1037)['offset_ms'],17000)

    def test_no_restart_at_end(self):
        s=slot('a',1000,1100,[20000,30000])
        self.assertIsNone(locate_track(s,1075))
        self.assertIsNone(locate_track(s,1100))

    def test_next_active_slot(self):
        first=slot('a',1000,1020,[20000])
        second=slot('b',1020,1050,[30000])
        self.assertEqual(current_track([second,first],1021)['slot_id'],'b')

    def test_stream_gap_policy(self):
        a=slot('a',1000,1100,[100000])
        b=slot('b',1699,1750,[51000])
        c=slot('c',2350,2400,[50000])
        windows=stream_windows([c,a,b])
        self.assertEqual(len(windows),2)
        self.assertEqual(windows[0],{'start':940,'end':1750})
        self.assertEqual(windows[1],{'start':2290,'end':2400})

if __name__=='__main__':
    unittest.main()
