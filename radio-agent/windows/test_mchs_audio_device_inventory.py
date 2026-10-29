import unittest
from unittest.mock import MagicMock
from mchs_audio_device_inventory import (
    WAVEOUTCAPSW, assess_output_inventory, list_wave_outputs,
)

class DeviceInventoryTests(unittest.TestCase):
    def test_legacy_outputs_are_inventory_only(self):
        import ctypes
        lib=MagicMock()
        lib.waveOutGetNumDevs.return_value=2
        def fill(index, ptr, _size):
            caps=ctypes.cast(ptr, ctypes.POINTER(WAVEOUTCAPSW)).contents
            caps.szPname='Headphones' if index==0 else 'Speakers'
            caps.wChannels=2
            return 0
        lib.waveOutGetDevCapsW.side_effect=fill
        listing=list_wave_outputs(lib)
        self.assertEqual([x['name'] for x in listing['outputs']],['Headphones','Speakers'])
        state=assess_output_inventory(listing)
        self.assertEqual(state['availableOutputCount'],2)
        self.assertFalse(state['separateOutputConfirmed'])
        self.assertFalse(state['physicalIsolationVerified'])
        self.assertFalse(state['playbackAuthorized'])
    def test_driver_errors_do_not_create_fake_outputs(self):
        lib=MagicMock()
        lib.waveOutGetNumDevs.return_value=1
        lib.waveOutGetDevCapsW.return_value=1
        self.assertEqual(list_wave_outputs(lib)['outputs'],[])
    def test_empty_or_unavailable_never_arms_output(self):
        for value in ({'outputs':[]},{'supported':False,'outputs':[]},None):
            self.assertFalse(assess_output_inventory(value)['playbackAuthorized'])

if __name__=='__main__':
    unittest.main()
