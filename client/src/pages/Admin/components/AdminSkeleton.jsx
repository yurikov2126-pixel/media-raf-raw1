/**
 * Скелетон-заглушка, пока подгружается чанк вкладки.
 * Показываем нейтральные блоки — пользователь видит, что «что-то грузится»,
 * а не пустой экран.
 */
export default function AdminSkeleton() {
    return (
        <div className="space-y-5 animate-pulse">
            {/* Карточка-заголовок */}
            <div className="card p-5">
                <div className="h-6 w-48 bg-white/5 rounded-lg mb-3" />
                <div className="h-4 w-72 bg-white/5 rounded-lg" />
            </div>

            {/* Сетка карточек (как в Dashboard/статистике) */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="card p-5">
                        <div className="h-8 w-8 bg-white/5 rounded-lg mb-3" />
                        <div className="h-7 w-20 bg-white/5 rounded-lg mb-2" />
                        <div className="h-4 w-32 bg-white/5 rounded-lg" />
                    </div>
                ))}
            </div>

            {/* Широкая карточка (как таблица/список) */}
            <div className="card p-5">
                <div className="h-5 w-40 bg-white/5 rounded-lg mb-4" />
                <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-10 bg-white/5 rounded-lg" />
                    ))}
                </div>
            </div>
        </div>
    );
}