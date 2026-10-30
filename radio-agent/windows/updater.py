"""Conservative update checker for the Windows radio pilot.

Updates are staged, not installed while playback is active. Release metadata
is fetched only via GitHub HTTPS, with SHA-256 verified against GitHub's
release-asset digest (or an explicit hash supplied by a trusted publisher).
"""
import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
import socket
import ssl
import time

RELEASE_API = "https://api.github.com/repos/yurikov2126-pixel/media-raf-raw1/releases?per_page=20"
APP_ASSET = "MediaRafRaw-RadioAgent.exe"
MAX_BYTES = 100 * 1024 * 1024

class UpdateCheckError(RuntimeError):
    """A safe, user-readable error with no credentials or private URLs."""



def version_tuple(value):
    parts = value.removeprefix("v").split(".")
    if not 1 <= len(parts) <= 3 or any(not p.isdecimal() for p in parts):
        raise ValueError("Invalid version")
    return tuple(map(int, (parts + ["0"] * (3 - len(parts)))))


def select_update(release, installed_version):
    if release.get("draft") or release.get("prerelease"):
        return None
    tag = release.get("tag_name", "")
    # Only the radio-agent tags are authorized to update this application.
    prefix = "radio-agent-v"
    if not isinstance(tag, str) or not tag.startswith(prefix):
        return None
    new_version = tag[len(prefix):]
    if version_tuple(new_version) <= version_tuple(installed_version):
        return None
    for asset in release.get("assets", []):
        digest = asset.get("digest", "")
        url = asset.get("browser_download_url", "")
        if (asset.get("name") == APP_ASSET and isinstance(digest, str)
                and digest.startswith("sha256:") and len(digest) == 71
                and isinstance(url, str)
                and url.startswith("https://github.com/yurikov2126-pixel/media-raf-raw1/releases/download/")):
            return {"version": new_version, "url": url, "sha256": digest[7:]}
    return None


def _network_error(error):
    reason = getattr(error, "reason", error)
    if isinstance(reason, socket.gaierror):
        return "Не удалось разрешить DNS-имя api.github.com; проверьте DNS и прокси"
    if isinstance(reason, (socket.timeout, TimeoutError)):
        return "Тайм-аут при обращении к api.github.com; проверьте доступность HTTPS"
    if isinstance(reason, ConnectionRefusedError):
        return "Соединение с api.github.com отклонено; проверьте прокси и файрвол"
    if isinstance(reason, ssl.SSLError):
        return "Ошибка TLS при соединении с GitHub; проверьте сертификаты и часы Windows"
    return "Не удалось подключиться к api.github.com (" + type(reason).__name__ + "); проверьте сеть и прокси"


def _fetch_releases():
    request = Request(RELEASE_API, headers={
        "Accept": "application/vnd.github+json",
        "User-Agent": "MediaRafRaw-RadioAgent-Updater",
        "X-GitHub-Api-Version": "2022-11-28",
    })
    for attempt in range(2):
        try:
            with urlopen(request, timeout=8) as response:
                return json.load(response)
        except HTTPError as error:
            if error.code in (403, 429):
                raise UpdateCheckError("GitHub ограничил запросы (HTTP %d); повторите позже" % error.code) from error
            if error.code == 404:
                raise UpdateCheckError("GitHub Releases недоступны (HTTP 404); проверьте адрес репозитория") from error
            if 500 <= error.code < 600 and attempt == 0:
                time.sleep(0.5)
                continue
            raise UpdateCheckError("GitHub API вернул HTTP %d" % error.code) from error
        except (URLError, TimeoutError, socket.timeout, OSError, ssl.SSLError) as error:
            if attempt == 0:
                time.sleep(0.5)
                continue
            raise UpdateCheckError(_network_error(error)) from error
        except (ValueError, TypeError) as error:
            raise UpdateCheckError("GitHub вернул некорректный ответ вместо списка релизов") from error


def check_latest(installed_version):
    releases = _fetch_releases()
    if not isinstance(releases, list):
        raise UpdateCheckError("Некорректный формат ответа GitHub Releases")
    candidates = [u for release in releases if isinstance(release, dict)
                  if (u := select_update(release, installed_version))]
    return max(candidates, key=lambda update: version_tuple(update["version"]), default=None)


def stage_update(update, folder):
    target = Path(folder)
    target.mkdir(parents=True, exist_ok=True)
    final = target / ("MediaRafRaw-RadioAgent-" + update["version"] + ".exe")
    temp = final.with_suffix(".part")
    h = hashlib.sha256()
    count = 0
    try:
        with urlopen(Request(update["url"], headers={
            "User-Agent": "MediaRafRaw-RadioAgent-Updater",
        }), timeout=20) as response, temp.open("wb") as out:
            while chunk := response.read(1024 * 1024):
                count += len(chunk)
                if count > MAX_BYTES:
                    raise ValueError("Update is too large")
                out.write(chunk)
                h.update(chunk)
        if h.hexdigest() != update["sha256"]:
            raise ValueError("Update SHA-256 mismatch")
        temp.replace(final)
        return final
    finally:
        temp.unlink(missing_ok=True)
