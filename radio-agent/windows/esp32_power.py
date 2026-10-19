"""Signed ESP32 power lease transport. Windows agent is the sole LAN controller."""
import hashlib
import hmac
import ipaddress
import json
import threading
from urllib.request import Request,urlopen

_lock=threading.Lock()
_sequence_by_boot={}
def _lan(ip):
    address=ipaddress.ip_address(ip)
    if address.version!=4 or not address.is_private:
        raise ValueError("Private IPv4 address required")
    return str(address)

def signed_power(ip,secret,permit,lease_ms=8000,timeout=3):
    host=_lan(ip)
    if not isinstance(secret,str) or len(secret)<32:
        raise ValueError("ESP32 pairing secret must be 32+ characters")
    if type(permit) is not bool or not isinstance(lease_ms,int):
        raise ValueError("Invalid power command")
    if permit and not 1<=lease_ms<=9000:
        raise ValueError("Power lease must be 1..9000ms")
    if not permit:lease_ms=0
    with _lock:
        with urlopen("http://"+host+"/health",timeout=timeout) as response:
            health=json.load(response)
        if health.get("mode")!="POWER_CONTROL_V1" or health.get("relayActiveLevel")!="HIGH" or health.get("relayGpio")!=13:
            raise RuntimeError("ESP32 physical control firmware not verified")
        boot=health.get("bootNonce")
        if not isinstance(boot,str) or len(boot)!=16 or any(c not in "0123456789abcdef" for c in boot):
            raise RuntimeError("Invalid ESP32 boot nonce")
        key=(host,boot)
        seq=_sequence_by_boot.get(key,0)+1
        if seq>=2**31:raise RuntimeError("Sequence exhausted: reboot ESP32")
        message=f"{boot}:{seq}:{1 if permit else 0}:{lease_ms}"
        signature=hmac.new(secret.encode(),message.encode(),hashlib.sha256).hexdigest()
        payload=json.dumps({"seq":seq,"permit":permit,"leaseMs":lease_ms}).encode()
        req=Request("http://"+host+"/power",data=payload,
            headers={"Content-Type":"application/json","X-Radio-Signature":signature},method="POST")
        with urlopen(req,timeout=timeout) as response:
            result=json.load(response)
        _sequence_by_boot[key]=seq
        if result.get("ok") is not True:raise RuntimeError("ESP32 did not accept power command")
        return result

def fetch_intent(server,token,timeout=4):
    if not server.startswith("https://") or not token.startswith("rr_"):
        raise ValueError("HTTPS and Radio Agent token required")
    req=Request(server.rstrip("/")+"/api/radio-agent/agent/amplifier-intent",
        headers={"Authorization":"Bearer "+token})
    with urlopen(req,timeout=timeout) as response:
        return json.load(response)
