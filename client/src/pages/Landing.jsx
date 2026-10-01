import { Link } from 'react-router-dom';
import { useSettings } from '../store/settings.jsx';
import Footer from '../components/Footer.jsx';
import { Sticker } from '../stickers/pack.jsx';

export default function Landing() {
    const { landing, brand } = useSettings();

    return (
        <div className="overflow-hidden safe-top">
            <header className="max-w-7xl mx-auto px-5 py-6 flex items-center justify-between">
                <div className="text-xl font-bold">{brand.logoText}</div>
                <Link to="/login" className="btn-primary text-sm">Войти</Link>
            </header>

            {/* Hero */}
            <section className="max-w-7xl mx-auto px-5 pt-10 pb-20 grid md:grid-cols-2 gap-10 items-center">
                <div>
          <span className="chip bg-violet/20 text-violet-soft mb-4">
            {landing.badge}
          </span>

                    <h1 className="text-5xl md:text-7xl font-bold leading-[1.05] mb-6">
                        {landing.titlePrefix}{' '}
                        <span
                            className="bg-clip-text text-transparent"
                            style={{ backgroundImage: 'var(--brand-gradient)' }}
                        >
              {landing.titleAccent}
            </span>
                        {landing.titleSuffix}
                    </h1>

                    <p className="text-white/60 text-lg mb-8 max-w-lg">
                        {landing.subtitle}
                    </p>

                    <div className="flex flex-wrap gap-3">
                        <Link to="/login" className="btn-primary">{landing.ctaPrimary}</Link>
                        <a href="#features" className="btn-ghost">{landing.ctaSecondary}</a>
                    </div>

                    <div className="mt-10 flex gap-3">
                        <Sticker id="camera" size={90} />
                        <Sticker id="clapper" size={90} />
                        <Sticker id="radio" size={90} />
                    </div>
                </div>

                <div className="relative">
                    <div className="card p-6 rotate-2 shadow-glow">
                        <div className="flex gap-3 items-center mb-4">
                            <div
                                className="w-10 h-10 rounded-full"
                                style={{ background: 'var(--brand-gradient)' }}
                            />
                            <div>
                                <div className="font-bold">Radio Политех-FM</div>
                                <div className="text-xs text-white/50">в эфире · 24/7</div>
                            </div>
                            <span className="ml-auto chip bg-pink/20 text-pink-soft">LIVE</span>
                        </div>
                        <div className="h-32 rounded-2xl bg-gradient-to-r from-violet/30 via-pink/30 to-cyan/30 grid place-items-center text-5xl">
                            🎙️
                        </div>
                    </div>
                    <div className="card p-4 -rotate-3 absolute -bottom-8 -left-4 w-56 shadow-pink">
                        <div className="text-xs text-white/50 mb-1">Новый курс</div>
                        <div className="font-bold">Основы звукорежиссуры</div>
                        <div className="text-xs text-cyan-soft mt-1">12 уроков · тест</div>
                    </div>
                </div>
            </section>

            {/* Фичи */}
            <section id="features" className="max-w-7xl mx-auto px-5 py-20">
                <h2 className="text-3xl md:text-5xl font-bold mb-12">
                    {landing.featuresTitle}
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {landing.features.map((f, i) => (
                        <div
                            key={`${f.title}-${i}`}
                            className="card p-6 hover:-translate-y-1 transition"
                        >
                            <div className="text-4xl mb-3">{f.icon}</div>
                            <div className="font-bold text-lg mb-1">{f.title}</div>
                            <div className="text-sm text-white/60">{f.text}</div>
                        </div>
                    ))}
                    {landing.features.length === 0 && (
                        <div className="card p-6 col-span-full text-center text-white/40">
                            Фичи не настроены. Настройте их в админке → 🎨 Дизайн сайта.
                        </div>
                    )}
                </div>
            </section>

            {/* CTA */}
            <section className="max-w-7xl mx-auto px-5 pb-24">
                <div className="card p-10 text-center relative overflow-hidden">
                    <div
                        className="absolute inset-0 opacity-30"
                        style={{ backgroundImage: 'var(--brand-gradient)' }}
                    />
                    <div className="relative">
                        <h3 className="text-3xl md:text-5xl font-bold mb-4">
                            {landing.ctaTitle}
                        </h3>
                        <p className="text-white/70 mb-6">{landing.ctaSubtitle}</p>
                        <Link to="/login" className="btn-primary">
                            {landing.ctaButton}
                        </Link>
                    </div>
                </div>
            </section>

            <Footer variant="landing" />
        </div>
    );
}