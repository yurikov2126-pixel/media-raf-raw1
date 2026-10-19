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
    def __init__(self, server, data_dir, vlc, offline_grace=900):
        self.server = server
        self.data_dir = data_dir
        self.vlc = vlc
        self.offline_grace = offline_grace


class RadioAgentApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("MEDIA · РАФ · RAW — Windows Radio Agent")
        self.geometry("760x560")
        self.minsize(600, 480)
        self.configure(bg="#111827")
        self.messages = queue.Queue()
        self.worker = None
        self.status = tk.StringVar(value="Остановлен · оборудование не управляется")
        self.server = tk.StringVar(value="https://mediarafraw.ru")
        self.vlc = tk.StringVar(value=find_vlc())
        self.data_dir = tk.StringVar(value=default_data_dir())
        self.token = tk.StringVar()
        self.agreed = tk.BooleanVar(value=False)

        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure("Main.TFrame", background="#111827")
        style.configure("Main.TLabel", background="#111827", foreground="#f8fafc", font=("Segoe UI", 10))
        style.configure("Title.TLabel", background="#111827", foreground="#f8fafc", font=("Segoe UI", 18, "bold"))
        style.configure("TCheckbutton", background="#111827", foreground="#f8fafc")
        style.configure("TEntry", fieldbackground="#f8fafc", foreground="#111827")
        wrap = ttk.Frame(self, padding=22, style="Main.TFrame")
        wrap.pack(fill="both", expand=True)
        ttk.Label(wrap, text="MEDIA · РАФ · RAW  /  RADIO AGENT", style="Title.TLabel").pack(anchor="w")
        ttk.Label(wrap, text="Центральный MP3 → локальный резерв только при потере связи",
                  style="Main.TLabel").pack(anchor="w", pady=(3, 15))

        self.row(wrap, "Адрес сервера", self.server)
        self.row(wrap, "Токен устройства (не сохраняется)", self.token, secret=True)
        self.row(wrap, "Путь к VLC", self.vlc, browse=True)
        self.row(wrap, "Кэш радиостанции", self.data_dir, browse=True, directory=True)
        ttk.Checkbutton(wrap, text="Тест только в наушниках. Усилитель и ESP32 отключены.",
                        variable=self.agreed).pack(anchor="w", pady=(12, 7))
        ttk.Label(wrap, textvariable=self.status, style="Main.TLabel").pack(anchor="w", pady=5)
        bar = ttk.Frame(wrap, style="Main.TFrame")
        bar.pack(fill="x", pady=10)
        self.start_btn = ttk.Button(bar, text="▶ Запустить агент", command=self.start)
        self.start_btn.pack(side="left")
        self.stop_btn = ttk.Button(bar, text="■ Остановить", command=self.stop, state="disabled")
        self.stop_btn.pack(side="left", padx=10)
        self.log = tk.Text(wrap, height=10, bg="#1e293b", fg="#e2e8f0",
                           insertbackground="white", relief="flat", state="disabled",
                           font=("Consolas", 10), wrap="word")
        self.log.pack(fill="both", expand=True)
        self.protocol("WM_DELETE_WINDOW", self.close)
        self.after(150, self.drain)

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
        args = Config(url, self.data_dir.get().strip(), str(vlc))
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
                elif action == "stopped":
                    self.status.set("Остановлен · оборудование не управляется")
                    self.start_btn.configure(state="normal")
                    self.stop_btn.configure(state="disabled")
        except queue.Empty:
            pass
        self.after(150, self.drain)


if __name__ == "__main__":
    RadioAgentApp().mainloop()
