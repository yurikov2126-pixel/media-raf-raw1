import { useEffect } from 'react';

/* Хук для управления <title> и мета-тегами на клиенте.
   Полностью SSR не заменяет (боты видят серверный ответ),
   но:
   - пользователь видит правильный заголовок в табе браузера
   - при переходах внутри SPA og-теги обновляются (важно для
     расширений, где клиент исполняет JS) */

const DEFAULT_SITE = 'MEDIA·RAF·RAW';

function setMeta(attr, key, content, originals) {
    if (!content) return null;
    let el = document.querySelector(`meta[${attr}="${key}"]`);
    const created = !el;
    if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
    }
    originals.push({ el, prev: el.getAttribute('content'), created });
    el.setAttribute('content', content);
    return el;
}

export default function usePageMeta({ title, description, image, type = 'website' } = {}) {
    useEffect(() => {
        if (!title && !description) return;

        const originals = [];
        const prevTitle = document.title;

        const fullTitle = title ? `${title} · ${DEFAULT_SITE}` : DEFAULT_SITE;
        document.title = fullTitle;

        setMeta('name', 'description', description, originals);
        setMeta('property', 'og:title', fullTitle, originals);
        setMeta('property', 'og:description', description, originals);
        setMeta('property', 'og:type', type, originals);
        setMeta('property', 'og:url', window.location.href, originals);
        if (image) {
            const abs = image.startsWith('http') ? image : `${window.location.origin}${image}`;
            setMeta('property', 'og:image', abs, originals);
            setMeta('name', 'twitter:image', abs, originals);
        }
        setMeta('name', 'twitter:card', image ? 'summary_large_image' : 'summary', originals);
        setMeta('name', 'twitter:title', fullTitle, originals);
        setMeta('name', 'twitter:description', description, originals);

        return () => {
            document.title = prevTitle;
            for (const { el, prev, created } of originals) {
                if (created) el.remove();
                else if (prev != null) el.setAttribute('content', prev);
                else el.removeAttribute('content');
            }
        };
    }, [title, description, image, type]);
}