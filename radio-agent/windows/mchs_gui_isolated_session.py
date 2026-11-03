"""Headphones-only MCHS event mode shared by the Windows GUI and CLI.

No subprocess/PowerShell, automatic audio start, ESP32, or public radio control.
The caller separately obtains explicit operator isolation consent on each start.
"""
from pathlib import Path
import re

from mchs_two_stage_headphones_pilot import verify_local_training_wav

TOKEN_PATTERN = re.compile(r'rr_[a-f0-9]{64}\Z')


def prepare_isolated_gui_session(*, server, token, vlc, danger_wav,
                                 all_clear_wav, power_armed=False,
                                 operator_confirmation=''):
    if power_armed:
        raise ValueError('AMPLIFIER_POWER_MUST_BE_DISARMED')
    if operator_confirmation != 'ISOLATED':
        raise PermissionError('PHYSICAL_PA_DISCONNECTION_NOT_CONFIRMED')
    if not isinstance(server, str) or not server.startswith('https://'):
        raise ValueError('HTTPS_REQUIRED')
    if not isinstance(token, str) or not TOKEN_PATTERN.fullmatch(token):
        raise ValueError('DEVICE_TOKEN_REQUIRED')
    executable = Path(vlc).resolve()
    if not executable.is_file() or executable.name.lower() != 'vlc.exe':
        raise ValueError('VLC_EXE_REQUIRED')
    danger = verify_local_training_wav(danger_wav)
    clear = verify_local_training_wav(all_clear_wav)
    if danger['sha256'] == clear['sha256']:
        raise ValueError('IDENTICAL_DANGER_AND_ALL_CLEAR')
    return {
        'isolated_event_audio': True,
        'isolated_event_admission': False,
        'isolated_cycle_assets': None,
        'isolated_event_assets': {
            'MISSILE_DANGER': danger,
            'MISSILE_ALL_CLEAR': clear,
        },
        'esp32_host': '',
        'esp32_secret': '',
    }
