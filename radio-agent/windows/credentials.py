"""Encrypted per-user credentials using Windows DPAPI; never plaintext JSON."""
import base64
import ctypes
import json
import os
from ctypes import wintypes
from pathlib import Path

class DATA_BLOB(ctypes.Structure):
    _fields_=[("cbData",wintypes.DWORD),("pbData",ctypes.POINTER(ctypes.c_ubyte))]

def _blob(data):
    buffer=ctypes.create_string_buffer(data)
    return DATA_BLOB(len(data),ctypes.cast(buffer,ctypes.POINTER(ctypes.c_ubyte))),buffer

def _crypt(data,encrypt):
    if os.name!="nt":
        raise RuntimeError("Windows DPAPI is required to save credentials")
    input_blob,input_buffer=_blob(data)
    output=DATA_BLOB()
    crypt32=ctypes.windll.crypt32
    fn=crypt32.CryptProtectData if encrypt else crypt32.CryptUnprotectData
    if encrypt:
        ok=fn(ctypes.byref(input_blob),None,None,None,None,0x01,ctypes.byref(output))
    else:
        ok=fn(ctypes.byref(input_blob),None,None,None,None,0x01,ctypes.byref(output))
    if not ok:
        raise OSError("Windows DPAPI operation failed")
    try:
        return ctypes.string_at(output.pbData,output.cbData)
    finally:
        ctypes.windll.kernel32.LocalFree(output.pbData)

def credential_path(data_dir):
    return Path(data_dir)/"credentials.dpapi"

def save_credentials(data_dir, token, esp32_secret):
    values={"token":token,"esp32_secret":esp32_secret}
    path=credential_path(data_dir)
    path.parent.mkdir(parents=True,exist_ok=True)
    encrypted=_crypt(json.dumps(values,ensure_ascii=False).encode("utf-8"),True)
    temporary=path.with_suffix(".tmp")
    try:
        temporary.write_bytes(encrypted)
        os.replace(temporary,path)
    finally:
        temporary.unlink(missing_ok=True)

def load_credentials(data_dir):
    path=credential_path(data_dir)
    try:
        data=json.loads(_crypt(path.read_bytes(),False).decode("utf-8"))
        if not isinstance(data,dict):return {}
        return {k:data.get(k,"") for k in ("token","esp32_secret") if isinstance(data.get(k),str)}
    except FileNotFoundError:
        return {}
    except (OSError,ValueError,UnicodeError):
        return {}

def clear_credentials(data_dir):
    credential_path(data_dir).unlink(missing_ok=True)
