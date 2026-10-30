#!/usr/bin/env python3
"""MEDIA RAF RAW — Windows Radio Agent, manually started headphones pilot.

The GUI never saves the device token, enables a relay or starts at Windows login.
Hardware/ESP32 switching is intentionally unavailable in this build.
"""
import json
import logging
from logging.handlers import RotatingFileHandler
import os
import queue
import sys
import threading
import webbrowser
import tkinter as tk
from pathlib import Path
from urllib.error import HTTPError
from tkinter import filedialog, messagebox, ttk

from central_playout import STOP, run, PLAYBACK_STATE, MCHS_AUDIO_START, MCHS_AUDIO_STOP, MCHS_AUDIO_ARMED, MCHS_LAB_ONE_SHOT, MCHS_LAB_ONE_SHOT_EXPIRES, MCHS_LAB_ONE_SHOT_LOCK, MCHS_LAB_OBSERVED
from updater import check_latest, stage_update, UpdateCheckError
from esp32_local import send_heartbeat, restart_esp32, upload_firmware
from esp32_telemetry import report_status
from esp32_power import signed_power,fetch_intent
from power_policy import allowed_power
import time
from local_settings import load_settings, save_settings
from startup import startup_enabled, set_startup
from credentials import load_credentials, save_credentials, clear_credentials

AGENT_VERSION = '0.5.8'

def power_diagnostic_logger():
    path=Path(default_data_dir()) / "logs"
    path.mkdir(parents=True,exist_ok=True)
    logger=logging.getLogger("media_raf_raw.radio.power")
    if not logger.handlers:
        handler=RotatingFileHandler(path / "power-diagnostics.log",
                                    maxBytes=2*1024*1024,backupCount=3,encoding="utf-8")
        handler.setFormatter(logging.Formatter("%(asctime)s %(message)s"))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.propagate=False
    return logger

def record_power_event(event,**fields):
    # Strict allowlist: credentials, secrets, headers, URLs and raw exceptions
    # must never be written to diagnostics.
    safe={}
    for key in ("result","durationMs","httpStatus","permit","reason","policyMode",
                "mode","intentAgeSeconds","authorizationAgeSeconds","errorType",
                "armed","leaseMs","phase"):
        value=fields.get(key)
        if value is not None:
            safe[key]=str(value)[:120] if isinstance(value,str) else value
    try:
        power_diagnostic_logger().info("%s %s",event,json.dumps(safe,ensure_ascii=False))
    except OSError:
        pass



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
        self.geometry("920x690")
        self.minsize(720, 540)
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
        saved_creds=load_credentials(default_data_dir())
        self.token = tk.StringVar(value=saved_creds.get("token",""))
        self.remember_credentials = tk.BooleanVar(value=bool(saved_creds))
        prefs = load_settings(default_data_dir())
        self.server.set(prefs.get("server",self.server.get()))
        self.vlc.set(prefs.get("vlc",self.vlc.get()))
        self.esp32_ip = tk.StringVar(value=prefs.get("esp32_ip",os.environ.get("RADIO_ESP32_IP","")))
        self.esp32_secret = tk.StringVar(value=saved_creds.get("esp32_secret",os.environ.get("RADIO_ESP32_SECRET","")))
        self.esp32_status = tk.StringVar(value="Не проверен")
        self.esp32_platform_status = tk.StringVar(value="Ожидает настройки")
        self.auto_start = tk.BooleanVar(value=startup_enabled())
        self.power_arm = tk.BooleanVar(value=prefs.get("power_arm") is True)
        self.power_status = tk.StringVar(value="Усилитель: безопасный OFF")
        self.broadcast_status = tk.StringVar(value="● Эфир выключен")
        self.audio_status = tk.StringVar(value="● Источник: ожидание")
        self.api_status = tk.StringVar(value="● Сервер: ожидание")
        self.last_power_intent = None
        self.last_power_received = 0.0
        self.power_off_candidate_since = None
        self.last_power_was_auto = False
        self.power_busy = False
        self.agreed = tk.BooleanVar(value=False)
        self.pending_update = None
        self.update_running = False

        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure("Main.TFrame", background="#10162d")
        style.configure("Main.TLabel", background="#10162d", foreground="#f8fafc", font=("Segoe UI", 10))
        style.configure("Title.TLabel", background="#10162d", foreground="#f8fafc", font=("Segoe UI", 18, "bold"))
        style.configure("TCheckbutton", background="#10162d", foreground="#f8fafc")
        style.map("TCheckbutton",background=[("active","#10162d")],foreground=[("active","#ffffff"),("disabled","#94a3b8")])
        style.configure("Status.TLabelframe",background="#172441",foreground="#f8fafc",bordercolor="#52698f",relief="solid")
        style.configure("Status.TLabelframe.Label",background="#10162d",foreground="#e2e8f0",font=("Segoe UI",11,"bold"))
        style.configure("Status.TLabel",background="#172441",foreground="#ffffff",font=("Segoe UI",11,"bold"))
        style.configure("TEntry", fieldbackground="#182443", foreground="#f8fafc", padding=(8,7))
        style.configure("TNotebook", background="#10162d", borderwidth=0)
        style.configure("TNotebook.Tab", background="#182443", foreground="#f8fafc", padding=(16,9))
        style.map("TNotebook.Tab", background=[("selected","#4f46e5")], foreground=[("selected","#ffffff")])
        style.configure("TButton", background="#293b62", foreground="#ffffff", padding=(11,7))
        style.map("TButton", background=[("active","#4f46e5"),("disabled","#334155")],foreground=[("disabled","#cbd5e1")])
        style.configure("Live.TButton",background="#2563eb",foreground="#ffffff",padding=(16,10),font=("Segoe UI",11,"bold"))
        style.map("Live.TButton",background=[("active","#1d4ed8"),("disabled","#334155")])
        style.configure("Stop.TButton",background="#9f1239",foreground="#ffffff",padding=(16,10),font=("Segoe UI",11,"bold"))
        style.map("Stop.TButton",background=[("active","#be123c"),("disabled","#334155")])
        wrap = ttk.Frame(self, padding=22, style="Main.TFrame")
        wrap.pack(fill="both", expand=True)
        ttk.Label(wrap, text="◉  MEDIA · РАФ · RAW  /  RADIO AGENT", style="Title.TLabel").pack(anchor="w")
        ttk.Label(wrap, text="Центральный MP3 → локальный резерв только при потере связи",
                  style="Main.TLabel").pack(anchor="w", pady=(3, 15))

        tabs = ttk.Notebook(wrap)
        tabs.pack(fill="both", expand=True, pady=(5, 0))
        air_shell, air = self.scroll_tab(tabs)
        links_shell, links = self.scroll_tab(tabs)
        settings_shell, settings = self.scroll_tab(tabs)
        tabs.add(air_shell, text="  Эфир  ")
        tabs.add(links_shell, text="  Подключения  ")
        tabs.add(settings_shell, text="  Настройки  ")

        ttk.Label(air, text="Эфирная аппаратная", style="Title.TLabel").pack(anchor="w", pady=(0, 5))
        dashboard=ttk.LabelFrame(air,text="  СОСТОЯНИЕ СТАНЦИИ  ",style="Status.TLabelframe",padding=14)
        dashboard.pack(fill="x",pady=(5,12))
        for var in (self.broadcast_status,self.audio_status,self.api_status,self.power_status):
            ttk.Label(dashboard,textvariable=var,style="Status.TLabel").pack(anchor="w",pady=3)
        ttk.Label(air, textvariable=self.status, style="Main.TLabel").pack(anchor="w", pady=(0, 9))
        ttk.Checkbutton(air, text="Тест в наушниках · усилитель не включается",
                        variable=self.agreed).pack(anchor="w", pady=(0, 9))
        bar = ttk.Frame(air, style="Main.TFrame")
        bar.pack(fill="x", pady=(0, 10))
        self.start_btn = ttk.Button(bar, text="▶ Включить эфир", command=self.start,style="Live.TButton")
        self.start_btn.pack(side="left")
        self.stop_btn = ttk.Button(bar, text="■ Остановить эфир", command=self.stop, state="disabled",style="Stop.TButton")
        self.stop_btn.pack(side="left", padx=10)
        trial_bar=ttk.Frame(air,style="Main.TFrame")
        trial_bar.pack(fill="x",pady=(0,9))
        ttk.Button(trial_bar,text="Учебный звук МЧС (кабель PA отключён)",
                   command=self.start_mchs_audio_trial).pack(side="left")
        ttk.Button(trial_bar,text="СТОП МЧС / вернуть радио",
                   command=self.stop_mchs_audio_trial).pack(side="left",padx=8)
        ttk.Button(air,text="Разрешить ОДНО учебное событие МЧС (60 секунд)",
                   command=self.arm_mchs_lab_one_shot).pack(anchor="w",pady=(0,7))
        ttk.Label(air,text="Только с физически отключённым кабелем к AA-300. Макс. 30 секунд.",
                  style="Main.TLabel").pack(anchor="w",pady=(0,7))
        ttk.Label(air, text="Журнал событий", style="Main.TLabel").pack(anchor="w")
        self.log = tk.Text(air, height=13, bg="#182443", fg="#f1f5f9",
                           insertbackground="white", relief="flat", state="disabled",
                           font=("Consolas", 10), wrap="word", padx=10, pady=10)
        self.log.pack(fill="both", expand=True, pady=(6, 0))

        self.row(links, "Адрес сервера", self.server)
        self.row(links, "Токен радиокомпьютера (не сохраняется)", self.token, secret=True)
        self.row(links, "Путь к VLC", self.vlc, browse=True)
        self.row(links, "Кэш радиостанции", self.data_dir, browse=True, directory=True)
        ttk.Separator(links).pack(fill="x", pady=15)
        ttk.Label(links, text="ESP32 · Студийная сеть", style="Title.TLabel").pack(anchor="w")
        self.row(links, "IP ESP32 в сети Studio", self.esp32_ip)
        self.row(links, "Секрет сопряжения (не сохраняется)", self.esp32_secret, secret=True)
        linkbar = ttk.Frame(links, style="Main.TFrame")
        linkbar.pack(fill="x", pady=(9, 4))
        ttk.Button(linkbar, text="Проверить связь", command=self.test_esp32).pack(side="left")
        ttk.Button(linkbar, text="Перезагрузить ESP32", command=self.reboot_esp32).pack(side="left",padx=8)
        ttk.Button(links, text="Перепрошить ESP32 (.bin)", command=self.flash_esp32).pack(anchor="w",pady=(5,0))
        ttk.Label(linkbar, textvariable=self.esp32_status, style="Main.TLabel").pack(side="left", padx=12)
        ttk.Label(links, textvariable=self.esp32_platform_status, style="Main.TLabel").pack(anchor="w", pady=(3, 0))
        ttk.Label(links, textvariable=self.power_status,style="Main.TLabel").pack(anchor="w",pady=(5,0))
        ttk.Button(links, text="Открыть журнал питания", command=self.open_power_diagnostics).pack(anchor="w",pady=(8,0))
        ttk.Button(links, text="Сохранить параметры", command=self.save_preferences).pack(anchor="w", pady=(12, 0))

        ttk.Label(settings, text="Настройки программы", style="Title.TLabel").pack(anchor="w", pady=(0, 10))
        ttk.Checkbutton(settings, text="Открывать при входе в Windows (без запуска эфира)",
                        variable=self.auto_start, command=self.configure_startup).pack(anchor="w", pady=7)
        ttk.Checkbutton(settings, text="Сохранять токены/секреты зашифрованными для текущего пользователя Windows",
                        variable=self.remember_credentials,command=self.save_preferences).pack(anchor="w", pady=7)
        ttk.Label(settings, text="Автозапуск открывает программу. Эфир включается только вручную.",style="Main.TLabel").pack(anchor="w", pady=5)
        ttk.Checkbutton(settings,text="Разрешить физическое управление реле GPIO13 (HIGH = ВКЛ)",
                        variable=self.power_arm,command=self.set_power_arm).pack(anchor="w",pady=7)
        ttk.Label(settings,text="Только для проверенного силового узла. При выключении опции отправляется OFF.",
                  style="Main.TLabel").pack(anchor="w")
        ttk.Label(settings, text="Версия " + AGENT_VERSION, style="Main.TLabel").pack(anchor="w", pady=(18, 6))
        update_bar = ttk.Frame(settings, style="Main.TFrame")
        update_bar.pack(fill="x", pady=(0, 8))
        self.update_btn = ttk.Button(update_bar, text="Проверить обновления", command=self.check_updates)
        self.update_btn.pack(side="left")
        ttk.Button(update_bar,text="Открыть релизы в браузере",command=lambda:webbrowser.open("https://github.com/yurikov2126-pixel/media-raf-raw1/releases")).pack(side="left",padx=8)
        self.install_btn = ttk.Button(settings, text="Перезапустить обновлённую версию",
                                      command=self.install_update, state="disabled")
        self.install_btn.pack(anchor="w", pady=8)
        ttk.Label(settings, text="Настройки сервера, IP и VLC сохраняются. Токены и секреты — только на текущий запуск.",
                  style="Main.TLabel", wraplength=620).pack(anchor="w", pady=(15, 0))
        self.protocol("WM_DELETE_WINDOW", self.close)
        self.after(150, self.drain)
        self.after(5000, self.check_updates)
        self.after(3000,self.idle_esp32_heartbeat)
        self.after(6500,self.report_esp32_status)
        self.after(2100,self.power_tick)

    def scroll_tab(self, tabs):
        """Scrollable pane that retains the full width of the current tab."""
        shell = ttk.Frame(tabs, style="Main.TFrame")
        canvas = tk.Canvas(shell, background="#10162d", highlightthickness=0,
                           borderwidth=0)
        scrollbar = ttk.Scrollbar(shell, orient="vertical", command=canvas.yview)
        canvas.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side="right", fill="y")
        canvas.pack(side="left", fill="both", expand=True)
        body = ttk.Frame(canvas, style="Main.TFrame", padding=12)
        window = canvas.create_window((0, 0), window=body, anchor="nw")
        body.bind("<Configure>", lambda _event: canvas.configure(
            scrollregion=canvas.bbox("all")))
        canvas.bind("<Configure>", lambda event: canvas.itemconfigure(
            window, width=event.width))

        def wheel(event):
            if event.num == 4:
                delta = -1
            elif event.num == 5:
                delta = 1
            elif getattr(event, "delta", 0):
                delta = -int(event.delta / 120) or (-1 if event.delta > 0 else 1)
            else:
                return
            canvas.yview_scroll(delta, "units")

        # Bind only when pointer is over this tab; never intercept text scrolling.
        def enter(_event):
            canvas.bind_all("<MouseWheel>", wheel)
            canvas.bind_all("<Button-4>", wheel)
            canvas.bind_all("<Button-5>", wheel)
        def leave(_event):
            canvas.unbind_all("<MouseWheel>")
            canvas.unbind_all("<Button-4>")
            canvas.unbind_all("<Button-5>")
        shell.bind("<Enter>", enter)
        shell.bind("<Leave>", leave)
        canvas.bind("<Enter>", enter)
        canvas.bind("<Leave>", leave)
        body.bind("<Enter>", enter)
        body.bind("<Leave>", leave)
        return shell, body

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
        self.broadcast_status.set("● Эфир запускается")
        self.messages.put(("log", "Агент запущен вручную. Реле/ESP32 не задействованы."))
        # Never log tokens or put them in subprocess arguments.
        def task():
            saved = sys.stdout
            try:
                sys.stdout = LogSink(self.messages)
                run(args, token)
            except Exception as exc:
                self.messages.put(("log", "Агент остановлен: " + type(exc).__name__ + (" · проверьте доступность сервера mediarafraw.ru и токен устройства" if isinstance(exc,(TimeoutError,OSError)) else "")))
            finally:
                sys.stdout = saved
                self.messages.put(("stopped", ""))
        self.worker = threading.Thread(target=task, daemon=True, name="radio-agent")
        self.worker.start()

    def save_preferences(self,silent=False):
        try:
            save_settings(default_data_dir(),{"server":self.server.get().strip(),
                "vlc":self.vlc.get().strip(),"esp32_ip":self.esp32_ip.get().strip(),"power_arm":self.power_arm.get()})
            if self.remember_credentials.get():
                save_credentials(default_data_dir(),self.token.get().strip(),self.esp32_secret.get().strip())
            else:
                clear_credentials(default_data_dir())
            if not silent:
                self.messages.put(("log","Настройки сохранены; секреты "+("зашифрованы Windows DPAPI" if self.remember_credentials.get() else "не сохранены")))
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

    def report_esp32_status(self):
        # Platform cannot access the LAN directly. Agent publishes ESP32 health
        # using the ordinary rr_ device token, without sending ESP32 pair secrets.
        host=self.esp32_ip.get().strip()
        token=self.token.get().strip()
        server=self.server.get().strip()
        if host:
            if not token.startswith("rr_"):
                self.messages.put(("esp32_report_state","Нет токена Windows Agent (rr_). Введите токен радиокомпьютера для отправки статуса на сайт."))
            elif not server.startswith("https://"):
                self.messages.put(("esp32_report_state","Укажите HTTPS-адрес сервера"))
            else:
                def work():
                    try:
                        report_status(server,token,host)
                        self.messages.put(("esp32_report_ok",None))
                    except Exception as error:
                        code=getattr(error,"code",None)
                        detail="HTTP "+str(code) if code else type(error).__name__
                        self.messages.put(("esp32_report_error",detail))
                threading.Thread(target=work,daemon=True).start()
        self.after(6500,self.report_esp32_status)

    def set_power_arm(self):
        if self.power_arm.get() and not messagebox.askyesno("Усилитель 220 В",
            "Подтвердите: HIGH включает реле GPIO13; силовой узел, защитный автомат, драйвер и OFF при сбросе проверены. Разрешить управление физическим питанием?"):
            self.power_arm.set(False)
        self.save_preferences(silent=True)
        if not self.power_arm.get():
            self.last_power_intent=None
            self.power_off_candidate_since=None
            self.last_power_was_auto=False
            self.power_status.set("Усилитель: управление отключено")

    def open_power_diagnostics(self):
        path=Path(default_data_dir())/"logs"/"power-diagnostics.log"
        if not path.exists():
            messagebox.showinfo("Диагностика питания","Журнал появится после первой проверки питания.")
            return
        try:
            os.startfile(str(path))
        except OSError as error:
            messagebox.showerror("Диагностика питания",type(error).__name__)

    def power_tick(self):
        # A failed fetch cannot create a fresh ON authorization. Relay self-OFF
        # occurs even if the Windows process is killed.
        if not self.power_busy and self.esp32_ip.get().strip() and len(self.esp32_secret.get().strip())>=32:
            self.power_busy=True
            host=self.esp32_ip.get().strip()
            secret=self.esp32_secret.get().strip()
            server=self.server.get().strip()
            token=self.token.get().strip()
            armed=self.power_arm.get()
            def job():
                permit=False
                started=time.monotonic()
                phase="intent"
                decision="NOT_ARMED"
                try:
                    if armed and token.startswith("rr_"):
                        try:
                            intent=fetch_intent(server,token)
                            self.messages.put(("api_status","● Сервер: разрешение получено"))
                            record_power_event("INTENT_RESPONSE",result="OK",durationMs=round((time.monotonic()-started)*1000),permit=intent.get("permit"),reason=intent.get("reason"),policyMode=intent.get("policyMode"),mode=PLAYBACK_STATE["mode"])
                            if intent.get("esp32Ip")!=host:
                                raise ValueError("ESP32 is not registered for this agent")
                            permit=intent.get("permit") is True and intent.get("hardwareExpected")=="POWER_CONTROL_V1"
                            # Ignore short false OFFs at the boundary between a
                            # scheduled show and its audio completion. Explicit
                            # emergency OFF, MANUAL OFF, revoked playback access and
                            # disabled hardware arming must always stop immediately.
                            now=time.monotonic()
                            auto_transition=(intent.get("policyMode")=="AUTO" and
                                intent.get("emergencyOff") is False and
                                intent.get("reason")=="Нет активной трансляции" and
                                self.last_power_was_auto and self.last_power_intent is True)
                            if permit:
                                self.power_off_candidate_since=None
                                self.last_power_was_auto=intent.get("policyMode")=="AUTO"
                            elif auto_transition:
                                if self.power_off_candidate_since is None:
                                    self.power_off_candidate_since=now
                                if now-self.power_off_candidate_since<12:
                                    permit=True
                                else:
                                    self.last_power_was_auto=False
                            else:
                                self.power_off_candidate_since=None
                                self.last_power_was_auto=False
                            decision="INTENT_ALLOWED" if permit else "INTENT_OFF"
                            self.last_power_intent=permit
                            self.last_power_received=now
                        except Exception as error:
                            self.messages.put(("api_status","● Сервер: ошибка "+type(error).__name__))
                            # A transient intent-fetch failure is not an explicit OFF.
                            # Keep a recent, already-authorized CENTRAL stream powered for
                            # for one bounded watchdog cycle while the API recovers. Existing LOCAL_RESERVE
                            # authorization has its own bounded offline grace. Never turn
                            # on based solely on a failed fetch, and keep all explicit
                            # emergency/manual/revoked OFF responses immediate.
                            state=PLAYBACK_STATE
                            since_intent=time.monotonic()-self.last_power_received
                            since_auth=time.monotonic()-state["lastAuthorized"]
                            recently_authorized=(self.last_power_intent is True and
                                state["mode"] in ("CENTRAL","LOCAL_RESERVE") and
                                since_auth<min(state["offlineGrace"],900))
                            # Authentication and registration failures are hard denials.
                            # A network outage can bridge only one bounded lease cycle.
                            hard_denial=(isinstance(error,HTTPError) and 400<=error.code<500) or isinstance(error,ValueError)
                            permit=(not hard_denial and recently_authorized and since_intent<7.5)
                            decision="FETCH_ERROR_HOLD" if permit else "FETCH_ERROR_OFF"
                            record_power_event("INTENT_ERROR",result=decision,durationMs=round((time.monotonic()-started)*1000),httpStatus=getattr(error,"code",None),errorType=type(error).__name__,mode=state["mode"],intentAgeSeconds=round(since_intent,2),authorizationAgeSeconds=round(since_auth,2),permit=permit)
                            print("RADIO_POWER_INTENT_FETCH_FAILED",
                                  type(error).__name__, "mode="+str(state["mode"]),
                                  "recentIntentSeconds="+str(round(since_intent,1)),
                                  "hold="+str(permit),flush=True)
                    # The broadcast Start/Stop button is the local master switch.
                    # Preserve a bounded 30-second audio-gap grace only while an
                    # already-authorized agent session remains running. This does
                    # not override server OFF or the ESP32 heartbeat/lease watchdog.
                    state=PLAYBACK_STATE
                    now=time.monotonic()
                    local_running=bool(state["broadcastRunning"])
                    permit,local_reason=allowed_power(permit,local_running,STOP.is_set(),
                        state["streamLastSeen"],now)
                    audio_recent=(state["streamLastSeen"]>0 and now-state["streamLastSeen"]<30)
                    if not permit and local_reason!="SERVER_OR_NETWORK_OFF":
                        decision=local_reason
                    self.messages.put(("broadcast_status","● Эфир включён" if local_running else "● Эфир выключен"))
                    self.messages.put(("audio_status","● Звук: воспроизведение / переход" if audio_recent else "● Звук: нет подтверждения"))
                    phase="esp32_power"
                    signed_power(host,secret,permit,8000 if permit else 0)
                    record_power_event("POWER_COMMAND",result="ACK",durationMs=round((time.monotonic()-started)*1000),permit=permit,reason=decision,mode=PLAYBACK_STATE["mode"],leaseMs=8000 if permit else 0)
                    self.messages.put(("power_status","GPIO13 · "+("ON (команда подтверждена)" if permit else "OFF (команда подтверждена)")))
                except Exception as error:
                    record_power_event("POWER_ERROR",result="ERROR",durationMs=round((time.monotonic()-started)*1000),errorType=type(error).__name__,httpStatus=getattr(error,"code",None),phase=phase,mode=PLAYBACK_STATE["mode"],permit=permit)
                    self.messages.put(("power_status","GPIO13 · нет подтверждения: "+type(error).__name__))
                finally:
                    self.messages.put(("power_done",None))
            threading.Thread(target=job,daemon=True).start()
        self.after(3000,self.power_tick)

    def flash_esp32(self):
        host=self.esp32_ip.get().strip()
        secret=self.esp32_secret.get().strip()
        if not host or len(secret)<32:
            self.esp32_status.set("Для прошивки нужны IP и секрет ESP32")
            return
        file=filedialog.askopenfilename(title="Выберите прошивку ESP32",
            filetypes=[("ESP32 application firmware","*.bin")])
        if not file:
            return
        if not messagebox.askyesno("Перепрошивка ESP32",
                "ВНИМАНИЕ: будет отключено реле усилителя. Обновляйте только доверенным .bin для вашей ESP32, когда эфир можно прервать. Не выключайте питание во время записи. Продолжить?"):
            return
        self.esp32_status.set("Перепрошивка ESP32…")
        def task():
            try:
                upload_firmware(host,secret,file)
                self.messages.put(("esp32_ok","Прошивка записана · ESP32 перезагружается"))
            except Exception as error:
                self.messages.put(("esp32_error",type(error).__name__+": "+str(error)[:110]))
        threading.Thread(target=task,daemon=True).start()

    def reboot_esp32(self):
        host=self.esp32_ip.get().strip()
        secret=self.esp32_secret.get().strip()
        if not host or not secret:
            self.esp32_status.set("Введите IP и секрет ESP32")
            return
        if not messagebox.askyesno("Перезагрузка ESP32",
                "Перезапуск отключит реле усилителя и временно прервёт управление питанием. Продолжить?"):
            return
        self.esp32_status.set("Перезагрузка ESP32…")
        def task():
            try:
                restart_esp32(host,secret)
                self.messages.put(("esp32_ok","Команда перезагрузки принята · дождитесь восстановления связи"))
            except Exception as error:
                self.messages.put(("esp32_error",type(error).__name__+": "+str(error)[:100]))
        threading.Thread(target=task,daemon=True).start()

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
            except UpdateCheckError as error:
                self.messages.put(("log", "Обновления: "+str(error)))
            except Exception as error:
                self.messages.put(("log", "Обновления: непредвиденная ошибка "+type(error).__name__))
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

    def arm_mchs_lab_one_shot(self):
        if not (self.worker and self.worker.is_alive()):
            messagebox.showwarning("МЧС", "Сначала запустите Windows Agent.")
            return
        if MCHS_AUDIO_ARMED.is_set():
            messagebox.showwarning("МЧС", "Учебный звук уже активирован.")
            return
        with MCHS_LAB_ONE_SHOT_LOCK:
            observed=dict(MCHS_LAB_OBSERVED)
        if (not observed['ready'] or observed['phase']!='PROGRAM'
                or time.monotonic()-observed['at']>6):
            messagebox.showwarning(
                "МЧС: нет подтверждённого PROGRAM",
                "Агент пока не получил свежее состояние PROGRAM от Worker. "
                "В админке нажмите START и дождитесь опроса Agent (3–6 секунд). "
                "Проверьте лабораторные флаги API и токен Studio. "
                "Текущее состояние: "+str(observed['phase']))
            return
        approved=messagebox.askyesno(
            "Разрешить одно учебное событие",
            "Физически отсоединён кабель к AA-300, нет иных путей в PA, "
            "оператор присутствует. Разрешить только ОДИН переход PROGRAM → ALERT "
            "в течение 60 секунд? Повторные и реальные тревоги не активируются.",
            icon="warning")
        if approved:
            with MCHS_LAB_ONE_SHOT_LOCK:
                MCHS_LAB_ONE_SHOT_EXPIRES['at']=time.monotonic()+60
                MCHS_LAB_ONE_SHOT.set()
            self.messages.put(("log","MCHS_LAB_ONE_SHOT_ARMED_60_SECONDS baseline_revision="+str(observed['revision'])))

    def start_mchs_audio_trial(self):
        if not (self.worker and self.worker.is_alive()):
            messagebox.showwarning("МЧС", "Сначала запустите штатный Windows Agent.")
            return
        if MCHS_AUDIO_ARMED.is_set():
            return
        confirmed=messagebox.askyesno(
            "Учебный аудиотест МЧС",
            "Подтвердите: кабель от радиокомпьютера к AA-300 ФИЗИЧЕСКИ ОТСОЕДИНЁН, "
            "альтернативные подключения к PA исключены, ответственное лицо присутствует. "
            "На срок до 30 секунд штатный звук будет заменён учебным. Продолжить?",
            icon="warning")
        if confirmed:
            MCHS_AUDIO_STOP.clear()
            MCHS_AUDIO_ARMED.set()
            MCHS_AUDIO_START.set()
            self.messages.put(("log","MCHS_AUDIO_TRIAL_REQUESTED_BY_LOCAL_OPERATOR"))

    def stop_mchs_audio_trial(self):
        MCHS_LAB_ONE_SHOT.clear()
        MCHS_AUDIO_ARMED.clear()
        MCHS_AUDIO_STOP.set()
        self.messages.put(("log","MCHS_AUDIO_TRIAL_STOP_REQUESTED"))

    def stop(self):
        self.stop_mchs_audio_trial()
        STOP.set()
        self.status.set("Остановка…")
        self.broadcast_status.set("● Эфир останавливается")
        self.stop_btn.configure(state="disabled")

    def close(self):
        self.save_preferences(silent=True)
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
                        self.audio_status.set("● Подключение к основному потоку")
                    elif value.startswith("LOCAL_STANDBY"):
                        self.status.set("Резерв · потеря центрального эфира")
                        self.audio_status.set("● Локальный резерв")
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
                elif action == "esp32_report_ok":
                    self.esp32_platform_status.set("Передано на сайт")
                elif action == "esp32_report_state":
                    self.esp32_platform_status.set(value)
                elif action == "esp32_report_error":
                    self.esp32_platform_status.set("Ошибка отправки: "+value)
                elif action == "api_status":
                    self.api_status.set(value)
                elif action == "broadcast_status":
                    self.broadcast_status.set(value)
                elif action == "audio_status":
                    self.audio_status.set(value)
                elif action == "power_status":
                    self.power_status.set(value)
                elif action == "power_done":
                    self.power_busy=False
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
                        self.messages.put(("log", "Новых опубликованных релизов нет. Сборки GitHub Actions не являются обновлениями."))
                elif action == "update_staged":
                    self.pending_update = value
                    self.messages.put(("log", "Обновление готово. Сначала остановите агент, затем перезапустите новую версию."))
                    self.install_btn.configure(state="normal")
                elif action == "update_check_done":
                    self.update_running = False
                    self.update_btn.configure(state="normal")
                elif action == "stopped":
                    self.status.set("Остановлен · оборудование не управляется")
                    self.broadcast_status.set("● Эфир выключен")
                    self.audio_status.set("● Источник: остановлен")
                    self.start_btn.configure(state="normal")
                    self.stop_btn.configure(state="disabled")
        except queue.Empty:
            pass
        self.after(150, self.drain)


if __name__ == "__main__":
    RadioAgentApp().mainloop()
