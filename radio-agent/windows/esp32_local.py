"""Read-only ESP32 safe pilot: send local heartbeat; NEVER switch the relay."""
import json
import urllib.request

def send_heartbeat(host, secret, mode, audio_ready, platform_authorized, timeout=2):
    if not isinstance(secret, str) or len(secret) < 32:
        raise ValueError("Local ESP32 secret must be 32+ characters")
    if mode not in ("CENTRAL", "LOCAL_RESERVE", "STOPPED"):
        raise ValueError("Invalid playback mode")
    # LAN address, not internet domain or arbitrary URL.
    import ipaddress
    address = ipaddress.ip_address(host)
    if not address.is_private or address.version != 4:
        raise ValueError("ESP32 must use a private IPv4 address")
    data = json.dumps({"mode":mode, "audioReady":bool(audio_ready),
                       "authorizedByPlatform":bool(platform_authorized),
                       "leaseMs":10000 if audio_ready and platform_authorized else 0}).encode()
    request=urllib.request.Request("http://"+str(address)+"/heartbeat",data=data,
        headers={"Content-Type":"application/json", "X-Radio-Local-Secret":secret},
        method="POST")
    with urllib.request.urlopen(request,timeout=timeout) as response:
        result=json.load(response)
        if not result.get("ok") or result.get("relayOutputEnabled") is not False:
            raise RuntimeError("ESP32 is not in safe pilot mode")
        return result
