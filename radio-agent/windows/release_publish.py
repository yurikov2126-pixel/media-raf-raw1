"""Idempotent GitHub release publication for the Windows Radio Agent.

A GitHub API 500 during upload may leave a release and/or tag behind.
Never claim success until the expected EXE asset exists with matching SHA256.
"""
import hashlib
import json
import os
import re
from pathlib import Path
import subprocess
import sys
import time

from release_version import app_version

ASSET_NAME = 'MediaRafRaw-RadioAgent.exe'
RETRYABLE = ('HTTP 500', 'HTTP 502', 'HTTP 503', 'HTTP 504', 'HTTP 429',
             'Internal Server Error', 'Bad Gateway', 'Service Unavailable')


class PublishFailure(RuntimeError):
    pass


def gh(*args):
    result = subprocess.run(['gh', *args], capture_output=True,
                            text=True, encoding='utf-8', errors='replace')
    return result.returncode, result.stdout, result.stderr


def retry(action, *, attempts=5, delay=3):
    for index in range(attempts):
        code, out, err = action()
        if code == 0:
            return out
        if index == attempts - 1 or not any(x.lower() in err.lower() for x in RETRYABLE):
            raise PublishFailure('GitHub command failed: ' + err[-500:].strip())
        time.sleep(delay * (index + 1))
    raise PublishFailure('GitHub retry limit exhausted')


def lookup_release(repo, tag):
    """404 is absent; other failures are retried or raised, never 'absent'."""
    for index in range(5):
        code, out, err = gh('api', f'repos/{repo}/releases/tags/{tag}')
        if code == 0:
            return json.loads(out)
        if 'HTTP 404' in err or '"status":"404"' in err.replace(' ', ''):
            return None
        if index == 4 or not any(x.lower() in err.lower() for x in RETRYABLE):
            raise PublishFailure('Unable to read release state: ' + err[-500:])
        time.sleep(3 * (index + 1))
    return None


def assert_asset(release, local_sha, local_size, *, preexisting=False):
    matching = [a for a in release.get('assets', []) if a.get('name') == ASSET_NAME]
    if not matching:
        return False
    if len(matching) != 1:
        raise PublishFailure('Duplicate release assets: operator review required')
    asset = matching[0]
    digest = asset.get('digest')
    if asset.get('state') != 'uploaded' or not isinstance(asset.get('size'), int) or asset['size'] <= 0:
        raise PublishFailure('Existing release asset is incomplete')
    if not isinstance(digest, str) or not re.fullmatch(r'sha256:[a-f0-9]{64}', digest):
        raise PublishFailure('GitHub did not provide a valid uploaded EXE checksum')
    if digest != 'sha256:' + local_sha or asset['size'] != local_size:
        if not preexisting:
            raise PublishFailure('Uploaded EXE SHA256 or size mismatch')
        # GitHub's previous successful EXE must remain immutable. PyInstaller
        # builds are not necessarily byte-reproducible on a second runner.
        print('PREEXISTING_VERSIONED_EXE_PRESERVED', digest, asset['size'])
    return True


def publish(*, repo, commit_sha, asset_path, tagged=False):
    version = app_version()
    tag = 'radio-agent-v' + version
    path = Path(asset_path)
    if not path.is_file() or path.stat().st_size <= 0:
        raise PublishFailure('Windows EXE build asset does not exist')
    local_sha = hashlib.sha256(path.read_bytes()).hexdigest()
    local_size = path.stat().st_size
    release = lookup_release(repo, tag)
    preexisting = release is not None

    if not release:
        args = ['release', 'create', tag, '--repo', repo]
        if tagged:
            args += ['--verify-tag']
        else:
            args += ['--target', commit_sha]
        args += ['--title', f'MEDIA RAF RAW - Radio Agent {version}',
                 '--notes', f'Windows Radio Agent {version}. VLC required. '
                 'Amplifier/PA output remains separately controlled.']
        # GitHub may return HTTP 500 before OR after creating the release.
        # Re-read release-by-tag after every attempt and retry only if missing.
        # Never replace an existing immutable release or its published asset.
        last_error = ''
        for attempt in range(6):
            code, _, err = gh(*args)
            last_error = err
            release = lookup_release(repo, tag)
            if release:
                print('RELEASE_CREATE_CONFIRMED', tag, 'attempt', attempt + 1)
                break
            if code and not any(x.lower() in err.lower() for x in RETRYABLE):
                raise PublishFailure('GitHub Release creation rejected: ' + err[-500:])
            if attempt == 5:
                raise PublishFailure(
                    'GitHub Release creation failed after 6 attempts: ' + last_error[-500:])
            time.sleep(min(30, 3 * (attempt + 1)))
    if release.get('draft') or release.get('prerelease'):
        raise PublishFailure('Unexpected draft/prerelease: manual review required')
    if release.get('tag_name') != tag:
        raise PublishFailure('Release tag mismatch')

    if not assert_asset(release, local_sha, local_size, preexisting=preexisting):
        # Do not use --clobber. It could silently replace an immutable asset.
        for attempt in range(5):
            code, _, err = gh('release', 'upload', tag, str(path), '--repo', repo)
            release = lookup_release(repo, tag)
            if release and assert_asset(release, local_sha, local_size):
                break
            if attempt == 4:
                raise PublishFailure('EXE upload unverified after retries: ' + err[-500:])
            if code and not any(x.lower() in err.lower() for x in RETRYABLE):
                raise PublishFailure('EXE upload rejected: ' + err[-500:])
            time.sleep(3 * (attempt + 1))

    # Final read confirms the GitHub API now advertises the correct asset hash.
    published = lookup_release(repo, tag)
    if not published or not assert_asset(published, local_sha, local_size,
                                          preexisting=preexisting):
        raise PublishFailure('Release exists without verified EXE')
    published_asset = next(a for a in published['assets'] if a['name'] == ASSET_NAME)
    print('RELEASE_PUBLISHED_AND_VERIFIED', tag, ASSET_NAME,
          published_asset['digest'], 'size:' + str(published_asset['size']))
    print('RELEASE_URL', published.get('html_url', ''))


if __name__ == '__main__':
    repo = os.environ.get('RELEASE_REPO', '')
    sha = os.environ.get('RELEASE_SHA', '')
    if '/' not in repo or not sha:
        raise SystemExit('RELEASE_REPO and RELEASE_SHA are required')
    asset = sys.argv[1] if len(sys.argv) > 1 else 'dist/' + ASSET_NAME
    try:
        publish(repo=repo, commit_sha=sha, asset_path=asset,
                tagged=os.environ.get('GITHUB_REF', '').startswith('refs/tags/'))
    except (PublishFailure, OSError, ValueError) as error:
        raise SystemExit('Release publishing failed: ' + str(error))
