import { mentionTitle, mentionPreview } from './mentionNotification.js';

const editorialLabels = {
 assigned: 'Вам назначено задание', status: 'Изменён статус задания',
 comment: 'Новый комментарий к заданию', application: 'Новая заявка на задание',
 application_approved: 'Ваша заявка одобрена', application_rejected: 'Решение по вашей заявке',
 deadline_soon: 'Скоро срок задания', deadline_overdue: 'Задание просрочено',
 review_submitted: 'Материал отправлен на проверку',
 review_approved: 'Материал утверждён', review_revision: 'Материал возвращён на доработку',
};

export function notificationTitle(n) {
 const p = n?.payload || {};
 switch (n?.type) {
  case 'mention': return mentionTitle(p);
  case 'message': return p.chatTitle ? 'Сообщение в чате «' + p.chatTitle + '»' : 'Сообщение от ' + (p.senderName || 'участника');
  case 'editorial': return (editorialLabels[p.event] || 'Событие редакции') + (p.taskTitle ? ': ' + p.taskTitle : '');
  case 'post': return p.authorName ? 'Новая публикация от ' + p.authorName : 'Новая публикация';
  case 'certificate': return p.title || (p.courseTitle ? 'Сертификат: ' + p.courseTitle : 'Получен сертификат');
  case 'system': return p.title?.trim() || p.message?.trim()?.slice(0,110) || 'Системное событие';
  case 'personal_calendar': return 'Напоминание: ' + (p.eventTitle || 'Событие календаря');
  case 'lesson_new': return 'Новый урок: ' + (p.lessonTitle || 'Открыть курс');
  case 'lesson_unlocked': return 'Открыт урок: ' + (p.lessonTitle || 'Открыть курс');
  case 'practical_scheduled': return 'Практика: ' + (p.topic || 'Назначено занятие');
  case 'practical_due': return 'Скоро практика: ' + (p.topic || 'Срок выполнения');
  case 'homework_due': return 'Скоро дедлайн ДЗ: ' + (p.title || 'Домашняя работа');
  case 'homework_overdue': return 'Просрочено ДЗ: ' + (p.title || 'Домашняя работа');
  case 'report': return 'Жалоба на ' + (p.targetLabel || 'контент');
  case 'password_reset': return 'Запрос на сброс пароля от ' + (p.userName || 'пользователя');
  default: return p.title?.trim() || p.message?.trim()?.slice(0,110) || 'Событие платформы';
 }
}
export function notificationPreview(n) {
 const p = n?.payload || {};
 if (n?.type === 'mention') return mentionPreview(p);
 if (n?.type === 'editorial') return [p.projectTitle ? 'Проект: ' + p.projectTitle : null, p.message].filter(Boolean).join(' · ');
 if (n?.type === 'certificate') return p.courseTitle || p.message || '';
 if (n?.type === 'message') return p.preview || p.message || '';
 if (n?.type === 'post') return p.preview || '';
 return p.preview || p.message || p.courseTitle || '';
}
