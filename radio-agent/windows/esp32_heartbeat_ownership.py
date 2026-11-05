"""Heartbeat ownership between GUI and playout thread.

The isolated event-audio runner intentionally does not receive ESP32 secrets.
The GUI must therefore continue signed heartbeat while isolated Agent runs;
without it the firmware's 10-second watchdog marks the device DISCONNECTED.
The heartbeat never grants amplifier power and never replaces server permit.
"""

def gui_owns_esp32_heartbeat(*, worker_alive, isolated_mode):
    return not worker_alive or isolated_mode
