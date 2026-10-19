"""User opt-in Windows start-at-login; opens GUI only, never starts playback."""
import os
import sys
from pathlib import Path

RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
VALUE = "MediaRafRawRadioAgent"

def launch_command():
    executable = Path(sys.executable if getattr(sys, "frozen", False) else __file__).resolve()
    if not getattr(sys, "frozen", False):
        return None  # Startup requires a packaged EXE.
    return '"' + str(executable) + '"'

def startup_enabled():
    if os.name != "nt":
        return False
    import winreg
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY) as key:
            command, _ = winreg.QueryValueEx(key, VALUE)
        return command == launch_command()
    except FileNotFoundError:
        return False

def set_startup(enabled):
    if os.name != "nt":
        raise RuntimeError("Windows-only")
    import winreg
    if enabled:
        command = launch_command()
        if command is None:
            raise RuntimeError("Autostart requires packaged EXE")
        with winreg.CreateKeyEx(winreg.HKEY_CURRENT_USER, RUN_KEY, 0, winreg.KEY_SET_VALUE) as key:
            winreg.SetValueEx(key, VALUE, 0, winreg.REG_SZ, command)
    else:
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY, 0, winreg.KEY_SET_VALUE) as key:
                winreg.DeleteValue(key, VALUE)
        except FileNotFoundError:
            pass
