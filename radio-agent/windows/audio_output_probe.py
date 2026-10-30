"""Read-only Windows default audio-output endpoint diagnostic.

Uses Windows PowerShell to inspect enabled audio render endpoints.
This does not open an audio stream and does not prove audible output.
The helper is best-effort and timeout bounded; Windows PowerShell may not be installed.
"""
import json
import subprocess
import sys

SCRIPT = r"""
$ErrorActionPreference = 'Stop'
$items = @(Get-PnpDevice -Class AudioEndpoint -ErrorAction Stop |
 Where-Object { $_.FriendlyName } |
 Select-Object -First 12 FriendlyName, Status)
@($items) | ConvertTo-Json -Compress -Depth 3
"""

def inspect_outputs(timeout=3):
    if sys.platform != 'win32':
        return {'state':'UNSUPPORTED','name':None,'count':None}
    try:
        result=subprocess.run(
            ['powershell.exe','-NoProfile','-NonInteractive','-Command',SCRIPT],
            check=True,capture_output=True,text=True,timeout=timeout,
            creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        raw=json.loads(result.stdout)
        entries=raw if isinstance(raw,list) else [raw] if isinstance(raw,dict) else []
        good=[e for e in entries if e.get('Status')=='OK']
        return {'state':'AVAILABLE' if good else 'UNAVAILABLE',
                'name':str(good[0].get('FriendlyName',''))[:120] if good else None,
                'count':len(good)}
    except (OSError,ValueError,subprocess.SubprocessError):
        return {'state':'UNKNOWN','name':None,'count':None}
