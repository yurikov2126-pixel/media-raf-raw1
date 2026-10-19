#!/usr/bin/env python3
"""MEDIA RAF RAW — Windows Radio Agent, manually started headphones pilot.

The GUI never saves the device token, enables a relay or starts at Windows login.
Hardware/ESP32 switching is intentionally unavailable in this build.
"""
import json
import os
import queue
import sys
import threading
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

from central_playout import STOP, run
from updater import check_latest, stage_update
from esp32_local import send_heartbeat
from local_settings import load_settings, save_settings
from startup import startup_enabled, set_startup

AGENT_VERSION = '0.3.0'


def default_data_dir():
    base = os.environ.get("LOCALAPPDATA") or str(Path.home())
    return str(Path(base) / "MediaRafRaw" / "RadioAgent")


def find_vlc():
    candidates = [
        Path(os.environ.get("ProgramFiles", "C:/Program Files")) / "VideoLAN/VLC/vlc.exe",
        Path(os.environ.get("ProgramFiles(x86)", "C:/Program Files (x86)")) / "VideoLAN/VLC/vlc.exe",
    ]
    return str(next((file for file in candidates if file.is_file()), candidates[0]))


class LogSink:
    def __init__(self, output):
        self.output = output

    def write(self, text):
        if text.strip():
            self.output.put(("log", text.strip()))

    def flush(self):
        pass


class Config:
    def __init__(self, server, data_dir, vlc, offline_grace=900, esp32_host='', esp32_secret=''):
        self.server = server
        self.data_dir = data_dir
        self.vlc = vlc
        self.offline_grace = offline_grace
        self.esp32_host = esp32_host
        self.esp32_secret = esp32_secret


class RadioAgentApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("MEDIA · РАФ · RAW — Windows Radio Agent")
        self.geometry("840x760")
        self.minsize(650, 630)
        self.configure(bg="#10162d")
        try:
            self.iconbitmap(str(Path(getattr(sys,"_MEIPASS",Path(__file__).parent)) / "brand.ico"))
        except (OSError,tk.TclError):
            pass
        self.messages = queue.Queue()
        self.worker = None
        self.status = tk.StringVar(value="Остановлен · оборудование не управляется")
        self.server = tk.StringVar(value="https://mediarafraw.ru")
        self.vlc = tk.StringVar(value=find_vlc())
        self.data_dir = tk.StringVar(value=default_data_dir())
        self.token = tk.StringVar()
        prefs = load_settings(default_data_dir())
        self.server.set(prefs.get("server",self.server.get()))
        self.vlc.set(prefs.get("vlc",self.vlc.get()))
        self.esp32_ip = tk.StringVar(value=prefs.get("esp32_ip",os.environ.get("RADIO_ESP32_IP","")))
        self.esp32_secret = tk.StringVar(value=os.environ.get("RADIO_ESP32_SECRET",""))
        self.esp32_status = tk.StringVar(value="Не проверен")
        self.auto_start = tk.BooleanVar(value=startup_enabled())
        self.agreed = tk.BooleanVar(value=False)
        self.pending_update = None
        self.update_running = False

        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure("Main.TFrame", background="#10162d")
        style.configure("Main.TLabel", background="#10162d", foreground="#f8fafc", font=("Segoe UI", 10))
        style.configure("Title.TLabel", background="#10162d", foreground="#f8fafc", font=("Segoe UI", 18, "bold"))
        style.configure("TCheckbutton", background="#10162d", foreground="#f8fafc")
        style.configure("TEntry", fieldbackground="#f8fafc", foreground="#111827")
        wrap = ttk.Frame(self, padding=22, style="Main.TFrame")
        wrap.pack(fill="both", expand=True)
        ttk.Label(wrap, text="◉  MEDIA · РАФ · RAW  /  RADIO AGENT", style="Title.TLabel").pack(anchor="w")
        ttk.Label(wrap, text="Центральный MP3 → локальный резерв только при потере связи",
                  style="Main.TLabel").pack(anchor="w", pady=(3, 15))

        self.row(wrap, "Адрес сервера", self.server)
        self.row(wrap, "Токен устройства (не сохраняется)", self.token, secret=True)
        self.row(wrap, "Путь к VLC", self.vlc, browse=True)
        self.row(wrap, "Кэш радиостанции", self.data_dir, browse=True, directory=True)
        esp=ttk.LabelFrame(wrap,text=" ESP32 · локальная инфраструктура ",padding=10)
        esp.pack(fill="x",pady=(13,3))
        self.row(esp,"IP ESP32 в сети Studio",self.esp32_ip)
        self.row(esp,"Секрет сопряжения (не сохраняется)",self.esp32_secret,secret=True)
        linkbar=ttk.Frame(esp,style="Main.TFrame")
        linkbar.pack(fill="x",pady=(8,2))
        ttk.Button(linkbar,text="Проверить связь",command=self.test_esp32).pack(side="left")
        ttk.Label(linkbar,textvariable=self.esp32_status,style="Main.TLabel").pack(side="left",padx=12)
        ttk.Label(esp,text="Реле GPIO 13 не управляется; только безопасная диагностика",style="Main.TLabel").pack(anchor="w")
        ttk.Checkbutton(wrap,text="Открывать агент при входе в Windows (без запуска эфира)",
                        variable=self.auto_start,command=self.configure_startup).pack(anchor="w",pady=(8,1))
        ttk.Button(wrap,text="Сохранить настройки",command=self.save_preferences).pack(anchor="w",pady=(1,4))
        ttk.Checkbutton(wrap, text="Тест только в наушниках. Усилитель и ESP32 отключены.",
                        variable=self.agreed).pack(anchor="w", pady=(12, 7))
        ttk.Label(wrap, textvariable=self.status, style="Main.TLabel").pack(anchor="w", pady=5)
        bar = ttk.Frame(wrap, style="Main.TFrame")
        bar.pack(fill="x", pady=10)
        self.start_btn = ttk.Button(bar, text="▶ Запустить агент", command=self.start)
        self.start_btn.pack(side="left")
        self.stop_btn = ttk.Button(bar, text="■ Остановить", command=self.stop, state="disabled")
        self.stop_btn.pack(side="left", padx=10)
        update_bar = ttk.Frame(wrap, style="Main.TFrame")
        update_bar.pack(fill="x", pady=(0, 8))
        ttk.Label(update_bar, text="Версия " + AGENT_VERSION, style="Main.TLabel").pack(side="left")
        self.update_btn = ttk.Button(update_bar, text="Проверить обновления", command=self.check_updates)
        self.update_btn.pack(side="left", padx=12)
        self.install_btn = ttk.Button(update_bar, text="Перезапустить обновлённую версию",
                                      command=self.install_update, state="disabled")
        self.install_btn.pack(side="left")
        self.log = tk.Text(wrap, height=10, bg="#1e293b", fg="#e2e8f0",
                           insertbackground="white", relief="flat", state="disabled",
                           font=("Consolas", 10), wrap="word")
        self.log.pack(fill="both", expand=True)
        self.protocol("WM_DELETE_WINDOW", self.close)
        self.after(150, self.drain)
        self.after(5000, self.check_updates)
        self.after(3000,self.idle_esp32_heartbeat)

    def row(self, parent, name, variable, secret=False, browse=False, directory=False):
        ttk.Label(parent, text=name, style="Main.TLabel").pack(anchor="w", pady=(6, 2))
        line = ttk.Frame(parent, style="Main.TFrame")
        line.pack(fill="x")
        ttk.Entry(line, textvariable=variable, show="*" if secret else "").pack(
            side="left", fill="x", expand=True)
        if browse:
            def choose():
                if directory:
                    result = filedialog.askdirectory()
                else:
                    result = filedialog.askopenfilename(filetypes=[("VLC Player", "vlc.exe"), ("Executable", "*.exe")])
                if result:
                    variable.set(result)
            ttk.Button(line, text="Выбрать", command=choose).pack(side="left", padx=(8, 0))

    def start(self):
        if self.worker and self.worker.is_alive():
            return
        url, token = self.server.get().strip(), self.token.get().strip()
        vlc = Path(self.vlc.get().strip())
        if not url.startswith("https://") or not token.startswith("rr_"):
            messagebox.showerror("Параметры", "Нужны HTTPS-адрес и действующий токен rr_...")
            return
        if not vlc.is_file() or vlc.name.lower() != "vlc.exe":
            messagebox.showerror("VLC", "Укажите установленный vlc.exe")
            return
        if not self.agreed.get():
            messagebox.showwarning("Безопасность", "Подтвердите тест только в наушниках")
            return
        self.save_preferences(silent=True)
        args = Config(url, self.data_dir.get().strip(), str(vlc),esp32_host=self.esp32_ip.get().strip(),esp32_secret=self.esp32_secret.get().strip())
        STOP.clear()
        self.start_btn.configure(state="disabled")
        self.stop_btn.configure(state="normal")
        self.status.set("Подключение к центральному эфиру…")
        self.messages.put(("log", "Агент запущен вручную. Реле/ESP32 не задействованы."))
        # Never log tokens or put them in subprocess arguments.
        def task():
            saved = sys.stdout
            try:
                sys.stdout = LogSink(self.messages)
                run(args, token)
            except Exception as exc:
                self.messages.put(("log", "Агент остановлен: " + type(exc).__name__))
            finally:
                sys.stdout = saved
                self.messages.put(("stopped", ""))
        self.worker = threading.Thread(target=task, daemon=True, name="radio-agent")
        self.worker.start()

    def save_preferences(self,silent=False):
        try:
            save_settings(default_data_dir(),{"server":self.server.get().strip(),
                "vlc":self.vlc.get().strip(),"esp32_ip":self.esp32_ip.get().strip()})
            if not silent:
                self.messages.put(("log","Настройки сохранены (без токена и секрета ESP32)"))
        except OSError:
            self.messages.put(("log","Не удалось сохранить настройки"))

    def configure_startup(self):
        try:
            set_startup(self.auto_start.get())
            self.messages.put(("log","Автозапуск окна Windows: "+("включён" if self.auto_start.get() else "выключен")))
        except (OSError,RuntimeError) as error:
            self.auto_start.set(startup_enabled())
            messagebox.showerror("Автозапуск",str(error))

    def idle_esp32_heartbeat(self):
        # The Windows app remains alive outside a playback session. A STOPPED
        # heartbeat proves connectivity but never grants amplifier permission.
        if not (self.worker and self.worker.is_alive()):
            host=self.esp32_ip.get().strip()
            secret=self.esp32_secret.get().strip()
            if host and secret:
                def task():
                    try:
                        send_heartbeat(host,secret,"STOPPED",False,False)
                        self.messages.put(("idle_esp32_ok",None))
                    except Exception as error:
                        self.messages.put(("idle_esp32_error",type(error).__name__))
                threading.Thread(target=task,daemon=True).start()
        self.after(3000,self.idle_esp32_heartbeat)

    def test_esp32(self):
        host=self.esp32_ip.get().strip()
        secret=self.esp32_secret.get().strip()
        if not host or not secret:
            self.esp32_status.set("Введите IP и секрет")
            return
        self.esp32_status.set("Проверяем…")
        self.save_preferences(silent=True)
        def task():
            try:
                send_heartbeat(host,secret,"STOPPED",False,False)
                self.messages.put(("esp32_ok","Связь подтверждена · SAFE_PILOT"))
            except Exception as error:
                self.messages.put(("esp32_error",type(error).__name__+(": неверный секрет (403)" if getattr(error,"code",None)==403 else "")))
        threading.Thread(target=task,daemon=True).start()

    def check_updates(self):
        if self.update_running:
            return
        self.update_running = True
        self.update_btn.configure(state="disabled")
        def job():
            try:
                info = check_latest(AGENT_VERSION)
                self.messages.put(("update_info", info))
            except Exception:
                self.messages.put(("log", "Не удалось проверить обновления; агент продолжает работать"))
            finally:
                self.messages.put(("update_check_done", ""))
        threading.Thread(target=job, daemon=True).start()

    def install_update(self):
        if self.worker and self.worker.is_alive():
            messagebox.showwarning("Эфир", "Сначала остановите агент. Обновление во время воспроизведения запрещено.")
            return
        if not self.pending_update or not Path(self.pending_update).is_file():
            return
        if not messagebox.askyesno("Обновление", "Запустить новую версию? Текущее приложение будет закрыто."):
            return
        os.startfile(str(self.pending_update))
        self.destroy()

    def stop(self):
        STOP.set()
        self.status.set("Остановка…")
        self.stop_btn.configure(state="disabled")

    def close(self):
        if self.worker and self.worker.is_alive():
            self.stop()
            self.after(200, self.close_when_stopped)
        else:
            self.destroy()

    def close_when_stopped(self):
        if self.worker and self.worker.is_alive():
            self.after(200, self.close_when_stopped)
        else:
            self.destroy()

    def drain(self):
        try:
            while True:
                action, value = self.messages.get_nowait()
                if action == "log":
                    if value.startswith("PRIMARY_CONNECTING"):
                        self.status.set("Центральный MP3 · подключение")
                    elif value.startswith("LOCAL_STANDBY"):
                        self.status.set("Резерв · потеря центрального эфира")
                    elif value.startswith("PLAYBACK_PERMISSION_EXPIRED"):
                        self.status.set("Разрешение на воспроизведение истекло")
                    self.log.configure(state="normal")
                    self.log.insert("end", value + "\n")
                    self.log.see("end")
                    if float(self.log.index("end-1c").split(".")[0]) > 300:
                        self.log.delete("1.0", "60.0")
                    self.log.configure(state="disabled")
                elif action == "idle_esp32_ok":
                    self.esp32_status.set("На связи · SAFE_PILOT")
                elif action == "idle_esp32_error":
                    self.esp32_status.set("Нет связи: "+value)
                elif action == "esp32_ok":
                    self.esp32_status.set(value)
                    self.messages.put(("log","ESP32: heartbeat доставлен"))
                elif action == "esp32_error":
                    self.esp32_status.set("Ошибка подключения")
                    self.messages.put(("log","ESP32: "+value))
                elif action == "update_info":
                    if value:
                        self.messages.put(("log", "Новая версия " + value["version"] + ": проверяем загрузку…"))
                        def stage():
                            try:
                                file = stage_update(value, Path(default_data_dir()) / "updates")
                                self.messages.put(("update_staged", str(file)))
                            except Exception:
                                self.messages.put(("log", "Обновление не прошло проверку или загрузку"))
                        threading.Thread(target=stage, daemon=True).start()
                    else:
                        self.messages.put(("log", "Обновлений нет"))
                elif action == "update_staged":
                    self.pending_update = value
                    self.messages.put(("log", "Обновление готово. Сначала остановите агент, затем перезапустите новую версию."))
                    self.install_btn.configure(state="normal")
                elif action == "update_check_done":
                    self.update_running = False
                    self.update_btn.configure(state="normal")
                elif action == "stopped":
                    self.status.set("Остановлен · оборудование не управляется")
                    self.start_btn.configure(state="normal")
                    self.stop_btn.configure(state="disabled")
        except queue.Empty:
            pass
        self.after(150, self.drain)


if __name__ == "__main__":
    RadioAgentApp().mainloop()
