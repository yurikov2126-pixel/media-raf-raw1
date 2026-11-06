"""Read only a tightly allowlisted subset of Agent power diagnostics.

Never transmit logs, URLs, tokens, secret-bearing fields or exceptions.
The original rotating file remains local.
"""
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

KINDS=frozenset(("INTENT_RESPONSE","INTENT_ERROR","POWER_COMMAND",
                 "POWER_ERROR","RELAY_TRANSITION"))
SAFE_CODE=re.compile(r"^[A-Z][A-Z0-9_]{0,63}$")
LINE=re.compile(r"^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d,\d{3}) ([A-Z_]+) (\{.*\})$")
MAX_EVENTS=16
MAX_TAIL_BYTES=65536

def read_power_evidence(logfile,now=None):
    now=now or datetime.now(timezone.utc)
    results=[]
    try:
        path=Path(logfile)
        with path.open("rb") as stream:
            stream.seek(0,2)
            length=stream.tell()
            stream.seek(max(0,length-MAX_TAIL_BYTES))
            raw=stream.read(MAX_TAIL_BYTES)
        if length>MAX_TAIL_BYTES:
            raw=raw.split(b"\n",1)[-1]
    except (OSError,ValueError):
        return results
    for line in raw.decode("utf-8",errors="replace").splitlines()[-150:]:
        match=LINE.fullmatch(line)
        if not match or match.group(2) not in KINDS:
            continue
        try:
            local=datetime.strptime(match.group(1),"%Y-%m-%d %H:%M:%S,%f").astimezone()
            age=(now-local.astimezone(timezone.utc)).total_seconds()
            data=json.loads(match.group(3))
        except (ValueError,TypeError):
            continue
        if age < -60 or age > 600 or not isinstance(data,dict):
            continue
        result={"id":hashlib.sha256(line.encode("utf-8")).hexdigest()[:24],
                "at":local.isoformat(),"kind":match.group(2)}
        if type(data.get("permit")) is bool:
            result["permit"]=data["permit"]
        for field in ("reason","transition","phase","errorType"):
            value=data.get(field)
            if isinstance(value,str) and SAFE_CODE.fullmatch(value):
                result[field]=value
        code=data.get("httpStatus")
        if type(code) is int and 100<=code<=599:
            result["httpStatus"]=code
        results.append(result)
    return results[-MAX_EVENTS:]
