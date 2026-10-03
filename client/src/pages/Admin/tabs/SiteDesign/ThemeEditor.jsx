import { useTheme } from '../../../../store/theme.jsx';

export default function ThemeEditor({ settings, update }) {
    const { theme, resolved, setTheme } = useTheme();

    const defaultTheme = settings.theme_default === 'light' ? 'light' : 'dark';

    return (
        <div className="space-y-5">
            <div>
                <div className="text-sm text-white/60 leading-relaxed">
                    Тема, которую пользователи видят при первом входе. Каждый может
                    переопределить её в шапке приложения — тогда выбор хранится
                    в браузере и не зависит от этой настройки.
                </div>
            </div>

            {/* Выбор темы по умолчанию */}
            <div>
                <label className="text-xs text-white/40 uppercase tracking-wider block mb-2">
                    Тема по умолчанию
                </label>
                <div className="grid sm:grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={() => update({ theme_default: 'dark' })}
                        className={`rounded-2xl p-4 text-left transition border-2 ${
                            defaultTheme === 'dark'
                                ? 'border-violet bg-violet/10'
                                : 'border-white/5 hover:border-white/15'
                        }`}
                    >
                        <div
                            className="h-24 rounded-xl mb-3 flex items-center justify-center text-3xl"
                            style={{
                                background: 'linear-gradient(135deg, #0a0a14 0%, #1a1a2e 100%)',
                                border: '1px solid rgba(255,255,255,.1)',
                            }}
                        >
                            🌙
                        </div>
                        <div className="font-bold">Тёмная</div>
                        <div className="text-xs text-white/50 mt-1">
                            По умолчанию. Комфортна для вечернего просмотра.
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => update({ theme_default: 'light' })}
                        className={`rounded-2xl p-4 text-left transition border-2 ${
                            defaultTheme === 'light'
                                ? 'border-violet bg-violet/10'
                                : 'border-white/5 hover:border-white/15'
                        }`}
                    >
                        <div
                            className="h-24 rounded-xl mb-3 flex items-center justify-center text-3xl"
                            style={{
                                background: 'linear-gradient(135deg, #f5f5f7 0%, #ffffff 100%)',
                                border: '1px solid rgba(0,0,0,.08)',
                            }}
                        >
                            ☀️
                        </div>
                        <div className="font-bold">Светлая</div>
                        <div className="text-xs text-white/50 mt-1">
                            Для яркого света и печати. Меньше нагрузки на глаза днём.
                        </div>
                    </button>
                </div>
            </div>

            {/* Ваш личный выбор */}
            <div className="rounded-2xl bg-ink-700/50 p-4">
                <div className="text-xs text-white/40 uppercase tracking-wider mb-2">
                    Ваш текущий выбор
                </div>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-sm">
                        {theme === 'system' && (
                            <>
                                <span className="font-semibold">Системная тема</span>
                                <span className="text-white/50 ml-2">
                                    (сейчас: {resolved === 'light' ? 'светлая' : 'тёмная'})
                                </span>
                            </>
                        )}
                        {theme === 'light' && <span className="font-semibold">☀️ Светлая</span>}
                        {theme === 'dark' && <span className="font-semibold">🌙 Тёмная</span>}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setTheme('dark')}
                            className={`chip ${
                                theme === 'dark' ? 'bg-violet text-white' : 'bg-white/5 text-white/60'
                            }`}
                        >
                            🌙 Тёмная
                        </button>
                        <button
                            onClick={() => setTheme('light')}
                            className={`chip ${
                                theme === 'light' ? 'bg-violet text-white' : 'bg-white/5 text-white/60'
                            }`}
                        >
                            ☀️ Светлая
                        </button>
                        <button
                            onClick={() => setTheme('system')}
                            className={`chip ${
                                theme === 'system' ? 'bg-violet text-white' : 'bg-white/5 text-white/60'
                            }`}
                        >
                            🌗 Системная
                        </button>
                    </div>
                </div>
                <div className="text-xs text-white/40 mt-2">
                    Это ваш личный выбор — он применяется к текущему браузеру
                    и не влияет на других пользователей.
                </div>
            </div>
        </div>
    );
}