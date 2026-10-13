import { api } from '../api/client.js';

/** Review notices used to contain only a homeworkId/practicalId, so resolve them for old and new notices. */
export async function learningNotificationPath(notification, token) {
    const p = notification?.payload || {};
    if (!p.homeworkId && !p.practicalId) return null;
    const query = new URLSearchParams();
    if (p.homeworkId) query.set('homeworkId', p.homeworkId);
    else query.set('practicalId', p.practicalId);
    const target = p.courseSlug && p.lessonOrder
        ? { courseSlug: p.courseSlug, lessonOrder: p.lessonOrder, kind: p.homeworkId ? 'homework' : 'practical' }
        : await api('/notifications/learning-target?' + query, { token });
    const params = new URLSearchParams();
    if (target.lessonOrder != null) params.set('lesson', String(target.lessonOrder));
    params.set('focus', target.kind);
    return '/app/courses/' + encodeURIComponent(target.courseSlug) + '?' + params.toString();
}
