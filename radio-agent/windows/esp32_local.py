"""Send signed ESP32 heartbeats without disclosing the pairing secret on LAN."""
import hashlib
import hmac
import ipaddress
import json
import threading
import urllib.request

_lock=threading.Lock()
_counter={}
def send_heartbeat(host, secret, mode, audio_ready, platform_authorized, timeout=2):
    if not isinstance(secret,str) or len(secret)<32:
        raise ValueError("Local ESP32 secret must be 32+ characters")
    if mode not in ("CENTRAL","LOCAL_RESERVE","STOPPED"):
        raise ValueError("Invalid playback mode")
    address=ipaddress.ip_address(host)
    if not address.is_private or address.version!=4:
        raise ValueError("ESP32 must use a private IPv4 address")
    host=str(address)
    with _lock:
        with urllib.request.urlopen("http://"+host+"/health",timeout=timeout) as response:
            health=json.load(response)
        signed=health.get("mode")=="POWER_CONTROL_V1"
        data={"mode":mode,"audioReady":bool(audio_ready),
              "authorizedByPlatform":bool(platform_authorized),"leaseMs":0}
        headers={"Content-Type":"application/json"}
        if signed:
            nonce=health.get("bootNonce")
            if not isinstance(nonce,str) or len(nonce)!=16:
                raise ValueError("Missing boot nonce")
            key=(host,nonce)
            seq=max(_counter.get(key,0),int(health.get("heartbeatSequence",0)))+1
            if seq>=2**31:raise ValueError("ESP32 heartbeat sequence overflow")
            data["seq"]=seq
            signed_payload=f"{nonce}:hb:{seq}:{mode}:{int(bool(audio_ready))}:{int(bool(platform_authorized))}"
            headers["X-Radio-Signature"]=hmac.new(secret.encode(),signed_payload.encode(),hashlib.sha256).hexdigest()
        else:
            # Legacy SAFE_PILOT does not actuate GPIO and requires the old header.
            headers["X-Radio-Local-Secret"]=secret
        request=urllib.request.Request("http://"+host+"/heartbeat",
            data=json.dumps(data).encode(),headers=headers,method="POST")
        with urllib.request.urlopen(request,timeout=timeout) as response:
            result=json.load(response)
        if not result.get("ok") or not isinstance(result.get("relayOutputEnabled"),bool):
            raise RuntimeError("ESP32 rejected heartbeat")
        if signed:
            _counter[key]=seq
        return result
