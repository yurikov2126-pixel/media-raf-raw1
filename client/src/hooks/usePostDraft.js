import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Черновик поста в localStorage.
 *
 * - читает сохранённый черновик при монтировании
 * - автосохраняет каждые 3 секунды, если текст изменился
 * - сохраняет при размонтировании (закрытие вкладки)
 * - clear() очищает после публикации
 *
 * Ключ привязан к пользователю: у каждого аккаунта — свой черновик.
 */
const AUTOSAVE_MS = 3000;

export default function usePostDraft(userId) {
    const key = userId ? `mrr_post_draft_${userId}` : null;

    const [text, setText] = useState(() => {
        if (!key) return '';
        try {
            return localStorage.getItem(key) || '';
        } catch {
            return '';
        }
    });

    // Последнее сохранённое значение — чтобы не писать зря
    const lastSavedRef = useRef(text);

    // При смене пользователя — перечитываем
    useEffect(() => {
        if (!key) return;
        try {
            const saved = localStorage.getItem(key) || '';
            setText(saved);
            lastSavedRef.current = saved;
        } catch {}
    }, [key]);

    // Автосохранение по интервалу + на размонтирование
    useEffect(() => {
        if (!key) return;

        const save = () => {
            if (text === lastSavedRef.current) return;
            try {
                if (text.trim()) localStorage.setItem(key, text);
                else localStorage.removeItem(key);
                lastSavedRef.current = text;
            } catch {}
        };

        const t = setInterval(save, AUTOSAVE_MS);

        const onVisibility = () => {
            if (document.visibilityState === 'hidden') save();
        };
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            clearInterval(t);
            document.removeEventListener('visibilitychange', onVisibility);
            save();
        };
    }, [key, text]);

    const clear = useCallback(() => {
        if (!key) return;
        try {
            localStorage.removeItem(key);
        } catch {}
        setText('');
        lastSavedRef.current = '';
    }, [key]);

    const hasDraft = text.trim().length > 0;

    return { text, setText, clear, hasDraft };
}