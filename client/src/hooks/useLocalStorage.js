import { useState, useEffect, useCallback } from 'react';

/**
 * Простой хук для синхронизации состояния с localStorage.
 * Хранит значения в JSON, поддерживает удаление.
 *
 * Возвращает [value, setValue, remove].
 */
export default function useLocalStorage(key, defaultValue) {
    const [value, setValue] = useState(() => {
        try {
            const raw = localStorage.getItem(key);
            if (raw === null) return defaultValue;
            return JSON.parse(raw);
        } catch {
            return defaultValue;
        }
    });

    useEffect(() => {
        try {
            if (value === undefined || value === null) {
                localStorage.removeItem(key);
            } else {
                localStorage.setItem(key, JSON.stringify(value));
            }
        } catch {}
    }, [key, value]);

    const remove = useCallback(() => {
        try {
            localStorage.removeItem(key);
        } catch {}
        setValue(defaultValue);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    return [value, setValue, remove];
}