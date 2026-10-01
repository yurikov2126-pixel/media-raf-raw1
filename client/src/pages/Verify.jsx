import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

const BASE = import.meta.env.VITE_API || 'http://localhost:4000/api';

export default function Verify() {
    const { serial } = useParams();
    const [cert, setCert] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        fetch(`${BASE}/public/certificates/${encodeURIComponent(serial)}`)
            .then(async (r) => {
                const data = await r.json();
                if (!r.ok) throw new Error(data.error || 'Не найден');
                setCert(data);
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [serial]);

    return (
        <div className="min-h-screen p-5 md:p-10 flex items-center justify-center">
            <div className="w-full max-w-2xl">
                <div className="text-center mb-6">
                    <Link to="/" className="text-2xl font-bold bg-clip-text text-transparent"
                          style={{ backgroundImage: 'var(--brand-gradient)' }}>
                        MEDIA·RAF·RAW
                    </Link>
                    <div className="text-xs text-white/40 mt-1">Проверка сертификата</div>
                </div>

                {loading && (
                    <div className="card p-10 text-center text-white/50">Проверяем…</div>
                )}

                {!loading && error && (
                    <div className="card p-8 text-center">
                        <div className="text-6xl mb-3">❌</div>
                        <div className="text-2xl font-bold text-pink mb-2">Сертификат не найден</div>
                        <div className="text-white/50 text-sm mb-6">
                            Серийный номер <span className="font-mono text-white/70">{serial}</span> не обнаружен в реестре.
                        </div>
                        <Link to="/" className="btn-ghost">На главную</Link>
                    </div>
                )}

                {!loading && cert && (
                    <div className="card p-8" style={{ background: 'linear-gradient(135deg, #84CC1615 0%, #06B6D415 100%)' }}>
                        <div className="text-center mb-6">
                            <div className="text-6xl mb-3">✅</div>
                            <div className="text-2xl md:text-3xl font-bold text-lime mb-1">Сертификат подлинный</div>
                            <div className="text-xs text-white/50">Выдан платформой MEDIA·RAF·RAW</div>
                        </div>

                        <div className="space-y-3">
                            <Row label="Владелец" value={cert.user.fullName} extra={`@${cert.user.username}`} />
                            <Row label="Курс" value={cert.course.title} />
                            <Row label="Название" value={cert.title} />
                            {cert.description && <Row label="Описание" value={cert.description} />}
                            <Row label="Серийный номер" value={cert.serial} mono />
                            <Row label="Дата выдачи" value={new Date(cert.issuedAt).toLocaleDateString('ru-RU')} />
                        </div>

                        <div className="mt-6 text-center text-xs text-white/40">
                            Проверено {new Date().toLocaleString('ru-RU')}
                        </div>
                    </div>
                )}

                <div className="text-center mt-6 text-xs text-white/30">
                    © {new Date().getFullYear()} MEDIA·RAF·RAW
                </div>
            </div>
        </div>
    );
}

function Row({ label, value, extra, mono }) {
    return (
        <div className="flex flex-col md:flex-row md:items-baseline gap-1 md:gap-4 border-b border-white/5 pb-3 last:border-0">
            <div className="text-xs uppercase tracking-wider text-white/40 md:w-40 shrink-0">{label}</div>
            <div className={`flex-1 ${mono ? 'font-mono text-violet-soft' : 'font-semibold'}`}>
                {value}
                {extra && <span className="text-white/40 text-xs ml-2">{extra}</span>}
            </div>
        </div>
    );
}