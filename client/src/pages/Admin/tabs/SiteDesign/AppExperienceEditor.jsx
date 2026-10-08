function boolValue(value, fallback = true) {
  if (value == null || value === '') return fallback;
  return value !== false && value !== 'false';
}

function Choice({ value, current, children, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`rounded-2xl border-2 p-4 text-left transition ${current === value ? 'border-violet bg-violet/10' : 'border-white/5 hover:border-white/15'}`}
    >
      {children}
    </button>
  );
}

export default function AppExperienceEditor({ settings, update }) {
  const enabled = boolValue(settings.dashboard_enabled, true);
  const commandEnabled = boolValue(settings.command_palette_enabled, true);

  return (
    <div className="space-y-5">
      <section>
        <div className="ui-kicker">Главный экран</div>
        <div className="text-lg font-bold mt-1">Dashboard 2.0</div>
        <div className="text-sm text-white/50 mt-1">
          Управляйте содержимым рабочего пространства: какие блоки видны участникам и какие тексты используются.
        </div>
      </section>

      <div className="card p-4">
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div>
            <div className="font-semibold">Включить Dashboard</div>
            <div className="text-xs text-white/45 mt-1">При выключении /app открывает классическую ленту.</div>
          </div>
          <input type="checkbox" checked={enabled} onChange={(e) => update({ dashboard_enabled: e.target.checked ? 'true' : 'false' })} />
        </label>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {[
          ['dashboard_show_greeting', 'Приветствие и дата'],
          ['dashboard_show_quick_actions', 'Быстрые действия'],
          ['dashboard_show_learning', 'Обучение'],
          ['dashboard_show_gamification', 'Геймификация'],
          ['dashboard_show_notifications', 'Уведомления'],
          ['dashboard_show_feed_preview', 'Превью ленты'],
        ].map(([key, label]) => (
          <label key={key} className="card p-4 flex items-center justify-between gap-3 cursor-pointer">
            <span className="text-sm font-semibold">{label}</span>
            <input
              type="checkbox"
              checked={boolValue(settings[key], true)}
              onChange={(e) => update({ [key]: e.target.checked ? 'true' : 'false' })}
            />
          </label>
        ))}
      </div>

      <div className="card p-4">
        <div className="font-semibold mb-3">Тексты Dashboard</div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-white/40 uppercase tracking-wider">Главный заголовок</label>
            <input className="input mt-1" value={settings.dashboard_welcome_title || ''} onChange={(e) => update({ dashboard_welcome_title: e.target.value })} placeholder="Твоя медиа-команда в одном месте" />
          </div>
          <div>
            <label className="text-xs text-white/40 uppercase tracking-wider">Подзаголовок</label>
            <textarea className="input mt-1 min-h-24 resize-y" value={settings.dashboard_welcome_subtitle || ''} onChange={(e) => update({ dashboard_welcome_subtitle: e.target.value })} placeholder="..." />
          </div>
        </div>
      </div>

      <section>
        <div className="ui-kicker">Командная палитра</div>
        <div className="text-lg font-bold mt-1">⌘K / Ctrl+K</div>
        <div className="text-sm text-white/50 mt-1">Быстрый переход к разделам платформы и действиям.</div>
      </section>

      <label className="card p-4 flex items-center justify-between gap-4 cursor-pointer">
        <div>
          <div className="font-semibold">Включить глобальный поиск</div>
          <div className="text-xs text-white/45 mt-1">Палитра доступна во всей авторизованной части сайта.</div>
        </div>
        <input type="checkbox" checked={commandEnabled} onChange={(e) => update({ command_palette_enabled: e.target.checked ? 'true' : 'false' })} />
      </label>

      <div className="card p-4">
        <div className="font-semibold mb-3">Параметры интерфейса</div>
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Размер текста</div>
            <div className="grid grid-cols-3 gap-2">
              {[['0.95','Меньше'],['1','Стандарт'],['1.05','Больше']].map(([v,l]) => (
                <Choice key={v} value={v} current={settings.ui_font_scale || '1'} onChange={(next) => update({ ui_font_scale: next })}>{l}</Choice>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Скругления</div>
            <div className="grid grid-cols-3 gap-2">
              {[['compact','Компактные'],['standard','Стандарт'],['soft','Мягкие']].map(([v,l]) => (
                <Choice key={v} value={v} current={settings.ui_radius || 'standard'} onChange={(next) => update({ ui_radius: next })}>{l}</Choice>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Анимации</div>
            <div className="grid grid-cols-2 gap-2">
              {[['full','Полные'],['reduced','Минимум']].map(([v,l]) => (
                <Choice key={v} value={v} current={settings.ui_motion || 'full'} onChange={(next) => update({ ui_motion: next })}>{l}</Choice>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
