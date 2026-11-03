import unittest
from unittest.mock import patch
from mchs_isolated_readiness import make_isolated_readiness,post_isolated_readiness

ASSETS={'MISSILE_DANGER':{'sha256':'a'*64},
        'MISSILE_ALL_CLEAR':{'sha256':'b'*64}}

class IsolatedReadinessTests(unittest.TestCase):
    def test_payload_never_claims_pa_output_or_starts_audio(self):
        result=make_isolated_readiness(ASSETS,True)
        self.assertEqual(result['mode'],'ISOLATED_EVENT_AUDIO')
        self.assertTrue(result['centralPacketsConfirmed'])
        self.assertNotIn('physicalPaVerified',result)
        self.assertNotIn('command',result)
        self.assertEqual(result['assets']['MISSILE_DANGER'],'a'*64)

    def test_network_post_requires_https_and_device_token(self):
        with self.assertRaises(ValueError):
            post_isolated_readiness('http://example.test','rr_'+'a'*64,{})
        with self.assertRaises(ValueError):
            post_isolated_readiness('https://example.test','not-a-token',{})

    def test_report_returns_false_on_server_rejection(self):
        class FakeResponse:
            status=200
            def __enter__(self):return self
            def __exit__(self,*args):pass
            def read(self):return b'{"accepted":false}'
        self.assertFalse(post_isolated_readiness(
            'https://example.test','rr_'+'a'*64,
            make_isolated_readiness(ASSETS,False),
            opener=lambda *_args,**_kwargs:FakeResponse()))

if __name__=='__main__':unittest.main()
