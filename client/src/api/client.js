const BASE = import.meta.env.VITE_API || 'http://localhost:4000/api';

/* ─────────── Каналы оповещения о состоянии сети ───────────
   NetworkProvider слушает эти события и держит isOffline.
   Оборачиваем в try/catch: событие может уйти до подписки. */
function emitNetworkOk() {
    try { window.dispatchEvent(new CustomEvent('mrr:network-ok')); } catch {}
}
function emitNetworkError() {
    try { window.dispatchEvent(new CustomEvent('mrr:network-error')); } catch {}
}

export class ApiError extends Error {
    constructor(message, status, data) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }
}

export function resolveUrl(path) {
    if (!path) return path;

    const devPrefixes = [
        'http://localhost:4000',
        'http://localhost',
        'http://127.0.0.1:4000',
        'http://127.0.0.1',
        'https://localhost:4000',
        'https://localhost',
    ];
    for (const prefix of devPrefixes) {
        if (path.startsWith(prefix + '/')) {
            path = path.slice(prefix.length);
            break;
        }
    }

    if (
        path.startsWith('http://') ||
        path.startsWith('https://') ||
        path.startsWith('data:') ||
        path.startsWith('blob:')
    ) {
        return path;
    }

    const origin = window.location.origin;
    return `${origin}${path.startsWith('/') ? '' : '/'}${path}`;
}

export async function api(path, { method = 'GET', body, token } = {}) {
    let res;
    try {
        res = await fetch(`${BASE}${path}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(token && { Authorization: `Bearer ${token}` }),
            },
            body: body ? JSON.stringify(body) : undefined,
        });
    } catch (networkError) {
        // fetch упал — сеть, CORS, отвал. Статуса нет.
        // Даём знать NetworkProvider.
        emitNetworkError();
        throw new ApiError(networkError.message || 'Сетевая ошибка', 0, null);
    }

    // До сервера достучались — даже если ответ 4xx/5xx,
    // это значит, что соединение есть.
    emitNetworkOk();

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new ApiError(data.error || 'Ошибка запроса', res.status, data);
    }
    return data;
}

async function uploadFormData(fd, token) {
    let res;
    try {
        res = await fetch(`${BASE}/uploads`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
        });
    } catch (networkError) {
        emitNetworkError();
        throw new ApiError(networkError.message || 'Сетевая ошибка', 0, null);
    }

    emitNetworkOk();

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error || 'Ошибка загрузки', res.status, data);
    return data;
}

export function uploadFileWithProgress(file, token, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${BASE}/uploads`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) onProgress?.(Math.round(event.loaded / event.total * 100));
        };
        xhr.onload = () => {
            emitNetworkOk();
            let data;
            try { data = JSON.parse(xhr.responseText); } catch { data = {}; }
            if (xhr.status >= 200 && xhr.status < 300) resolve(data);
            else reject(new ApiError(data.error || 'Ошибка загрузки', xhr.status, data));
        };
        xhr.onerror = () => { emitNetworkError(); reject(new ApiError('Сетевая ошибка', 0, null)); };
        xhr.onabort = () => reject(new ApiError('Загрузка отменена', 0, null));
        const form = new FormData();
        form.append('file', file);
        xhr.send(form);
    });
}

export async function uploadFile(file, token) {
    const fd = new FormData();
    fd.append('file', file);
    return uploadFormData(fd, token);
}

export async function uploadBlob(blob, filename, token) {
    const fd = new FormData();
    fd.append('file', blob, filename || `image-${Date.now()}.jpg`);
    return uploadFormData(fd, token);
}

/* ─────────── Ping ───────────
   Используется NetworkProvider для периодической проверки связи.
   Берём самый лёгкий публичный эндпоинт — /settings/public.
   Успех = сервер ответил хоть что-то, включая 4xx/5xx.
   Провал (throw) = сеть недоступна. */
export async function ping(timeoutMs = 5000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        await fetch(`${BASE}/settings/public`, {
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal,
        });
        emitNetworkOk();
        return true;
    } catch {
        emitNetworkError();
        return false;
    } finally {
        clearTimeout(timer);
    }
}