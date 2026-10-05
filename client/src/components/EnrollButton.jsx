import { useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';

export default function EnrollButton({ course, onEnrolled, className = 'btn-primary' }) {
    const { token } = useAuth();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const handleEnroll = async () => {
        setBusy(true);
        setError('');
        try {
            const res = await api(`/courses/${course.slug || course.id}/enroll`, {
                token,
                method: 'POST',
            });
            onEnrolled?.(res);
        } catch (e) {
            setError(e.message || 'Не удалось записаться');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div>
            <button onClick={handleEnroll} disabled={busy} className={className}>
                {busy ? 'Записываем…' : 'Записаться на курс'}
            </button>
            {error && <div className="text-xs text-red-400 mt-2">{error}</div>}
        </div>
    );
}