import { resolveUrl } from '../api/client.js';

// Preserve existing URLs for external images; only public uploads have thumbnails.
export function chatImagePreviewUrl(content) {
    if (!content) return content;
    try {
        const url = new URL(resolveUrl(content), window.location.origin);
        if (url.origin !== window.location.origin) return resolveUrl(content);
        const match = /^\/uploads\/([^/]+\.(?:jpg|jpeg|png|webp|gif))$/i.exec(url.pathname);
        return match ? `${url.origin}/api/uploads/thumb/${match[1]}` : resolveUrl(content);
    } catch { return resolveUrl(content); }
}
