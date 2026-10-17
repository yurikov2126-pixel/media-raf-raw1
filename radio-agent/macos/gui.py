#!/usr/bin/env python3
"""MEDIA RAF RAW graphical macOS pilot. No hardware or relay commands."""
import json
import hashlib
import os
from pathlib import Path
import queue
import signal
import subprocess
import sys
import threading
import tkinter as tk
from tkinter import ttk, messagebox
from datetime import datetime
from sync_agent import fetch, sync

SERVER = "https://mediarafraw.ru"
ROOT = Path.home() / "Library" / "Application Support" / "MediaRafRadioAgent"
VLC = "/Applications/VLC.app/Contents/MacOS/VLC"

class RadioApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("MEDIA · РАФ · RAW — Radio Agent")
        self.geometry("850x680")
        self.minsize(600, 480)
        self.events = queue.Queue()
        self.worker = None
        self.pilot = None
        self.central = None
        self.central_reader = None
        self.audio_test = None
        self.live = None
        self.live_reader = None
        self.remote_receiver = None
        self.remote_reader = None
        self.token_var = tk.StringVar()
        self.status_var = tk.StringVar(value="Не подключено")
        self.current_var = tk.StringVar(value="Нет данных")
        self.next_var = tk.StringVar(value="Нет данных")
        self.allowed = False
        self.snapshot = None
        self.auto_sync_enabled = False
        self.sync_in_flight = False
        self.last_revision = None
        self.sync_state_var = tk.StringVar(value="Кэш: не загружен")
        self.audio_state_var = tk.StringVar(value="Источник: остановлен")
        self.show_advanced = tk.BooleanVar(value=False)
        self.build()
        self.after(150, self.poll)
        self.after(15000, self.poll_schedule)
        self.protocol("WM_DELETE_WINDOW", self.close)

    def build(self):
        body = ttk.Frame(self, padding=20)
        body.pack(fill="both", expand=True)
        ttk.Label(body, text="РАДИО · MEDIA РАФ RAW", font=("Helvetica", 21, "bold")).pack(anchor="w")
        ttk.Label(body, text="macOS · пробное локальное воспроизведение · без управления усилителем").pack(anchor="w", pady=(1,12))
        auth = ttk.LabelFrame(body, text="Подключение к серверу", padding=10)
        auth.pack(fill="x")
        ttk.Label(auth, text="Токен радиокомпьютера:").pack(anchor="w")
        ttk.Entry(auth, textvariable=self.token_var, show="•").pack(fill="x", pady=5)
        actions = ttk.Frame(auth)
        actions.pack(fill="x")
        self.connect_btn = ttk.Button(actions, text="Проверить связь", command=self.connect)
        self.connect_btn.pack(side="left", padx=(0,6))
        self.sync_btn = ttk.Button(actions, text="Синхронизировать файлы", command=self.do_sync)
        self.sync_btn.pack(side="left")
        ttk.Label(auth,textvariable=self.sync_state_var).pack(anchor="w",pady=5)
        ttk.Label(auth, textvariable=self.status_var).pack(anchor="w", pady=(8,0))

        programs = ttk.LabelFrame(body, text="Расписание · московское время", padding=10)
        programs.pack(fill="x", pady=9)
        ttk.Label(body,textvariable=self.audio_state_var,font=("Helvetica",14,"bold")).pack(anchor="w",pady=5)
        ttk.Label(programs, text="Сейчас:").grid(row=0,column=0,sticky="w")
        ttk.Label(programs, textvariable=self.current_var).grid(row=0,column=1,sticky="w",padx=10)
        ttk.Label(programs, text="Следующая:").grid(row=1,column=0,sticky="w")
        ttk.Label(programs, textvariable=self.next_var).grid(row=1,column=1,sticky="w",padx=10)

        playback = ttk.LabelFrame(body, text="Тестовый аудиовыход Mac", padding=10)
        self.advanced_boxes=[playback]
        ttk.Label(playback, text="Только наушники/тестовые колонки. Не подключать общую трансляцию.").pack(anchor="w")
        self.start_btn = ttk.Button(playback,text="Включить тестовое воспроизведение",command=self.start_pilot)
        self.start_btn.pack(side="left",padx=(0,8),pady=7)
        self.stop_btn = ttk.Button(playback,text="Остановить",command=self.stop_pilot)
        self.stop_btn.pack(side="left",pady=7)
        self.test_btn = ttk.Button(playback,text="Проверить звук",command=self.test_audio)
        self.test_btn.pack(side="left",padx=8,pady=7)
        self.start_btn.state(["disabled"])
        self.stop_btn.state(["disabled"])
        self.test_btn.state(["disabled"])
        centralbox=ttk.LabelFrame(body,text="Центральный поток · резерв по сетке (пилот)",padding=10)
        centralbox.pack(fill="x",pady=8)
        ttk.Label(centralbox,text="Только наушники. При потере сервера воспроизводится кэш с текущей позиции.").pack(anchor="w")
        cr=ttk.Frame(centralbox)
        cr.pack(fill="x",pady=5)
        self.central_start=ttk.Button(cr,text="Включить центральный эфир",command=self.start_central)
        self.central_start.pack(side="left",padx=(0,8))
        self.central_stop=ttk.Button(cr,text="Остановить центральный эфир",command=self.stop_central)
        self.central_stop.pack(side="left")
        self.central_start.state(["disabled"])
        self.central_stop.state(["disabled"])

        livebox=ttk.LabelFrame(body,text="Локальный прямой эфир · тест микрофона",padding=10)
        self.advanced_boxes.append(livebox)
        ttk.Label(livebox,text="Только локальный аудиовыход Mac, НЕ трансляция через интернет. Используйте наушники, чтобы не было обратной связи.").pack(anchor="w")
        self.input_choice=ttk.Combobox(livebox,state="readonly",width=60)
        self.input_choice.pack(fill="x",pady=3)
        self.output_choice=ttk.Combobox(livebox,state="readonly",width=60)
        self.output_choice.pack(fill="x",pady=3)
        row=ttk.Frame(livebox)
        row.pack(fill="x",pady=4)
        ttk.Button(row,text="Обновить устройства",command=self.scan_audio_devices).pack(side="left",padx=(0,8))
        self.live_start=ttk.Button(row,text="Включить микрофон",command=self.start_live)
        self.live_start.pack(side="left",padx=(0,8))
        self.live_stop=ttk.Button(row,text="Выключить микрофон",command=self.stop_live)
        self.live_stop.pack(side="left")
        self.live_start.state(["disabled"])
        self.live_stop.state(["disabled"])
        self.level_var=tk.DoubleVar(value=0)
        ttk.Progressbar(livebox,maximum=100,variable=self.level_var).pack(fill="x")
        self.audio_devices=[]
        self.after(250,self.scan_audio_devices)

        remote=ttk.LabelFrame(body,text="Прямой эфир с телефона · WebRTC",padding=10)
        self.advanced_boxes.append(remote)
        ttk.Label(remote,text="Принимать голос ведущего с сайта на локальный аудиовыход Mac. Используйте наушники.").pack(anchor="w")
        rr=ttk.Frame(remote)
        rr.pack(fill="x",pady=6)
        self.remote_start=ttk.Button(rr,text="Принимать прямой эфир",command=self.start_remote)
        self.remote_start.pack(side="left",padx=(0,8))
        self.remote_stop=ttk.Button(rr,text="Остановить приём",command=self.stop_remote)
        self.remote_stop.pack(side="left")
        self.remote_start.state(["disabled"])
        self.remote_stop.state(["disabled"])
        ttk.Checkbutton(body,text="Показать дополнительные тесты",variable=self.show_advanced,command=self.toggle_advanced).pack(anchor="w",pady=(6,2))
        ttk.Label(body,text="Журнал событий").pack(anchor="w",pady=(8,4))
        self.logbox=tk.Text(body,height=10,wrap="word",state="disabled")
        self.logbox.pack(fill="both",expand=True)
        self.log("Введите токен из Радио → Оборудование. Он хранится только в памяти приложения.")

    def toggle_advanced(self):
        for frame in self.advanced_boxes:
            if self.show_advanced.get():
                frame.pack(fill="x",pady=4,before=self.logbox)
            else:
                frame.pack_forget()

    def poll_schedule(self):
        if self.auto_sync_enabled and not self.sync_in_flight and not (self.worker and self.worker.is_alive()):
            self.sync_in_flight=True
            token=self.token_var.get().strip()
            threading.Thread(target=self.check_revision,args=(token,),daemon=True).start()
        self.after(15000,self.poll_schedule)

    def check_revision(self,token):
        try:
            with fetch(SERVER,token,"/api/radio-agent/agent/snapshot") as response:
                remote=json.load(response)
            revision=remote.get("revision")
            if revision and revision!=self.last_revision:
                self.events.put(("revision_changed",revision))
        except Exception as exc:
            self.events.put(("sync_warning",str(exc)))
        finally:
            self.events.put(("sync_probe_done",None))

    def log(self,message):
        self.logbox.configure(state="normal")
        self.logbox.insert("end",datetime.now().strftime("%H:%M:%S")+"  "+str(message)+"\n")
        self.logbox.see("end")
        self.logbox.configure(state="disabled")

    def submit(self,operation):
        if self.worker and self.worker.is_alive():
            self.log("Подождите: предыдущая операция ещё выполняется.")
            return
        token=self.token_var.get().strip()
        if not token:
            messagebox.showwarning("Нет токена","Введите токен радиокомпьютера.")
            return
        self.worker=threading.Thread(target=self.run_task,args=(operation,token),daemon=True)
        self.worker.start()

    def run_task(self,operation,token):
        try:
            if operation=="connect":
                with fetch(SERVER,token,"/api/radio-agent/agent/status") as response:
                    status=json.load(response)
                self.events.put(("status",status))
            else:
                snapshot=sync(SERVER,token,ROOT)
                self.events.put(("snapshot",snapshot))
                with fetch(SERVER,token,"/api/radio-agent/agent/status") as response:
                    self.events.put(("status",json.load(response)))
        except Exception as exc:
            self.events.put(("error",str(exc)))

    def connect(self):
        self.auto_sync_enabled=True
        self.submit("sync")
    def do_sync(self):
        self.auto_sync_enabled=True
        self.submit("sync")

    def update_schedule(self):
        if not self.snapshot:
            return
        from datetime import timezone
        now=datetime.now(timezone.utc)
        slots=[]
        for slot in self.snapshot.get("slots",[]):
            try:
                start=datetime.fromisoformat(slot["startAt"].replace("Z","+00:00"))
                end=datetime.fromisoformat(slot["endAt"].replace("Z","+00:00"))
                slots.append((start,end,slot["playlistName"]))
            except (KeyError,ValueError): continue
        active=next((s for s in slots if s[0]<=now<s[1]),None)
        upcoming=next((s for s in sorted(slots) if s[0]>now),None)
        self.current_var.set(active[2] if active else "Эфир сейчас не запланирован")
        if upcoming:
            from datetime import timedelta
            local=upcoming[0]+timedelta(hours=3)
            self.next_var.set(local.strftime("%d.%m.%Y %H:%M")+" — "+upcoming[2])
        else:
            self.next_var.set("Нет будущих передач в загруженной сетке")

    def test_audio(self):
        if self.central and self.central.poll() is None:
            messagebox.showwarning("Звук занят","Сначала остановите центральный эфир."); return
        if self.live and self.live.poll() is None:
            messagebox.showwarning('Прямой эфир', 'Сначала выключите микрофон.'); return
        if not self.allowed or not self.snapshot:
            messagebox.showwarning("Нет разрешения", "Подключитесь и синхронизируйте аудио, затем разрешите пилотный режим в админке.")
            return
        if self.pilot and self.pilot.poll() is None:
            messagebox.showwarning("Тест занят", "Сначала остановите автоматический пилот.")
            return
        if self.audio_test and self.audio_test.poll() is None:
            self.log("Проверка звука уже запущена.")
            return
        if not Path(VLC).is_file():
            messagebox.showerror("Нет VLC", "Не найден /Applications/VLC.app/Contents/MacOS/VLC")
            return
        tracks=[track for slot in self.snapshot.get("slots",[]) for track in slot.get("tracks",[])]
        if not tracks:
            messagebox.showwarning("Нет записей", "Сначала запланируйте эфир и синхронизируйте файлы.")
            return
        track=tracks[0]
        audio=ROOT/"cache"/(track["id"]+".audio")
        if not audio.is_file():
            messagebox.showerror("Нет файла", "Аудиозапись отсутствует в кэше. Нажмите «Синхронизировать файлы».")
            return
        with audio.open("rb") as stream:
            checksum=hashlib.file_digest(stream,"sha256").hexdigest()
        if checksum != track["sha256"]:
            messagebox.showerror("Ошибка файла", "SHA-256 не совпадает: файл нельзя воспроизвести.")
            return
        if not messagebox.askyesno("Проверить звук", "Воспроизвести одну запись через локальный выход Mac? Убедитесь, что подключены только наушники."):
            return
        try:
            self.audio_test=subprocess.Popen([VLC,"--intf","dummy","--play-and-exit",
                "--no-video",str(audio)],start_new_session=True,
                stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
            self.log("Тест звука: "+track.get("name",track["id"])+" · "+str(audio))
            self.stop_btn.state(["!disabled"])
        except OSError as exc:
            self.log("VLC не запустился: "+str(exc))

    def scan_audio_devices(self):
        def task():
            try:
                result=subprocess.run([sys.executable,str(Path(__file__).with_name("live_audio.py")),"--list"],
                    capture_output=True,text=True,timeout=12)
                if result.returncode: raise RuntimeError(result.stderr.strip() or "Не удалось прочитать устройства")
                devices=[json.loads(line) for line in result.stdout.splitlines() if line.strip()]
                self.events.put(("devices",devices))
            except Exception as exc: self.events.put(("error","Аудиоустройства: "+str(exc)))
        threading.Thread(target=task,daemon=True).start()

    def start_central(self):
        if not self.allowed:
            messagebox.showwarning("Нет разрешения","Разрешите PILOT в настройках радиоустройства."); return
        if any(p and p.poll() is None for p in (self.pilot,self.audio_test,self.live,self.remote_receiver)):
            messagebox.showwarning("Звук занят","Остановите другие источники звука перед центральным эфиром."); return
        if self.central and self.central.poll() is None:
            return
        if not Path(VLC).is_file():
            messagebox.showerror("Нет VLC","Установите VLC."); return
        if not messagebox.askyesno("Тест центрального эфира",
            "Подтвердите, что подключены только наушники. Усилитель и реле отключены."):
            return
        env=os.environ.copy()
        env["RADIO_AGENT_TOKEN"]=self.token_var.get().strip()
        args=[sys.executable,str(Path(__file__).with_name("central_playout.py")),
              "--server",SERVER,"--data-dir",str(ROOT),"--vlc",VLC,"--enable-headphones-test"]
        try:
            self.central=subprocess.Popen(args,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,
                                          text=True,bufsize=1,start_new_session=True)
            def read(proc):
                for line in proc.stdout:
                    self.events.put(("central_line",line.strip()))
            self.central_reader=threading.Thread(target=read,args=(self.central,),daemon=True)
            self.central_reader.start()
            self.central_start.state(["disabled"])
            self.central_stop.state(["!disabled"])
            self.start_btn.state(["disabled"])
            self.remote_start.state(["disabled"])
            self.audio_state_var.set("Источник: подключение к серверу...")
            self.log("Центральный эфир запущен. При обрыве используется локальная сетка.")
        except OSError as exc:
            self.log("Ошибка центрального потока: "+str(exc))

    def stop_central(self):
        if self.central and self.central.poll() is None:
            try: os.killpg(self.central.pid,signal.SIGTERM)
            except ProcessLookupError: pass
            try: self.central.wait(timeout=5)
            except subprocess.TimeoutExpired:
                try: os.killpg(self.central.pid,signal.SIGKILL)
                except ProcessLookupError: pass
        self.central=None
        self.audio_state_var.set("Источник: остановлен")
        self.central_stop.state(["disabled"])
        self.central_start.state(["!disabled"] if self.allowed else ["disabled"])
        self.start_btn.state(["!disabled"] if self.allowed else ["disabled"])
        self.remote_start.state(["!disabled"] if self.allowed else ["disabled"])

    def start_live(self):
        if self.central and self.central.poll() is None:
            messagebox.showwarning("Звук занят","Сначала остановите центральный эфир."); return
        if not self.allowed:
            messagebox.showwarning("Нет разрешения","Сначала разрешите PILOT для этого Mac в админке.")
            return
        if self.live and self.live.poll() is None: return
        if self.pilot and self.pilot.poll() is None or self.audio_test and self.audio_test.poll() is None:
            messagebox.showwarning("Звук занят","Сначала остановите автоматический эфир или проверку звука.")
            return
        if self.input_choice.current()<0 or self.output_choice.current()<0:
            messagebox.showwarning("Выбор устройств","Выберите микрофон и аудиовыход.")
            return
        inputs=[d for d in self.audio_devices if d["inputs"]>0]
        outputs=[d for d in self.audio_devices if d["outputs"]>0]
        source=inputs[self.input_choice.current()]
        target=outputs[self.output_choice.current()]
        if not messagebox.askyesno("Локальный прямой эфир",
            "Звук микрофона будет немедленно поступать на выбранный аудиовыход. Подключены наушники и исключена обратная связь?"):
            return
        try:
            self.live=subprocess.Popen([sys.executable,str(Path(__file__).with_name("live_audio.py")),
                "--input",str(source["id"]),"--output",str(target["id"])],
                stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,bufsize=1,start_new_session=True)
            proc=self.live
            def read():
                for line in proc.stdout:
                    self.events.put(("live_line",line.strip()))
            self.live_reader=threading.Thread(target=read,daemon=True)
            self.live_reader.start()
            self.live_start.state(["disabled"])
            self.live_stop.state(["!disabled"])
            self.start_btn.state(["disabled"])
            self.test_btn.state(["disabled"])
            self.log("Запуск микрофона: "+source["name"]+" → "+target["name"])
        except OSError as exc: self.log("Микрофон: "+str(exc))

    def stop_live(self):
        if self.live and self.live.poll() is None:
            try: os.killpg(self.live.pid,signal.SIGTERM)
            except ProcessLookupError: pass
        self.live=None
        self.level_var.set(0)
        self.live_start.state(["!disabled"] if self.allowed and self.audio_devices else ["disabled"])
        self.live_stop.state(["disabled"])
        self.start_btn.state(["!disabled"] if self.allowed else ["disabled"])
        self.test_btn.state(["!disabled"] if self.allowed and self.snapshot else ["disabled"])

    def start_pilot(self):
        if self.central and self.central.poll() is None:
            messagebox.showwarning("Звук занят","Сначала остановите центральный эфир."); return
        if self.live and self.live.poll() is None:
            messagebox.showwarning('Прямой эфир', 'Сначала выключите микрофон.'); return
        if self.pilot and self.pilot.poll() is None: return
        if not self.allowed:
            messagebox.showwarning("Нет разрешения","Включите тестовое воспроизведение для этого устройства в админке.")
            return
        if not Path(VLC).is_file():
            messagebox.showerror("VLC не установлен","Установите VLC в /Applications/VLC.app")
            return
        if not messagebox.askyesno("Подтвердите локальный эфир",
                "Звук начнётся автоматически по расписанию. Подключены только тестовые наушники или колонки?"):
            return
        env=os.environ.copy()
        env["RADIO_AGENT_TOKEN"]=self.token_var.get().strip()
        args=[sys.executable,str(Path(__file__).with_name("pilot_playout.py")),
              "--server",SERVER,"--data-dir",str(ROOT),"--vlc",VLC,"--enable-local-speaker"]
        try:
            self.pilot=subprocess.Popen(args,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,
                                         start_new_session=True)
            self.start_btn.state(["disabled"])
            self.stop_btn.state(["!disabled"])
            self.log("Пилот запущен. Звук будет воспроизводиться только в ближайшем запланированном эфире.")
        except OSError as exc:
            self.log("Ошибка запуска: "+str(exc))

    def priority_file(self):
        return ROOT / "live-priority.pause"

    def set_live_priority(self):
        ROOT.mkdir(parents=True, exist_ok=True)
        self.priority_file().write_text("live",encoding="utf-8")

    def clear_live_priority(self):
        self.priority_file().unlink(missing_ok=True)

    def start_remote(self):
        if self.central and self.central.poll() is None:
            messagebox.showwarning("Звук занят","Сначала остановите центральный эфир."); return
        self.clear_live_priority()
        if self.remote_receiver and self.remote_receiver.poll() is None: return
        if not self.allowed:
            messagebox.showwarning("Нет разрешения","Включите тестовый эфир для Mac в админке.")
            return
        if not messagebox.askyesno("Приём прямого эфира","Используются только наушники/тестовые колонки?"):
            return
        env=os.environ.copy()
        env["RADIO_AGENT_TOKEN"]=self.token_var.get().strip()
        try:
            self.remote_receiver=subprocess.Popen([sys.executable,str(Path(__file__).with_name("webrtc_receiver.py"))],
                env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,bufsize=1,start_new_session=True)
            def reader(proc):
                for line in proc.stdout:
                    self.events.put(("remote_line",line.strip()))
            self.remote_reader=threading.Thread(target=reader,args=(self.remote_receiver,),daemon=True)
            self.remote_reader.start()
            self.remote_start.state(["disabled"])
            self.remote_stop.state(["!disabled"])
            self.log("Запущен сетевой WebRTC-приёмник. Ожидаем ведущего с телефона.")
        except OSError as e:
            self.log("WebRTC приёмник не запустился: "+str(e))

    def stop_remote(self):
        self.clear_live_priority()
        if self.remote_receiver and self.remote_receiver.poll() is None:
            try: os.killpg(self.remote_receiver.pid,signal.SIGTERM)
            except ProcessLookupError: pass
            self.log("Сетевой WebRTC-приёмник остановлен.")
        self.remote_receiver=None
        self.remote_start.state(["!disabled"] if self.allowed else ["disabled"])
        self.remote_stop.state(["disabled"])

    def stop_pilot(self):
        if self.audio_test and self.audio_test.poll() is None:
            try: os.killpg(self.audio_test.pid, signal.SIGTERM)
            except ProcessLookupError: pass
            self.log("Тестовый звук остановлен.")
        self.audio_test=None
        if self.pilot and self.pilot.poll() is None:
            # Child VLC inherits pilot's process group: stop the whole playback group.
            try: os.killpg(self.pilot.pid,signal.SIGTERM)
            except ProcessLookupError: pass
            self.log("Отправлена остановка пилота и дочернего VLC.")
        self.pilot=None
        self.start_btn.state(["!disabled"] if self.allowed else ["disabled"])
        self.stop_btn.state(["disabled"])

    def poll(self):
        try:
            while True:
                kind,value=self.events.get_nowait()
                if kind=="devices":
                    self.audio_devices=value
                    inputs=[d for d in value if d["inputs"]>0]
                    outputs=[d for d in value if d["outputs"]>0]
                    self.input_choice["values"]=[str(d["id"])+" · "+d["name"] for d in inputs]
                    self.output_choice["values"]=[str(d["id"])+" · "+d["name"] for d in outputs]
                    if inputs: self.input_choice.current(0)
                    if outputs: self.output_choice.current(0)
                    self.live_start.state(["!disabled"] if self.allowed and inputs and outputs else ["disabled"])
                    self.log("Аудиоустройств обнаружено: "+str(len(value)))
                elif kind=="live_line":
                    if value.startswith("LEVEL "):
                        try: self.level_var.set(min(100,float(value.split()[1])*100))
                        except (ValueError,IndexError): pass
                    elif value: self.log(value)
                elif kind=="status":
                    self.allowed=value.get("mode")=="PILOT" and value.get("playbackEnabled") is True
                    if not self.central or self.central.poll() is not None:
                        self.central_start.state(["!disabled"] if self.allowed else ["disabled"])
                    self.status_var.set("Подключено · "+("Тестовый эфир разрешён" if self.allowed else "Только синхронизация"))
                    if not self.pilot or self.pilot.poll() is not None:
                        self.start_btn.state(["!disabled"] if self.allowed else ["disabled"])
                    self.test_btn.state(["!disabled"] if self.allowed and self.snapshot else ["disabled"])
                    if not self.remote_receiver: self.remote_start.state(["!disabled"] if self.allowed else ["disabled"])
                    if not self.live: self.live_start.state(["!disabled"] if self.allowed and self.audio_devices else ["disabled"])
                    self.log("Сервер ответил. Управление усилителем: отключено.")
                elif kind=="central_line":
                    if value.startswith("PRIMARY_STREAM"):
                        self.audio_state_var.set("● Центральный сервер · эфир")
                    elif value.startswith("PRIMARY_CONNECTING"):
                        self.audio_state_var.set("◌ Центральный сервер · подключение")
                    elif value.startswith(("FALLBACK","LOCAL_TRACK")):
                        self.audio_state_var.set("● Резерв · локальная сетка")
                    if value: self.log("Central: "+value)
                elif kind=="remote_line":
                    self.log("WebRTC: "+value)
                    if value.startswith("WAIT "):
                        self.clear_live_priority()
                    if value in ("LISTENING", "AUDIO_START"):
                        self.set_live_priority()
                    elif value.startswith(("ENDED", "SIGNAL_LOST", "PEER_FAILED", "AUDIO_ERROR")):
                        self.clear_live_priority()
                elif kind=="sync_probe_done":
                    self.sync_in_flight=False
                elif kind=="revision_changed":
                    self.sync_state_var.set("Изменение сетки · синхронизация...")
                    self.submit("sync")
                elif kind=="sync_warning":
                    self.sync_state_var.set("Сеть недоступна · используется кэш")
                elif kind=="snapshot":
                    self.snapshot=value
                    self.last_revision=value.get("revision")
                    count=len({t["id"] for sl in value.get("slots",[]) for t in sl.get("tracks",[])})
                    self.sync_state_var.set("Кэш готов · записей: "+str(count)+" · автообновление")
                    self.update_schedule()
                    self.test_btn.state(["!disabled"] if self.allowed else ["disabled"])
                    self.log("Синхронизировано передач: "+str(len(value.get("slots",[]))))
                else: self.log("Ошибка: "+value)
        except queue.Empty: pass
        if self.audio_test and self.audio_test.poll() is not None:
            code=self.audio_test.returncode
            errors=(self.audio_test.stderr.read() or b'').decode('utf-8','replace')[-1500:]
            self.log('Проверка звука завершилась: VLC код '+str(code)+((' · '+errors) if code else ''))
            self.audio_test=None
            if not self.pilot: self.stop_btn.state(['disabled'])
        if self.remote_receiver and self.remote_receiver.poll() is not None:
            self.clear_live_priority()
            self.log("WebRTC-приёмник завершился с кодом "+str(self.remote_receiver.returncode))
            self.remote_receiver=None
            self.remote_start.state(["!disabled"] if self.allowed else ["disabled"])
            self.remote_stop.state(["disabled"])
        if self.central and self.central.poll() is not None:
            self.log("Центральный эфир завершён: "+str(self.central.returncode))
            self.audio_state_var.set("Источник: остановлен")
            self.central=None
            self.central_stop.state(["disabled"])
            self.central_start.state(["!disabled"] if self.allowed else ["disabled"])
            self.start_btn.state(["!disabled"] if self.allowed else ["disabled"])
            self.remote_start.state(["!disabled"] if self.allowed else ["disabled"])
        if self.pilot and self.pilot.poll() is not None:
            self.pilot=None
            self.start_btn.state(["!disabled"] if self.allowed else ["disabled"])
            self.stop_btn.state(["disabled"])
            self.log("Пилот завершён.")
        if self.live and self.live.poll() is not None:
            self.log('Микрофон завершился с кодом '+str(self.live.returncode))
            self.stop_live()
        self.update_schedule()
        self.after(500,self.poll)

    def close(self):
        self.auto_sync_enabled=False
        self.stop_central()
        self.stop_live()
        self.stop_pilot()
        self.token_var.set("")
        self.destroy()

if __name__=="__main__":
    RadioApp().mainloop()
