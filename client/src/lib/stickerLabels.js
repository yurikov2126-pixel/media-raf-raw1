export const REWARD_NAMES = {
 FIRST_POST:'Первая публикация', POSTS_10:'10 публикаций',
 FIRST_COMMENT:'Первый комментарий', COMMENTS_25:'25 комментариев',
 FIRST_LESSON:'Первый пройденный урок', LESSONS_10:'10 пройденных уроков',
 FIRST_SEASON_APPROVAL:'Первая принятая сезонная работа',
 SEASON_APPROVALS_3:'Три принятые сезонные работы'
};
export const rewardName = event => REWARD_NAMES[event] || 'Награда за активность';
export const rarityNames = {COMMON:'Обычный',RARE:'Редкий',EPIC:'Эпический',LEGENDARY:'Легендарный'};
export const tradeNames = {PENDING:'Ожидает ответа',ACCEPTED:'Обмен завершён',DECLINED:'Отклонено',CANCELLED:'Отменено'};
