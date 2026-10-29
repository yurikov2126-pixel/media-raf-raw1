import unittest
from io import BytesIO
import wave
from mchs_isolated_output_pilot import wav_header, MAX_PCM_BYTES

class IsolatedHeaderTest(unittest.TestCase):
    def test_pcm_header_is_single_channel_24k(self):
        head = wav_header()
        self.assertEqual(len(head), 44)
        with wave.open(BytesIO(head), "rb") as decoder:
            self.assertEqual(decoder.getnchannels(), 1)
            self.assertEqual(decoder.getsampwidth(), 2)
            self.assertEqual(decoder.getframerate(), 24000)
            self.assertEqual(decoder.getnframes(), MAX_PCM_BYTES // 2)

if __name__ == "__main__":
    unittest.main()
