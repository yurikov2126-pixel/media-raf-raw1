"""Fail-closed observer freshness rules for the isolated, operator-armed lab.

Never controls real alarms, relays, or amplifier power.
"""
OBSERVER_STALE_SECONDS = 10.0

def observer_failsafe(*, now, last_seen_at, automatic_trial_active,
                      one_shot_armed, expires_at):
    stale = last_seen_at <= 0 or now - last_seen_at >= OBSERVER_STALE_SECONDS
    return {
        'stop_trial': bool(automatic_trial_active and stale),
        'cancel_arm': bool(one_shot_armed and (now >= expires_at or stale)),
        'observer_stale': stale,
    }
