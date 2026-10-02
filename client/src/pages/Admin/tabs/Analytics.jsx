import { useEffect, useState } from 'react';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
    BarChart, Bar, LineChart, Line,
} from 'recharts';
import { api } from '../../../api/client.js';

export default function Analytics({ token }) {
    const [period, setPeriod] = useState(30);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        setLoading(true);
        setError('');
        api(`/admin/analytics?period=${period}`, { token })
            .then(setData)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [period, token]);

    if (loading && !data) return <div className="card p-6 text-center text-white/50">Загрузка…</div>;
    if (error) return <div className="card p-4 text-pink bg-pink/10">{error}</div>;
    if (!data) return null;

    return (
        <div className="space-y-5">
            <div className="card p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="font-bold text-lg">📈 Аналитика</div>
                <div className="flex gap-2">
                    {[7, 30, 90, 180].map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`chip ${period === p ? 'bg-violet text-white' : 'bg-white/5 text-white/60'}`}
                        >
                            {p} дн.
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                    ['👥', 'Пользователи', data.totals.users],
                    ['📚', 'Курсы', data.totals.courses],
                    ['✉️', 'Сообщения', data.totals.messages],
                    ['📝', 'Посты', data.totals.posts],
                    ['💬', 'Комментарии', data.totals.comments],
                ].map(([i, l, v]) => (
                    <div key={l} className="card p-4">
                        <div className="text-2xl mb-1">{i}</div>
                        <div className="text-2xl font-bold">{v}</div>
                        <div className="text-xs text-white/50">{l}</div>
                    </div>
                ))}
            </div>

            <div className="card p-5">
                <div className="font-bold mb-4">Регистрации по дням</div>
                <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer>
                        <AreaChart data={data.registrationsByDay}>
                            <defs>
                                <linearGradient id="regGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.8} />
                                    <stop offset="100%" stopColor="#7C3AED" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="label" stroke="rgba(255,255,255,0.4)" fontSize={11} />
                            <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} allowDecimals={false} />
                            <Tooltip contentStyle={{ background: '#171728', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} />
                            <Area type="monotone" dataKey="value" name="Регистрации" stroke="#A78BFA" strokeWidth={2} fill="url(#regGrad)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="card p-5">
                <div className="font-bold mb-4">Активность по дням</div>
                <div style={{ width: '100%', height: 280 }}>
                    <ResponsiveContainer>
                        <LineChart data={data.activityByDay}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="label" stroke="rgba(255,255,255,0.4)" fontSize={11} />
                            <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} allowDecimals={false} />
                            <Tooltip contentStyle={{ background: '#171728', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} />
                            <Line type="monotone" dataKey="messages" name="Сообщения" stroke="#EC4899" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="comments" name="Комментарии" stroke="#06B6D4" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="posts" name="Посты" stroke="#84CC16" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
                <div className="card p-5">
                    <div className="font-bold mb-4">Топ курсов по записям</div>
                    {data.topCourses.length === 0 ? (
                        <div className="text-center text-white/40 py-8">Нет данных</div>
                    ) : (
                        <div style={{ width: '100%', height: 300 }}>
                            <ResponsiveContainer>
                                <BarChart data={data.topCourses} layout="vertical" margin={{ left: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis type="number" stroke="rgba(255,255,255,0.4)" fontSize={11} allowDecimals={false} />
                                    <YAxis type="category" dataKey="title" stroke="rgba(255,255,255,0.4)" fontSize={10} width={140} />
                                    <Tooltip contentStyle={{ background: '#171728', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} />
                                    <Bar dataKey="enrollments" name="Записей" fill="#7C3AED" radius={[0, 8, 8, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                <div className="card p-5">
                    <div className="font-bold mb-4">Топ постов</div>
                    {data.topPosts.length === 0 ? (
                        <div className="text-center text-white/40 py-8">Нет данных</div>
                    ) : (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                            {data.topPosts.map((p, i) => (
                                <div key={p.id} className="p-3 rounded-xl bg-white/5">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-bold text-violet-soft">#{i + 1}</span>
                                        <span className="text-sm font-semibold truncate">{p.author.fullName}</span>
                                        <span className="text-[10px] text-white/40 ml-auto shrink-0">
                                            💬 {p.comments} · ❤️ {p.reactions}
                                        </span>
                                    </div>
                                    <div className="text-xs text-white/60 line-clamp-2">{p.content || '(без текста)'}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}