"""Offline regression tests for versioned GitHub release recovery."""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import release_publish as publisher


class ReleasePublishingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.asset = Path(self.temp.name) / publisher.ASSET_NAME
        self.asset.write_bytes(b'MZ' + b'agent-test-binary' * 100)
        self.sha = hashlib.sha256(self.asset.read_bytes()).hexdigest()
        self.tag = 'radio-agent-v0.5.14'
        self.release = {'tag_name': self.tag, 'html_url': 'https://github.com/example/release',
                        'draft': False, 'prerelease': False, 'assets': []}

    def asset_entry(self, *, sha=None):
        return {'name': publisher.ASSET_NAME, 'state': 'uploaded',
                'size': self.asset.stat().st_size, 'digest': 'sha256:' + (sha or self.sha)}

    def test_incomplete_release_is_repaired_with_asset_upload(self):
        state = {'release': dict(self.release), 'uploaded': 0}
        def mock_gh(*args):
            if args[:2] == ('release', 'upload'):
                state['uploaded'] += 1
                state['release']['assets'] = [self.asset_entry()]
                return 0, '', ''
            self.fail('unexpected gh operation: ' + repr(args))
        with patch.object(publisher, 'app_version', return_value='0.5.14'), \
             patch.object(publisher, 'lookup_release', side_effect=lambda *_: state['release']), \
             patch.object(publisher, 'gh', side_effect=mock_gh):
            publisher.publish(repo='owner/repo', commit_sha='deadbeef',
                              asset_path=str(self.asset))
        self.assertEqual(state['uploaded'], 1)

    def test_upload_http_500_is_recovered_if_asset_was_created(self):
        state = {'release': dict(self.release)}
        def mock_gh(*args):
            state['release']['assets'] = [self.asset_entry()]
            return 1, '', 'HTTP 500 while publishing release asset'
        with patch.object(publisher, 'app_version', return_value='0.5.14'), \
             patch.object(publisher, 'lookup_release', side_effect=lambda *_: state['release']), \
             patch.object(publisher, 'gh', side_effect=mock_gh):
            publisher.publish(repo='owner/repo', commit_sha='deadbeef',
                              asset_path=str(self.asset))

    def test_existing_valid_asset_is_never_clobbered(self):
        state = {'release': {**self.release, 'assets': [self.asset_entry(sha='f'*64)]}}
        with patch.object(publisher, 'app_version', return_value='0.5.14'), \
             patch.object(publisher, 'lookup_release', side_effect=lambda *_: state['release']), \
             patch.object(publisher, 'gh', side_effect=AssertionError('must not call gh')):
            publisher.publish(repo='owner/repo', commit_sha='deadbeef',
                              asset_path=str(self.asset))

    def test_preexisting_corrupt_asset_is_not_silently_replaced(self):
        bad = {**self.asset_entry(), 'state': 'starter'}
        with self.assertRaises(publisher.PublishFailure):
            publisher.assert_asset({'assets': [bad]}, self.sha, self.asset.stat().st_size,
                                   preexisting=True)

    def test_404_is_absent_but_500_is_not_absent(self):
        with patch.object(publisher, 'gh', return_value=(1, '', 'HTTP 404 Not Found')):
            self.assertIsNone(publisher.lookup_release('owner/repo', self.tag))
        with patch.object(publisher, 'gh', return_value=(1, '', 'HTTP 500')), \
             patch.object(publisher.time, 'sleep', return_value=None):
            with self.assertRaises(publisher.PublishFailure):
                publisher.lookup_release('owner/repo', self.tag)


if __name__ == '__main__':
    unittest.main()
