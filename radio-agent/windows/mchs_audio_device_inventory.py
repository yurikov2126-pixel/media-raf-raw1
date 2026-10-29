"""Read-only inventory of Windows waveOut endpoints for supervised MCHS audio trials.

A waveOut device name is NOT a secure binding to a physical audio connector.
This helper does not select a device, open audio, or operate the PA.
"""
import ctypes
import sys
from ctypes import wintypes

MAXPNAMELEN = 32

class WAVEOUTCAPSW(ctypes.Structure):
    _fields_ = [
        ('wMid', wintypes.WORD),
        ('wPid', wintypes.WORD),
        ('vDriverVersion', wintypes.DWORD),
        ('szPname', wintypes.WCHAR * MAXPNAMELEN),
        ('dwFormats', wintypes.DWORD),
        ('wChannels', wintypes.WORD),
        ('wReserved1', wintypes.WORD),
        ('dwSupport', wintypes.DWORD),
    ]


def list_wave_outputs(winmm=None):
    """Return bounded legacy playback endpoints, never inputs.

    The Windows default mapper is excluded; display names are descriptive only.
    """
    if winmm is None:
        if sys.platform != 'win32':
            return {'supported': False, 'outputs': [], 'reason': 'WINDOWS_REQUIRED'}
        winmm = ctypes.WinDLL('winmm')
    count = winmm.waveOutGetNumDevs()
    outputs = []
    for index in range(min(int(count), 64)):
        caps = WAVEOUTCAPSW()
        rc = winmm.waveOutGetDevCapsW(index, ctypes.byref(caps), ctypes.sizeof(caps))
        if rc == 0:
            outputs.append({'index': index, 'name': str(caps.szPname)[:31],
                            'channels': int(caps.wChannels)})
    return {'supported': True, 'outputs': outputs, 'reason': 'READ_ONLY_INVENTORY'}


def assess_output_inventory(inventory):
    """Never infer physical disconnection, exclusivity or output selection."""
    outputs = inventory.get('outputs', []) if isinstance(inventory, dict) else []
    return {
        'mode': 'INVENTORY_ONLY',
        'availableOutputCount': len(outputs),
        'names': [item['name'] for item in outputs if isinstance(item, dict) and isinstance(item.get('name'), str)][:64],
        'separateOutputConfirmed': False,
        'physicalIsolationVerified': False,
        'playbackAuthorized': False,
    }


if __name__ == '__main__':
    import json
    print(json.dumps({'inventory': list_wave_outputs(),
                      'safety': assess_output_inventory(list_wave_outputs())},
                     ensure_ascii=False, indent=2))
