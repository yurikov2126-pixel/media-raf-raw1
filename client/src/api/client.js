const BASE = import.meta.env.VITE_API || 'http://localhost:4000/api';

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
        throw new ApiError(networkError.message || 'Сетевая ошибка', 0, null);
    }

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
        throw new ApiError(networkError.message || 'Сетевая ошибка', 0, null);
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error || 'Ошибка загрузки', res.status, data);
    return data;
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