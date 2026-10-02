import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '..', '..');
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

/* ─────────── Поиск бинарей pg_dump / pg_restore ───────────
   ВАЖНО: pg_dump должен быть той же мажорной версии, что и сервер.
   На aaPanel часто стоит два набора утилит:
     - системный (Ubuntu) — старый (например, 16.x)
     - /www/server/pgsql/bin/ — совпадает с сервером (например, 18.x)
   Если брать системный — Postgres откажется: "server version mismatch".
   Поэтому сначала проверяем aaPanel-путь, а уже потом PATH.

   Можно жёстко задать путь через переменные окружения:
     MRR_PG_DUMP_PATH=/www/server/pgsql/bin/pg_dump
     MRR_PG_RESTORE_PATH=/www/server/pgsql/bin/pg_restore
   (полезно, если на сервере несколько PostgreSQL). */
function findBinary(name) {
    const envKey = `MRR_${name.toUpperCase()}_PATH`;
    if (process.env[envKey] && fs.existsSync(process.env[envKey])) {
        return process.env[envKey];
    }

    // 1. aaPanel — самый вероятный кандидат
    const aaPath = `/www/server/pgsql/bin/${name}`;
    if (fs.existsSync(aaPath)) return aaPath;

    // 2. Другие частые места установки PostgreSQL
    const candidates = [
        `/usr/local/pgsql/bin/${name}`,
        `/usr/pgsql-18/bin/${name}`,
        `/usr/pgsql-17/bin/${name}`,
        `/usr/pgsql-16/bin/${name}`,
        `/usr/lib/postgresql/18/bin/${name}`,
        `/usr/lib/postgresql/17/bin/${name}`,
        `/usr/lib/postgresql/16/bin/${name}`,
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) return p;
    }

    // 3. Наконец — PATH (может дать несовпадающую версию)
    const r = spawnSync('which', [name], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();

    return name;
}

/* ─────────── Разбор DATABASE_URL ───────────
   Формат: postgresql://user:password@host:port/db?schema=public */
function parseDbUrl() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL не задан');
    const u = new URL(url);
    return {
        user: decodeURIComponent(u.username || ''),
        password: decodeURIComponent(u.password || ''),
        host: u.hostname || 'localhost',
        port: u.port || '5432',
        database: u.pathname.replace(/^\//, ''),
    };
}

/* ─────────── Запуск pg_dump ─────────── */
function runPgDump(dest, format = 'custom') {
    return new Promise((resolve, reject) => {
        let cfg;
        try { cfg = parseDbUrl(); }
        catch (e) { return reject(e); }

        const pgDump = findBinary('pg_dump');
        const fmtFlag = format === 'plain' ? '-Fp' : '-Fc';

        const args = [
            fmtFlag,
            '-h', cfg.host,
            '-p', String(cfg.port),
            '-U', cfg.user,
            '-d', cfg.database,
            '-f', dest,
            '--no-owner',
            '--no-acl',
        ];

        const child = spawn(pgDump, args, {
            env: { ...process.env, PGPASSWORD: cfg.password },
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stderr = '';
        child.stderr.on('data', (d) => { stderr += d.toString(); });
        child.on('error', (err) => {
            reject(new Error(`Не удалось запустить pg_dump (${pgDump}): ${err.message}`));
        });
        child.on('close', (code) => {
            if (code !== 0) {
                return reject(new Error(
                    `pg_dump завершился с кодом ${code}: ${stderr.slice(0, 500)}`
                ));
            }
            resolve();
        });
    });
}

/* ─────────── Запуск pg_restore ─────────── */
function runPgRestore(src) {
    return new Promise((resolve, reject) => {
        let cfg;
        try { cfg = parseDbUrl(); }
        catch (e) { return reject(e); }

        const pgRestore = findBinary('pg_restore');
        const args = [
            '--clean',
            '--if-exists',
            '-h', cfg.host,
            '-p', String(cfg.port),
            '-U', cfg.user,
            '-d', cfg.database,
            '--no-owner',
            '--no-acl',
            src,
        ];

        const child = spawn(pgRestore, args, {
            env: { ...process.env, PGPASSWORD: cfg.password },
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stderr = '';
        child.stderr.on('data', (d) => { stderr += d.toString(); });
        child.on('error', (err) => {
            reject(new Error(`Не удалось запустить pg_restore (${pgRestore}): ${err.message}`));
        });
        child.on('close', (code) => {
            // pg_restore: 0 — успех, 1 — предупреждения (не критично)
            if (code !== 0 && code !== 1) {
                return reject(new Error(
                    `pg_restore завершился с кодом ${code}: ${stderr.slice(0, 500)}`
                ));
            }
            resolve();
        });
    });
}

/* ─────────── Список бэкапов ───────────
   Показываем .dump (custom, для восстановления) и .sql (plain).
   Старые .db от SQLite остаются на диске, но в списке не показываются. */
export function listBackups() {
    ensureDir();
    return fs
        .readdirSync(BACKUP_DIR)
        .filter((f) => f.endsWith('.dump') || f.endsWith('.sql'))
        .map((f) => {
            const full = path.join(BACKUP_DIR, f);
            const st = fs.statSync(full);
            return {
                filename: f,
                size: st.size,
                createdAt: st.mtime.toISOString(),
                format: f.endsWith('.sql') ? 'plain' : 'custom',
                isAuto: f.includes('_auto'),
                isSafety: f.startsWith('pre-restore_'),
                restorable: f.endsWith('.dump'),
            };
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function createBackup(label, format = 'custom') {
    ensureDir();
    const clean = label ? '_' + String(label).replace(/[^a-z0-9_-]/gi, '') : '';
    const ext = format === 'plain' ? '.sql' : '.dump';
    const name = `${stamp()}${clean}${ext}`;
    const dest = path.join(BACKUP_DIR, name);

    await runPgDump(dest, format);

    return {
        filename: name,
        size: fs.statSync(dest).size,
        createdAt: new Date().toISOString(),
        format,
    };
}

export async function restoreBackup(filename) {
    ensureDir();
    const src = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(src)) throw new Error('Бэкап не найден');
    if (!filename.endsWith('.dump')) {
        throw new Error('Восстановление возможно только из .dump-файла (custom format). .sql можно залить вручную через psql.');
    }

    // Сначала делаем safety-копию текущего состояния
    const safety = `pre-restore_${stamp()}.dump`;
    try {
        await runPgDump(path.join(BACKUP_DIR, safety), 'custom');
    } catch (e) {
        throw new Error(`Не удалось создать страховочный бэкап: ${e.message}`);
    }

    await runPgRestore(src);

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
        if (!f.endsWith('.dump') && !f.endsWith('.sql')) continue;
        if (f.startsWith('pre-restore_')) continue;
        const full = path.join(BACKUP_DIR, f);
        if (fs.statSync(full).mtimeMs < cutoff) {
            fs.unlinkSync(full);
            removed++;
        }
    }
    return removed;
}

/* ─────────── Проверка доступности утилит ───────────
   Используется в админке, чтобы показать статус. */
export function checkPgTools() {
    const pgDumpPath = findBinary('pg_dump');
    const pgRestorePath = findBinary('pg_restore');

    let pgDumpOk = false;
    let pgRestoreOk = false;
    let pgDumpVersion = '';
    let pgRestoreVersion = '';

    try {
        const r = spawnSync(pgDumpPath, ['--version'], { encoding: 'utf8' });
        if (r.status === 0) {
            pgDumpOk = true;
            pgDumpVersion = (r.stdout || '').trim();
        }
    } catch {}

    try {
        const r = spawnSync(pgRestorePath, ['--version'], { encoding: 'utf8' });
        if (r.status === 0) {
            pgRestoreOk = true;
            pgRestoreVersion = (r.stdout || '').trim();
        }
    } catch {}

    return {
        pgDumpPath,
        pgRestorePath,
        pgDumpOk,
        pgRestoreOk,
        pgDumpVersion,
        pgRestoreVersion,
    };
}