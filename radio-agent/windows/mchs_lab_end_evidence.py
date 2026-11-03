"""Conservative observed end evidence for isolated PCM trial.

A clean VLC exit and EOF observed on the local PCM relay are necessary
observations; neither proves full ALARM file/repetition completion on Worker.
No dispatch, audio playback, or PA control here.
"""
def assess_lab_trial_end(*, stop_reason, vlc_exit_code, pcm_eof_at,
                         bytes_forwarded, stream_failed=False,
                         capped=False, stopped_by_operator=False):
    if stopped_by_operator or stop_reason=='OPERATOR_STOP':
        return {'classification':'OPERATOR_STOP','naturalPcmEndObserved':False,
                'fullAlarmCompletionVerified':False}
    if stop_reason!='VLC_EXITED':
        return {'classification':'WATCHDOG_OR_FAULT','naturalPcmEndObserved':False,
                'fullAlarmCompletionVerified':False}
    if (vlc_exit_code==0 and type(bytes_forwarded) is int and bytes_forwarded>0
            and isinstance(pcm_eof_at,(int,float)) and pcm_eof_at>0
            and not stream_failed and not capped):
        return {'classification':'PCM_EOF_AND_VLC_EXIT_OBSERVED',
                'naturalPcmEndObserved':True,
                'fullAlarmCompletionVerified':False}
    return {'classification':'VLC_EXIT_WITHOUT_CLEAN_PCM_END',
            'naturalPcmEndObserved':False,
            'fullAlarmCompletionVerified':False}
