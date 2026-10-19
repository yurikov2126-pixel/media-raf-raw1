"""Report ESP32 health from the LAN-connected Windows Agent to the platform."""
import json
from urllib.request import Request, urlopen

def report_status(server, token, ip, timeout=3):
    if not server.startswith("https://") or not token.startswith("rr_"):
        raise ValueError("Server HTTPS and device token required")
    from ipaddress import ip_address
    address=ip_address(ip)
    if address.version!=4 or not address.is_private:
        raise ValueError("ESP32 must have a private IPv4")
    with urlopen("http://"+str(address)+"/health",timeout=timeout) as response:
        status=json.load(response)
    if status.get("device")!="MEDIA_RAF_RAW_ESP32" or status.get("mode")!="SAFE_PILOT" or status.get("relayOutputEnabled") is not False:
        raise ValueError("Unexpected ESP32 firmware or physical output mode")
    payload=json.dumps({"ip":str(address),"status":status}).encode("utf-8")
    req=Request(server.rstrip("/")+"/api/radio-agent/agent/esp32-status",
        data=payload,headers={"Authorization":"Bearer "+token,"Content-Type":"application/json"},
        method="POST")
    with urlopen(req,timeout=timeout) as response:
        return json.load(response)
