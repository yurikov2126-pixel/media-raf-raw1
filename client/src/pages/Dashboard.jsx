import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import { useGamification } from '../store/gamification.jsx';
import { useNotifications } from '../store/notifications.jsx';
import { useSettings } from '../store/settings.jsx';
import Icon from '../components/Icon.jsx';
import XpProgressBar from '../components/XpProgressBar.jsx';
import usePageMeta from '../hooks/usePageMeta.js';

const NOTIFICATION_ICON = {
  message: 'message',
  mention: 'bell',
  post: 'feed',
  certificate: 'trophy',
  lesson_new: 'book',
  lesson_unlocked: 'book',
  practical_scheduled: 'calendar',
  practical_due: 'clock',
  homework_due: 'book',
  homework_overdue: 'clock',
  report: 'bell',
  password_reset: 'settings',
  system: 'sparkles',
};

function notificationTitle(item) {
  const p = item.payload || {};
  switch (item.type) {
    case 'mention': return p.commentId ? 'Вас упомянули в комментарии' : p.postId ? 'Вас упомянули в публикации' : 'Вас упомянули в чате';
    case 'message': return 'Новое сообщение' + (p.senderName ? ' от ' + p.senderName : '');
    case 'post': return 'Новая публикация' + (p.authorName ? ' от ' + p.authorName : '');
    case 'certificate': return 'Новый сертификат';
    case 'system': return p.title || 'Системное уведомление';
    default: return p.title || 'Новое уведомление';
  }
}

function notificationPreview(item) {
  const p = item.payload || {};
  return p.preview || p.message || (item.type === 'post' ? 'Открыть публикацию' : 'Открыть уведомление');
}

export default function Dashboard() {
  const { user, token } = useAuth();
  const { dashboard, brand } = useSettings();
  const gamif = useGamification();
  const notifications = useNotifications();
  const navigate = useNavigate();

  const [courses, setCourses] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  usePageMeta({
    title: 'Главная',
    description: 'Рабочее пространство MEDIA·RAF·RAW',
  });

  useEffect(() => {
    if (!token) return;
    let alive = true;

    Promise.allSettled([
      api('/courses', { token }),
      api('/posts/feed?limit=3', { token }),
    ]).then(([courseResult, postResult]) => {
      if (!alive) return;
      if (courseResult.status === 'fulfilled' && Array.isArray(courseResult.value)) {
        setCourses(courseResult.value);
      }
      if (postResult.status === 'fulfilled') {
        setPosts(postResult.value?.items || []);
      }
      setLoading(false);
    });

    return () => { alive = false; };
  }, [token]);

  const enrolledCourse = useMemo(
    () =>
      courses
        .filter((course) => course.enrolled)
        .sort((a, b) => (b.progress || 0) - (a.progress || 0))[0] || null,
    [courses]
  );

  const latestNotifications = notifications.items.slice(0, 4);
  const unread = notifications.unread;
  const firstName = user?.fullName?.split(' ')?.[0] || 'участник';
  const show = (value) => value !== false;

  const createPost = () => {
    navigate(`/app/u/${user.username}`, { state: { compose: true } });
  };

  if (!dashboard.enabled) return <Navigate to="/app/feed" replace />;

  const actions = [
    {
      label: 'Новая публикация',
      sub: 'Поделиться материалом',
      icon: 'plus',
      onClick: createPost,
    },
    {
      label: 'Открыть чаты',
      sub: 'Команда и сообщения',
      icon: 'message',
      to: '/app/chats',
    },
    {
      label: 'Продолжить обучение',
      sub: enrolledCourse ? enrolledCourse.title : 'Выбрать курс',
      icon: 'book',
      to: enrolledCourse ? `/app/courses/${enrolledCourse.slug}` : '/app/courses',
    },
    {
      label: 'Уведомления',
      sub: unread > 0 ? `${unread} непрочитанных` : 'Всё спокойно',
      icon: 'bell',
      to: '/app/notifications',
    },
  ];

  return (
    <div className="ui-page">      <section className="ui-hero">
        <div className="ui-eyebrow"><Icon name="sparkles" size={13} /> {brand.logoText}</div>
        <h1 className="ui-hero__title">
          {dashboard.welcomeTitle.split('контент').map((part, i) => (
            i === 0
              ? <span key={i}>{part}</span>
              : <><strong key={i}>контент</strong>{part}</>
          ))}
        </h1>
        <p className="ui-hero__subtitle">{dashboard.welcomeSubtitle}</p>

        {dashboard.showQuickActions && (
          <div className="ui-quick-actions">
            {actions.map((action) => {
              const content = (
                <>
                  <span className="ui-action__icon"><Icon name={action.icon} size={18} /></span>
                  <span className="ui-action__copy">
                    <span className="ui-action__title">{action.label}</span>
                    <span className="ui-action__sub">{action.sub}</span>
                  </span>
                  <span className="ui-action__arrow" aria-hidden="true"><Icon name="chevronRight" size={15} /></span>
                </>
              );

              return action.onClick ? (
                <button key={action.label} type="button" onClick={action.onClick} className="ui-action">
                  {content}
                </button>
              ) : (
                <Link key={action.label} to={action.to} className="ui-action">
                  {content}
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {(dashboard.showNotifications || dashboard.showGamification || dashboard.showLearning) && (
        <section className="ui-section">
          <div className="ui-stat-grid">
            {dashboard.showNotifications && (
              <Link to="/app/notifications" className="ui-stat">
                <div className="ui-stat__label">Уведомления</div>
                <div className="ui-stat__value">{unread}</div>
                <div className="ui-stat__hint">{unread ? 'Нужно посмотреть' : 'Новых нет'}</div>
              </Link>
            )}
            {dashboard.showGamification && gamif.enabled && gamif.stats && (
              <Link to="/app/leaderboard" className="ui-stat">
                <div className="ui-stat__label">Уровень</div>
                <div className="ui-stat__value">{gamif.stats.level}</div>
                <div className="ui-stat__hint">{gamif.stats.xp} XP</div>
              </Link>
            )}
            {dashboard.showLearning && (
              <Link to="/app/courses" className="ui-stat">
                <div className="ui-stat__label">Обучение</div>
                <div className="ui-stat__value">{courses.filter((c) => c.enrolled).length}</div>
                <div className="ui-stat__hint">активных курсов</div>
              </Link>
            )}
            <Link to={`/app/u/${user.username}`} className="ui-stat">
              <div className="ui-stat__label">Профиль</div>
              <div className="ui-stat__value"><Icon name="arrowRight" size={21} /></div>
              <div className="ui-stat__hint">Портфолио и достижения</div>
            </Link>
          </div>
        </section>
      )}

      <section className="ui-section ui-two-col">
        {dashboard.showLearning && (
          <div className="ui-card2">
            <div className="ui-section-head">
              <div>
                <div className="ui-card2__title">Продолжить обучение</div>
                <div className="ui-card2__muted">
                  {enrolledCourse ? 'Последний активный курс' : 'Ты ещё не записан ни на один курс'}
                </div>
              </div>
              <Link className="ui-section-link" to="/app/courses">
                Все курсы <Icon name="chevronRight" size={15} />
              </Link>
            </div>

            {loading ? (
              <div className="text-sm text-white/35 py-7">Загрузка курса…</div>
            ) : enrolledCourse ? (
              <Link to={`/app/courses/${enrolledCourse.slug}`} className="block">
                <div className="flex items-center gap-3">
                  {enrolledCourse.cover ? (
                    <img src={enrolledCourse.cover} alt="" className="w-14 h-14 rounded-2xl object-cover border border-white/10" />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl grid place-items-center bg-violet/15 text-violet-soft">
                      <Icon name="book" size={22} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm truncate">{enrolledCourse.title}</div>
                    <div className="text-xs text-white/40 mt-1">
                      Прогресс {enrolledCourse.progress || 0}%
                    </div>
                  </div>
                  <Icon name="arrowRight" size={18} className="text-white/35" />
                </div>
                <div className="ui-course-progress"><span style={{ width: `${Math.min(100, Math.max(0, enrolledCourse.progress || 0))}%` }} /></div>
              </Link>
            ) : (
              <Link to="/app/courses" className="ui-action mt-3">
                <span className="ui-action__icon"><Icon name="book" size={18} /></span>
                <span className="ui-action__copy">
                  <span className="ui-action__title">Выбрать курс</span>
                  <span className="ui-action__sub">Фото · Видео · Радио · Звук</span>
                </span>
                <Icon name="chevronRight" size={15} />
              </Link>
            )}
          </div>
        )}

        {dashboard.showGamification && gamif.enabled && gamif.stats && (
          <div className="ui-card2">
            <div className="ui-section-head">
              <div>
                <div className="ui-card2__title">Твой прогресс</div>
                <div className="ui-card2__muted">Растём не только в количестве постов</div>
              </div>
              <Icon name="zap" size={17} className="text-violet-soft" />
            </div>
            <div className="flex items-end justify-between gap-3 mt-5">
              <div>
                <div className="text-3xl font-bold tracking-tight">{gamif.stats.xp} XP</div>
                <div className="text-xs text-white/40 mt-1">Уровень {gamif.stats.level}</div>
              </div>
              {gamif.stats.streakCurrent > 0 && (
                <div className="chip bg-orange-500/15 text-orange-300">🔥 {gamif.stats.streakCurrent} дн.</div>
              )}
            </div>
            <XpProgressBar progress={gamif.progress} className="mt-5" />
            <Link to="/app/leaderboard" className="ui-section-link mt-4">Открыть рейтинг <Icon name="chevronRight" size={15} /></Link>
          </div>
        )}
      </section>

      {dashboard.showNotifications && (
        <section className="ui-section">
          <div className="ui-section-head">
            <div>
              <div className="ui-section-title">Последние уведомления</div>
              <div className="ui-card2__muted">{unread ? `${unread} требуют внимания` : 'Ничего срочного'}</div>
            </div>
            <Link className="ui-section-link" to="/app/notifications">Все <Icon name="chevronRight" size={15} /></Link>
          </div>
          <div className="ui-card2">
            {latestNotifications.length === 0 ? (
              <div className="py-6 text-center text-sm text-white/35">Здесь появятся системные и командные события.</div>
            ) : (
              <div className="ui-mini-list">
                {latestNotifications.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      const p = item.payload || {};
                      if (item.type === 'mention' && p.postId) navigate(`/app/feed?post=${encodeURIComponent(p.postId)}${p.commentId ? `&comment=${encodeURIComponent(p.commentId)}` : ''}`);
                      else if ((item.type === 'message' || item.type === 'mention') && p.chatId) navigate(`/app/chats/${encodeURIComponent(p.chatId)}`);
                      else if (item.type === 'post' && p.postId) navigate(`/app/feed?post=${encodeURIComponent(p.postId)}`);
                      else if (item.type === 'post' && p.authorUsername) navigate(`/app/u/${encodeURIComponent(p.authorUsername)}`);
                      else if (item.type === 'certificate' && p.certificateId) navigate(`/app/certificates/${encodeURIComponent(p.certificateId)}`);
                      else navigate('/app/notifications');
                    }}
                    className="ui-mini-list__item w-full text-left flex items-center gap-3 min-w-0"
                  >
                    <span className="ui-mini-list__icon shrink-0">
                      <Icon name={NOTIFICATION_ICON[item.type] || 'bell'} size={16} />
                    </span>
                    <span className="ui-mini-list__copy flex-1 min-w-0 flex flex-col gap-1">
                      <span className="ui-mini-list__title block text-sm font-semibold leading-snug break-words">{notificationTitle(item)}</span>
                      <span className="ui-mini-list__sub block text-xs leading-relaxed opacity-65 break-words line-clamp-2">{notificationPreview(item)}</span>
                    </span>
                    {!item.readAt && <span className="w-2 h-2 rounded-full bg-pink mt-3 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {dashboard.showFeedPreview && (
        <section className="ui-section">
          <div className="ui-section-head">
            <div>
              <div className="ui-section-title">Лента команды</div>
              <div className="ui-card2__muted">Свежие материалы MEDIA·RAF·RAW</div>
            </div>
            <Link className="ui-section-link" to="/app/feed">Открыть ленту <Icon name="arrowRight" size={15} /></Link>
          </div>

          <div className="ui-card2">
            {loading ? (
              <div className="py-6 text-center text-sm text-white/35">Загружаем публикации…</div>
            ) : posts.length === 0 ? (
              <div className="py-6 text-center text-sm text-white/35">Публикаций пока нет.</div>
            ) : (
              <div className="ui-feed-grid">
                {posts.map((post) => (
                  <article key={post.id} className="ui-feed-item">
                    <div className="ui-feed-avatar">
                      {post.author?.avatar ? <img src={post.author.avatar} alt="" /> : <Icon name="user" size={18} />}
                    </div>
                    <div className="ui-feed-content">
                      <div className="ui-feed-author">{post.author?.fullName || 'Участник'}</div>
                      <div className="ui-feed-meta">
                        {post.createdAt ? new Date(post.createdAt).toLocaleDateString('ru-RU') : ''}
                      </div>
                      {post.content && <div className="ui-feed-text">{post.content}</div>}
                      {post.mediaUrl && String(post.mediaType || '').startsWith('image') && (
                        <img className="ui-feed-media" src={post.mediaUrl} alt="" loading="lazy" />
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
