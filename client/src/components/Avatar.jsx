export default function Avatar({ user, size = 44, online = false }) {
    const initials = user?.fullName
        ?.split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

    const dot = online
        ? Math.max(8, Math.round(size * 0.24))
        : 0;

    const inner = user?.avatar ? (
        <img
            src={user.avatar}
            alt=""
            style={{ width: size, height: size }}
            className="rounded-full object-cover ring-2 ring-white/10"
        />
    ) : (
        <div
            style={{ width: size, height: size, fontSize: size * 0.4 }}
            className="rounded-full grid place-items-center font-bold text-white ring-2 ring-white/10"
        >
            <div
                className="w-full h-full rounded-full grid place-items-center"
                style={{ background: 'var(--brand-gradient)' }}
            >
                {initials}
            </div>
        </div>
    );

    if (!dot) return inner;

    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            {inner}
            <span
                className="absolute rounded-full bg-lime border-2 border-ink-900"
                style={{ width: dot, height: dot, right: -1, bottom: -1 }}
                title="В сети"
            />
        </div>
    );
}