import { useTheme } from '../store/theme.jsx';

/* Переключатель темы. По клику — цикл: dark → light → system → dark.
   Иконки:
     dark    — 🌙
     light   — ☀️
     system  — 🌗 (полумесяц/солнце) */

export default function ThemeToggle({ className }) {
    const { theme, resolved, toggle } = useTheme();

    const icon = theme === 'system' ? '🌗' : theme === 'light' ? '☀️' : '🌙';

    const title =
        theme === 'system'
            ? `Системная (сейчас: ${resolved === 'light' ? 'светлая' : 'тёмная'})`
            : theme === 'light'
                ? 'Светлая тема'
                : 'Тёмная тема';

    return (
        <button
            type="button"
            onClick={toggle}
            className={
                className ||
                'w-11 h-11 grid place-items-center rounded-2xl hover:bg-white/5 transition text-lg'
            }
            title={`${title}. Нажмите для переключения.`}
            aria-label="Переключить тему"
        >
            <span>{icon}</span>
        </button>
    );
}