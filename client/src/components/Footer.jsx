import { Link } from 'react-router-dom';
import { useSettings } from '../store/settings.jsx';

export default function Footer({ variant = 'landing' }) {
    const { footer, brand } = useSettings();

    const isApp = variant === 'app';

    return (
        <footer
            className={`${
                isApp
                    ? 'border-t border-white/5 py-6 px-5 text-xs'
                    : 'border-t border-white/5 py-8 px-5 text-sm'
            } text-white/40`}
        >
            <div className={`mx-auto ${isApp ? 'max-w-6xl' : 'max-w-7xl'} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
                <div>
                    <div className="font-bold text-white/70 mb-1">{brand.logoText}</div>
                    {footer.description && <div>{footer.description}</div>}
                </div>

                {footer.links.length > 0 && (
                    <div className="flex flex-wrap gap-4">
                        {footer.links.map((l, i) => (
                            <a
                                key={`${l.label}-${i}`}
                                href={l.url}
                                target={l.url?.startsWith('http') ? '_blank' : undefined}
                                rel="noreferrer"
                                className="hover:text-white transition"
                            >
                                {l.label}
                            </a>
                        ))}
                    </div>
                )}

                <div className="text-white/30">{footer.copyright}</div>
            </div>
        </footer>
    );
}