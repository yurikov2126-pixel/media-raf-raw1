export const PACK_THEMES = {
 'media-days':{label:'Неоновая редакция',icon:'🎬',className:'sticker-theme-media',description:'Неоновые градиенты, плёнка и энергия редакции'},
 'cat-emotions':{label:'Мультяшные эмоции',icon:'😺',className:'sticker-theme-cat',description:'Мягкие формы, игривые персонажи и выразительные реакции'},
 'photo-tech':{label:'Техно-студия',icon:'📷',className:'sticker-theme-photo',description:'Технические чертежи, стекло и оптика'},
 'team':{label:'Комикс о команде',icon:'🤝',className:'sticker-theme-team',description:'Яркие панели, динамика и совместные победы'},
 'tula':{label:'Тульские открытки',icon:'🏙️',className:'sticker-theme-tula',description:'Тёплая иллюстрация, бумажные фактуры и городские истории'}
};
export const themeForPack = slug => PACK_THEMES[slug] || {label:'Коллекция',icon:'🎴',className:'sticker-theme-default',description:'Коллекционные стикеры'};
export const rarityLabel = rarity => ({COMMON:'Обычный',RARE:'Редкий',EPIC:'Эпический',LEGENDARY:'Легендарный'}[rarity]||'Стикер');
