import { Link } from 'react-router-dom';

export default function WikiContextLink({ topic, label = 'Справочник ВикиМедиа' }) {
    const words = String(topic || '').trim().split(/\s+/).filter(Boolean);
    const query = words.slice(0, 3).join(' ');
    const href = query ? '/app/wiki?q=' + encodeURIComponent(query) : '/app/wiki';
    return <Link to={href} className="inline-flex max-w-full items-center gap-2 rounded-xl border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-sm text-violet-soft hover:bg-violet-500/20">
        <span aria-hidden="true">📖</span><span>{label}</span><span aria-hidden="true">→</span>
    </Link>;
}
