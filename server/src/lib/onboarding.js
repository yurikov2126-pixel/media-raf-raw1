import { getModulesState } from './modules.js';

/* Текущая версия онбординга.
   УВЕЛИЧИВАЙТЕ при добавлении новых шагов — тогда пользователи,
   которые уже прошли обучение, увидят только новые шаги. */
export const ONBOARDING_VERSION = 2;

/* Шаги онбординга.
   moduleKey    — если указан, шаг показывается только когда модуль включён.
   introducedIn — с какой версии шаг существует.
   kind         — специальный тип шага (пока только 'notifications'). */
export const ONBOARDING_STEPS = [
    {
        id: 'welcome',
        introducedIn: 1,
        moduleKey: null,
        icon: '👋',
        title: 'Добро пожаловать!',
        text: 'Это MEDIA·RAF·RAW — платформа студенческого медиацентра. За 30 секунд покажем, что здесь есть.',
    },
    {
        id: 'feed',
        introducedIn: 1,
        moduleKey: 'feed',
        icon: '🏠',
        title: 'Лента',
        text: 'Здесь публикуются работы команды. Ставьте реакции, комментируйте, делитесь своими проектами.',
    },
    {
        id: 'chats',
        introducedIn: 1,
        moduleKey: 'chats',
        icon: '💬',
        title: 'Чаты',
        text: 'Личные и групповые переписки. Отправляйте фото, видео, файлы и голосовые сообщения.',
    },
    {
        id: 'courses',
        introducedIn: 1,
        moduleKey: 'courses',
        icon: '🎓',
        title: 'Обучение',
        text: 'Курсы с уроками и тестами. Пройдите курс полностью — получите именной сертификат.',
    },
    {
        id: 'wiki',
        introducedIn: 1,
        moduleKey: 'wiki',
        icon: '📖',
        title: 'База знаний',
        text: 'Гайды, словари, технические статьи от команды. Всё, что нужно для работы — в одном месте.',
    },
    {
        id: 'gamification',
        introducedIn: 2,
        moduleKey: null,
        icon: '🏆',
        title: 'Зарабатывайте опыт и достижения',
        text: 'Публикуйте посты, комментируйте, проходите уроки — за каждое действие получаете опыт и растёте в уровнях. Открывайте достижения и соревнуйтесь в рейтинге с командой!',
    },
    {
        id: 'notifications',
        introducedIn: 1,
        moduleKey: null,
        kind: 'notifications',
        icon: '🔔',
        title: 'Включите уведомления',
        text: 'Чтобы не пропускать сообщения, ответы на комментарии и важные новости, включите push-уведомления. Это займёт секунду.',
    },
    {
        id: 'done',
        introducedIn: 1,
        moduleKey: null,
        icon: '🎉',
        title: 'Всё готово!',
        text: 'Теперь вы знаете, как устроена платформа. Удачи и вдохновения!',
    },
];

/* Возвращает шаги, которые пользователю нужно показать:
   те, что появились ПОСЛЕ его текущей версии, и модуль которых включён. */
export async function getStepsForUser(userOnboardingVersion) {
    const modulesState = await getModulesState();

    return ONBOARDING_STEPS.filter((s) => {
        if (s.moduleKey && !modulesState[s.moduleKey]) return false;
        if (s.introducedIn <= userOnboardingVersion) return false;
        return true;
    });
}