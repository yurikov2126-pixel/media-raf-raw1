import os from 'os';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from './prisma.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '..', '..');
const UPLOADS_DIR = path.join(SERVER_ROOT, 'uploads');
const BACKUPS_DIR = path.join(SERVER_ROOT, 'backups');

/* ─────────── Утилита: размер директории ─────────── */
async function dirSize(dir) {
    let total = 0;
    let count = 0;
    if (!fs.existsSync(dir)) return { bytes: 0, count: 0 };
    async function walk(d) {
        const entries = await fsp.readdir(d, { withFileTypes: true }).catch(() => []);
        for (const e of entries) {
            const full = path.join(d, e.name);
            if (e.isFile()) {
                const st = await fsp.stat(full).catch(() => null);
                if (st) { total += st.size; count++; }
            } else if (e.isDirectory() && e.name !== 'node_modules') {
                await walk(full);
            }
        }
    }
    await walk(dir);
    return { bytes: total, count };
}

/* ─────────── CPU usage за короткий интервал ─────────── */
function cpuSnapshot() {
    const cpus = os.cpus();
    const out = { total: 0, idle: 0 };
    for (const c of cpus) {
        for (const k of Object.keys(c.times)) out.total += c.times[k];
        out.idle += c.times.idle;
    }
    return out;
}

async function cpuUsage(sampleMs = 200) {
    const s1 = cpuSnapshot();
    await new Promise((r) => setTimeout(r, sampleMs));
    const s2 = cpuSnapshot();
    const idleDelta = s2.idle - s1.idle;
    const totalDelta = s2.total - s1.total;
    if (totalDelta <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round(100 - (idleDelta / totalDelta) * 100)));
}

/* ─────────── Диск ─────────── */
async function diskInfo() {
    try {
        const st = await fsp.statfs(SERVER_ROOT);
        const total = Number(st.blocks) * Number(st.bsize);
        const free = Number(st.bavail) * Number(st.bsize);
        return {
            total,
            free,
            used: total - free,
            usage: total > 0 ? Math.round(((total - free) / total) * 100) : 0,
        };
    } catch {
        return { total: 0, free: 0, used: 0, usage: 0 };
    }
}

/* ─────────── Соединения БД ─────────── */
async function dbConnections() {
    try {
        const [row] = await prisma.$queryRawUnsafe(`
            SELECT count(*)::int AS active,
                   (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS max
            FROM pg_stat_activity
            WHERE datname = current_database()
        `);
        return { active: row?.active ?? 0, max: row?.max ?? 0 };
    } catch {
        return { active: 0, max: 0 };
    }
}

/* ─────────── Размер БД ─────────── */
async function dbSize() {
    try {
        const [row] = await prisma.$queryRawUnsafe(`
            SELECT pg_database_size(current_database())::bigint AS bytes,
                   pg_size_pretty(pg_database_size(current_database())) AS pretty
        `);
        return { bytes: Number(row?.bytes || 0), pretty: row?.pretty || '0' };
    } catch {
        return { bytes: 0, pretty: '0' };
    }
}

/* ─────────── Логи PM2 ─────────── */
function pm2LogsInfo() {
    const dir = path.join(os.homedir(), '.pm2', 'logs');
    if (!fs.existsSync(dir)) return { bytes: 0, files: [] };
    let bytes = 0;
    const files = [];
    for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith('.log')) continue;
        const full = path.join(dir, f);
        const st = fs.statSync(full);
        bytes += st.size;
        files.push({ name: f, size: st.size, mtime: st.mtime.toISOString() });
    }
    return { bytes, files: files.sort((a, b) => b.size - a.size) };
}

/* ─────────── Public API ─────────── */
export async function getServerInfo() {
    const [cpuPercent, disk, uploads, backups, connections, db] = await Promise.all([
        cpuUsage(),
        diskInfo(),
        dirSize(UPLOADS_DIR),
        dirSize(BACKUPS_DIR),
        dbConnections(),
        dbSize(),
    ]);

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    const nodeMem = process.memoryUsage();

    return {
        os: {
            platform: os.platform(),
            arch: os.arch(),
            hostname: os.hostname(),
            release: os.release(),
            uptime: os.uptime(),
            loadAvg: os.loadavg().map((n) => Math.round(n * 100) / 100),
        },
        cpu: {
            count: os.cpus().length,
            model: os.cpus()[0]?.model || 'unknown',
            usage: cpuPercent,
        },
        memory: {
            total: totalMem,
            used: usedMem,
            free: freeMem,
            usage: Math.round((usedMem / totalMem) * 100),
        },
        disk,
        node: {
            version: process.version,
            pid: process.pid,
            uptime: process.uptime(),
            rss: nodeMem.rss,
            heapUsed: nodeMem.heapUsed,
            heapTotal: nodeMem.heapTotal,
        },
        db: {
            sizeBytes: db.bytes,
            sizePretty: db.pretty,
            activeConnections: connections.active,
            maxConnections: connections.max,
        },
        uploads: { bytes: uploads.bytes, count: uploads.count },
        backups: { bytes: backups.bytes, count: backups.count },
        logs: pm2LogsInfo(),
        checkedAt: new Date().toISOString(),
    };
}

/* ─────────── Очистка ─────────── */

/* Обрезает лог-файлы PM2 (не удаляет — PM2 держит их открытыми). */
export function cleanupPm2Logs() {
    const dir = path.join(os.homedir(), '.pm2', 'logs');
    if (!fs.existsSync(dir)) return { cleared: 0 };
    let cleared = 0;
    for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith('.log')) continue;
        const full = path.join(dir, f);
        try {
            fs.truncateSync(full, 0);
            cleared++;
        } catch {}
    }
    return { cleared };
}

/* Удаляет бэкапы старше N дней (кроме страховочных). */
export function cleanupOldBackups(days = 30) {
    if (!fs.existsSync(BACKUPS_DIR)) return { removed: 0 };
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    let removed = 0;
    for (const f of fs.readdirSync(BACKUPS_DIR)) {
        if (f.startsWith('pre-restore_')) continue;
        if (!f.endsWith('.dump') && !f.endsWith('.sql')) continue;
        const full = path.join(BACKUPS_DIR, f);
        const st = fs.statSync(full);
        if (st.mtimeMs < cutoff) {
            fs.unlinkSync(full);
            removed++;
        }
    }
    return { removed };
}