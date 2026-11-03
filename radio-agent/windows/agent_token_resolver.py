"""Resolve the Windows Radio Agent device token without command-line secrets.

Precedence: explicit per-process environment variable, then the *same*
Windows GUI DPAPI credential store. Never search arbitrary directories,
log secrets, or create a second store.
"""
import os
import re
from pathlib import Path

from credentials import load_credentials

TOKEN_PATTERN=re.compile(r"rr_[a-f0-9]{64}\Z")

def default_gui_data_dir(*, environ=None, home=None):
    env=os.environ if environ is None else environ
    base=env.get('LOCALAPPDATA') or (str(Path.home()) if home is None else str(home))
    return Path(base)/'MediaRafRaw'/'RadioAgent'

def resolve_agent_token(*, environ=None, credential_loader=load_credentials, home=None):
    env=os.environ if environ is None else environ
    supplied=env.get('RADIO_AGENT_TOKEN')
    if supplied:
        if not isinstance(supplied,str) or TOKEN_PATTERN.fullmatch(supplied) is None:
            raise ValueError('INVALID_RADIO_AGENT_TOKEN_ENV')
        return supplied,'ENVIRONMENT'
    saved=credential_loader(default_gui_data_dir(environ=env,home=home))
    token=saved.get('token','') if isinstance(saved,dict) else ''
    if not isinstance(token,str) or TOKEN_PATTERN.fullmatch(token) is None:
        raise ValueError('NO_SAVED_DEVICE_TOKEN')
    return token,'WINDOWS_DPAPI'
