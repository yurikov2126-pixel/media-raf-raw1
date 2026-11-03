"""Local STOP evidence for both independent VLC executors."""
def can_confirm_local_stop(trial_vlc, local_start_armed, alarm_session):
    if trial_vlc is not None or local_start_armed:
        return False
    if alarm_session is None:
        return True
    state=alarm_session.status()
    thread=getattr(alarm_session,'_thread',None)
    process=getattr(alarm_session,'_process',None)
    return (state.get('state') not in ('STARTING','PLAYING') and
            (thread is None or not thread.is_alive()) and
            (process is None or process.poll() is not None))
