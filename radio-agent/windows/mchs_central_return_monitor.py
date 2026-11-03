"""Read-only observation of central stream after an isolated audio trial.

The relay's packet counter advances only when real bytes have been forwarded
to VLC. Starting VLC or resetting its connection timestamp is not evidence.
This never controls playout, emergency messages, or physical equipment.
"""
class CentralReturnMonitor:
    def __init__(self, *, timeout_s=30):
        if timeout_s<=0:
            raise ValueError('INVALID_TIMEOUT')
        self.timeout_s=timeout_s
        self.pending=None

    def arm(self, *, ended_at, packet_count, trial_exited):
        if not trial_exited or not isinstance(packet_count,int) or packet_count<0:
            return False
        self.pending={'ended_at':ended_at,'baseline':packet_count}
        return True

    def observe(self, *, now, packet_count, last_packet_at, primary_alive,
                relay_failed, reserve_alive=False):
        pending=self.pending
        if pending is None:
            return None
        if (not isinstance(packet_count,int) or packet_count<pending['baseline']
                or not isinstance(last_packet_at,(int,float))):
            return {'status':'PENDING','reason':'PACKET_TELEMETRY_UNAVAILABLE'}
        fresh=(last_packet_at>pending['ended_at']
               and 0<=now-last_packet_at<=4)
        if primary_alive and not relay_failed and packet_count>pending['baseline'] and fresh:
            self.pending=None
            return {'status':'CONFIRMED','source':'CENTRAL','freshPackets':True,
                    'physicalAudibilityVerified':False}
        if now-pending['ended_at']>=self.timeout_s:
            self.pending=None
            return {'status':'UNCONFIRMED','reason':(
                'LOCAL_RESERVE_ONLY' if reserve_alive else 'CENTRAL_NOT_RESTORED'),
                'physicalAudibilityVerified':False}
        return {'status':'PENDING','reason':'AWAITING_CENTRAL_PACKETS'}
