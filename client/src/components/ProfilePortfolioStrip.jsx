import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';

function Stat({ value, label }) {
  return (
    <div className="profile-v2__stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export default function ProfilePortfolioStrip({ profile, gamif, gamifEnabled }) {
  const mediaPosts = (profile.posts || [])
    .filter((post) => post.mediaUrl && String(post.mediaType || '').startsWith('image'))
    .slice(0, 6);

  const stats = gamif?.stats;

  return (
    <section className="profile-v2__portfolio mt-5">
      <div className="profile-v2__stats">
        <Stat value={(profile.posts || []).length} label="Публикаций" />
        <Stat value={(profile.enrollments || []).length} label="Курсов" />
        <Stat value={(profile.certificates || []).length} label="Сертификатов" />
        {gamifEnabled && stats && <Stat value={stats.xp ?? 0} label="XP" />}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <div>
          <div className="ui-kicker">Media portfolio</div>
          <div className="text-lg font-bold mt-1">Избранные материалы</div>
        </div>
        <Link to="#posts" className="ui-section-link">
          Все работы <Icon name="chevronRight" size={15} />
        </Link>
      </div>

      {mediaPosts.length > 0 ? (
        <div className="profile-v2__mosaic mt-3">
          {mediaPosts.map((post) => (
            <button
              key={post.id}
              type="button"
              className="profile-v2__media"
              onClick={() => window.dispatchEvent(new CustomEvent('mrr:profile-media', { detail: { postId: post.id } }))}
              title="Открыть публикацию"
            >
              <img src={post.mediaUrl} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      ) : (
        <div className="profile-v2__empty mt-3">
          <div className="profile-v2__empty-icon"><Icon name="layers" size={22} /></div>
          <div>
            <div className="font-bold text-sm">Портфолио пока пустое</div>
            <div className="text-xs text-white/45 mt-1">Добавь фото в публикации — они появятся здесь автоматически.</div>
          </div>
        </div>
      )}
    </section>
  );
}
