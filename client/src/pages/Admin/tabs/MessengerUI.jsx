import { useEffect, useState } from 'react';
import { api } from '../../../api/client.js';
import { useSettings } from '../../../store/settings.jsx';

const INITIAL = {
    messenger_ui_default: 'classic',
    messenger_ui_access: 'admins',
    messenger_ui_user_choice: 'false',
};

export default function MessengerUI({ token }) {
    const { reload } = useSettings();
    const [values, setValues] = useState(INITIAL);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        let active = true;
        api('/admin/settings', { token }).then((response) => {
            if (active) setValues({ ...INITIAL, ...Object.fromEntries(Object.keys(INITIAL).map((key) => [key, response[key] ?? INITIAL[key]])) });
        }).catch((error) => { if (active) setMessage(error.message); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [token]);

    const update = (key, value) => { setValues((current) => ({ ...current, [key]: value })); setMessage(''); };
    const save = async () => {
        setSaving(true);
        setMessage('');
        try {
            await api('/admin/settings', { method: 'PUT', token, body: values });
            await reload();
            setMessage('Настройки мессенджера сохранены.');
        } catch (error) {
            setMessage('Ошибка сохранения: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-3xl space-y-5">
            <div className="card p-5 md:p-7 space-y-5">
                <div>
                    <h2 className="font-bold text-xl">💬 Интерфейс мессенджера</h2>
                    <p className="text-sm opacity-70 mt-2">Безопасное внедрение версии 2.0. Переписки, сообщения и вложения общие для обоих вариантов.</p>
                </div>
                {loading ? <p role="status">Загрузка настроек…</p> : <>
                    <fieldset className="space-y-3">
                        <legend className="font-semibold mb-2">Интерфейс по умолчанию</legend>
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input type="radio" name="messenger-default" checked={values.messenger_ui_default === 'classic'} onChange={() => update('messenger_ui_default', 'classic')} />
                            <span><b>Классический</b><span className="block text-sm opacity-70">Текущий интерфейс без изменений</span></span>
                        </label>
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input type="radio" name="messenger-default" checked={values.messenger_ui_default === 'new'} onChange={() => update('messenger_ui_default', 'new')} />
                            <span><b>Новый 2.0</b><span className="block text-sm opacity-70">Обновлённая компоновка, отступы и визуальные элементы</span></span>
                        </label>
                    </fieldset>
                    <div>
                        <label htmlFor="messenger-access" className="block font-semibold mb-2">Кому разрешён новый интерфейс</label>
                        <select id="messenger-access" className="input" value={values.messenger_ui_access} onChange={(event) => update('messenger_ui_access', event.target.value)}>
                            <option value="admins">Только администраторам</option>
                            <option value="all">Всем пользователям</option>
                        </select>
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={values.messenger_ui_user_choice === 'true'} onChange={(event) => update('messenger_ui_user_choice', String(event.target.checked))} />
                        <span>Разрешить пользователям с доступом переключать интерфейс в меню чата</span>
                    </label>
                    <p className="text-sm opacity-70">Для безопасного тестирования сначала выберите «Только администраторам». Новая версия не изменяет данные переписок. При отключении доступа пользователи автоматически возвращаются к классическому виду.</p>
                    <button type="button" onClick={save} disabled={saving} className="btn-primary">{saving ? 'Сохранение…' : 'Сохранить настройки'}</button>
                </>}
                {message && <p role="status" aria-live="polite" className="text-sm">{message}</p>}
            </div>
        </div>
    );
}
