import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from './prisma.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '..', '..');
const DB_PATH = path.join(SERVER_ROOT, 'prisma', 'dev.db');
const BACKUP_DIR = path.join(SERVER_ROOT, 'backups');

function ensureDir() {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function stamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return (
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
        `_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
    );
}

export function listBackups() {
    ensureDir();
    return fs
        .readdirSync(BACKUP_DIR)
        .filter((f) => f.endsWith('.db'))
        .map((f) => {
            const full = path.join(BACKUP_DIR, f);
            const st = fs.statSync(full);
            return {
                filename: f,
                size: st.size,
                createdAt: st.mtime.toISOString(),
                isAuto: f.includes('_auto'),
                isSafety: f.startsWith('pre-restore_'),
            };
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function createBackup(label) {
    ensureDir();
    if (!fs.existsSync(DB_PATH)) throw new Error('Файл БД не найден');
    const clean = label ? '_' + String(label).replace(/[^a-z0-9_-]/gi, '') : '';
    const name = `${stamp()}${clean}.db`;
    const dest = path.join(BACKUP_DIR, name);
    fs.copyFileSync(DB_PATH, dest);
    return {
        filename: name,
        size: fs.statSync(dest).size,
        createdAt: new Date().toISOString(),
    };
}

export async function restoreBackup(filename) {
    ensureDir();
    const src = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(src)) throw new Error('Бэкап не найден');

    // Создаём страховочную копию текущего состояния
    const safety = `pre-restore_${stamp()}.db`;
    if (fs.existsSync(DB_PATH)) {
        fs.copyFileSync(DB_PATH, path.join(BACKUP_DIR, safety));
    }

    // Отключаем Prisma, копируем файл, подключаемся заново
    try { await prisma.$disconnect(); } catch {}
    fs.copyFileSync(src, DB_PATH);
    try { await prisma.$connect(); } catch {}

    return { ok: true, safetyBackup: safety };
}

export function deleteBackup(filename) {
    ensureDir();
    const p = path.join(BACKUP_DIR, filename);
    if (fs.existsSync(p)) fs.unlinkSync(p);
    return { ok: true };
}

export function cleanupOld(days = 30) {
    ensureDir();
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    let removed = 0;
    for (const f of fs.readdirSync(BACKUP_DIR)) {
        if (!f.endsWith('.db')) continue;
        if (f.startsWith('pre-restore_')) continue;
        const full = path.join(BACKUP_DIR, f);
        if (fs.statSync(full).mtimeMs < cutoff) {
            fs.unlinkSync(full);
            removed++;
        }
    }
    return removed;
}