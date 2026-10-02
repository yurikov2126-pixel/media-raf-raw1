import Avatar from '../Avatar.jsx';

export default function GroupAvatar({ members = [], size = 46, onlineSet }) {
    const shown = members.slice(0, 4);
    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            <div className="grid grid-cols-2 gap-0.5 w-full h-full rounded-full overflow-hidden ring-2 ring-white/10">
                {shown.map((m) => (
                    <Avatar key={m.id} user={m} size={size / 2} online={onlineSet?.has(m.id)} />
                ))}
            </div>
        </div>
    );
}