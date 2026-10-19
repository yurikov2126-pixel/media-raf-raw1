"""Non-secret GUI preferences. Pairing secret is supplied per session."""
import json
from pathlib import Path

def load_settings(data_dir):
    try:
        data=json.loads((Path(data_dir)/"settings.json").read_text(encoding="utf-8"))
        return data if isinstance(data,dict) else {}
    except (OSError,ValueError):
        return {}

def save_settings(data_dir,values):
    path=Path(data_dir)/"settings.json"
    path.parent.mkdir(parents=True,exist_ok=True)
    allowed={key:str(values.get(key,"")) for key in ("server","vlc","esp32_ip")}
    allowed["power_arm"]=values.get("power_arm") is True
    path.write_text(json.dumps(allowed,ensure_ascii=False,indent=2),encoding="utf-8")
