import { spawn, spawnSync } from 'child_process';

/**
 * Извлекает амплитудный профиль (waveform) из аудиофайла через ffmpeg.
 *
 * Как работает:
 *   1. ffmpeg декодирует аудио в моно PCM s16le 8 kHz и отдаёт в stdout.
 *   2. Мы режем поток на N равных бакетов.
 *   3. Для каждого бакета считаем среднее абсолютное значение сэмплов.
 *   4. Нормализуем к диапазону 0..1 и округляем до 2 знаков.
 *
 * Возвращает массив длиной `buckets` или null, если ffmpeg недоступен
 * или произошла ошибка.
 */

const FFMPEG_CANDIDATES = [
    process.env.FFMPEG_PATH,
    'ffmpeg',
    '/usr/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
    '/opt/homebrew/bin/ffmpeg',
].filter(Boolean);

let cachedFfmpeg = undefined;

function findFfmpeg() {
    for (const candidate of FFMPEG_CANDIDATES) {
        try {
            const r = spawnSync(candidate, ['-version'], { encoding: 'utf8' });
            if (r.status === 0) return candidate;
        } catch {
            // пропускаем неудачные варианты
        }
    }
    return null;
}

function getFfmpeg() {
    if (cachedFfmpeg !== undefined) return cachedFfmpeg;
    cachedFfmpeg = findFfmpeg();
    if (!cachedFfmpeg) {
        console.warn('[audioPeaks] ffmpeg не найден, waveform будет хеш-фоллбэком');
    }
    return cachedFfmpeg;
}

export function isFfmpegAvailable() {
    return getFfmpeg() !== null;
}

export function extractPeaks(filePath, buckets = 40) {
    return new Promise((resolve) => {
        const ffmpeg = getFfmpeg();
        if (!ffmpeg) {
            resolve(null);
            return;
        }

        let finished = false;
        function finish(value) {
            if (finished) return;
            finished = true;
            resolve(value);
        }

        const ff = spawn(ffmpeg, [
            '-v', 'error',
            '-i', filePath,
            '-ac', '1',
            '-ar', '8000',
            '-f', 's16le',
            '-',
        ]);

        const chunks = [];
        ff.stdout.on('data', (d) => {
            chunks.push(d);
        });

        ff.on('error', (e) => {
            console.error('[audioPeaks] spawn error:', e.message);
            finish(null);
        });

        ff.on('close', (code) => {
            if (code !== 0) {
                console.error('[audioPeaks] ffmpeg exit code:', code);
                finish(null);
                return;
            }
            try {
                const buf = Buffer.concat(chunks);
                if (buf.length < 2) {
                    finish(null);
                    return;
                }

                const sampleCount = Math.floor(buf.length / 2);
                const samples = new Int16Array(buf.buffer, buf.byteOffset, sampleCount);
                const per = Math.max(1, Math.floor(sampleCount / buckets));

                const raw = new Array(buckets).fill(0);
                let maxVal = 1;

                for (let i = 0; i < buckets; i++) {
                    const start = i * per;
                    const end = Math.min(start + per, sampleCount);
                    let sum = 0;
                    for (let j = start; j < end; j++) {
                        sum += Math.abs(samples[j]);
                    }
                    const avg = end > start ? sum / (end - start) : 0;
                    raw[i] = avg;
                    if (avg > maxVal) maxVal = avg;
                }

                const normalized = raw.map(
                    (v) => Math.round((v / maxVal) * 100) / 100
                );
                finish(normalized);
            } catch (e) {
                console.error('[audioPeaks] parse error:', e);
                finish(null);
            }
        });

        setTimeout(() => {
            if (!finished) {
                try {
                    ff.kill('SIGKILL');
                } catch {
                    // ignore
                }
                finish(null);
            }
        }, 30000);
    });
}

/**
 * Путь к файлу peaks рядом с исходным аудио:
 *   uploads/voice-123.webm  →  uploads/voice-123.webm.peaks.json
 */
export function peaksPathFor(audioPath) {
    return `${audioPath}.peaks.json`;
}