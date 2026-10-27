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


def restart_esp32(host, secret, timeout=4):
    """Operator-requested, HMAC-authorized safe restart of compatible firmware."""
    if not isinstance(secret,str) or len(secret)<32:
        raise ValueError("Local ESP32 secret must be 32+ characters")
    address=ipaddress.ip_address(host)
    if address.version!=4 or not address.is_private:
        raise ValueError("ESP32 must use private IPv4")
    host=str(address)
    with _lock:
        with urllib.request.urlopen("http://"+host+"/health",timeout=timeout) as response:
            health=json.load(response)
        if health.get("mode")!="POWER_CONTROL_V1":
            raise RuntimeError("ESP32 firmware does not support authenticated restart")
        nonce=health.get("bootNonce")
        if not isinstance(nonce,str) or len(nonce)!=16:
            raise ValueError("Missing boot nonce")
        key=(host,nonce)
        seq=max(_counter.get(key,0),int(health.get("powerSequence",0)))+1
        if seq>=2**31:raise ValueError("ESP32 sequence overflow")
        payload=f"{nonce}:restart:{seq}"
        signature=hmac.new(secret.encode(),payload.encode(),hashlib.sha256).hexdigest()
        request=urllib.request.Request("http://"+host+"/restart",
            data=json.dumps({"seq":seq}).encode(),
            headers={"Content-Type":"application/json","X-Radio-Signature":signature},
            method="POST")
        with urllib.request.urlopen(request,timeout=timeout) as response:
            result=json.load(response)
        if not result.get("ok"):
            raise RuntimeError("ESP32 restart not acknowledged")
        return result


def upload_firmware(host, secret, firmware_path, timeout=120):
    """Upload a user-selected, authenticated ESP32 application BIN over studio LAN.

    A compatible OTA-enabled image must first be installed via USB. The
    controller checks both HMAC authorization and the received SHA-256 before
    activating the image, while dropping the amplifier relay.
    """
    from pathlib import Path
    from uuid import uuid4
    if not isinstance(secret,str) or len(secret)<32:
        raise ValueError("Local ESP32 secret must be 32+ characters")
    address=ipaddress.ip_address(host)
    if address.version!=4 or not address.is_private:
        raise ValueError("ESP32 must use private IPv4")
    host=str(address)
    path=Path(firmware_path)
    if path.suffix.lower()!=".bin":
        raise ValueError("Select an ESP32 application .bin firmware")
    size=path.stat().st_size
    if size<4096 or size>3*1024*1024:
        raise ValueError("Firmware size is outside the safe 4 KiB–3 MiB range")
    image=path.read_bytes()
    if image[0]!=0xe9:
        raise ValueError("Invalid ESP32 application image header")
    digest=hashlib.sha256(image).hexdigest()
    with _lock:
        with urllib.request.urlopen("http://"+host+"/health",timeout=4) as response:
            health=json.load(response)
        if health.get("mode")!="POWER_CONTROL_V1":
            raise RuntimeError("ESP32 is not running the OTA-enabled controller")
        nonce=health.get("bootNonce")
        if not isinstance(nonce,str) or len(nonce)!=16:
            raise ValueError("Missing ESP32 boot nonce")
        seq=int(health.get("powerSequence",0))+1
        if seq<=0 or seq>=2**31:
            raise ValueError("ESP32 command sequence overflow")
        signature=hmac.new(secret.encode(),
            f"{nonce}:flash:{seq}:{digest}".encode(),hashlib.sha256).hexdigest()
        boundary="radiofirmware"+uuid4().hex
        prefix=(f"--{boundary}\\r\\n"
                'Content-Disposition: form-data; name="firmware"; filename="radio-firmware.bin"\\r\\n'
                "Content-Type: application/octet-stream\\r\\n\\r\\n").encode()
        suffix=(f"\\r\\n--{boundary}--\\r\\n").encode()
        request=urllib.request.Request("http://"+host+"/firmware",
            data=prefix+image+suffix,method="POST",headers={
                "Content-Type":f"multipart/form-data; boundary={boundary}",
                "X-Radio-OTA-Seq":str(seq),
                "X-Radio-OTA-SHA256":digest,
                "X-Radio-Signature":signature})
        with urllib.request.urlopen(request,timeout=timeout) as response:
            result=json.load(response)
        if not result.get("ok") or not result.get("updating"):
            raise RuntimeError("ESP32 firmware update not acknowledged")
        return result
