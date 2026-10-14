import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
const router = Router();router.use(auth);

export const BUILTIN_WIDGETS = [
 ['learning','Продолжить обучение','Текущий курс и следующий шаг','courses'],
 ['tasks','Ближайшие задания','Назначенные задачи и сроки','editorial'],
 ['wiki','ВикиМедиа','Случайная статья из базы знаний','wiki'],
 ['progress','Мой прогресс','Уровень и XP',null],
 ['quickActions','Быстрые действия','Переходы в разделы сайта',null],
 ['profile','Мой профиль','Портфолио и достижения',null],
 ['feed','Лента команды','Свежие публикации','feed'],
 ['certificates','Сертификаты','Выданные сертификаты Академии','courses'],
 ['academy','Моя Академия','Статистика обучения и задания','courses'],
 ['production','Производство','Переход к канбану редакции','editorial'],
 ['calendar','Редакционный календарь','План съёмок и событий','editorial'],
].map(([key,title,description,module])=>({key,title,description,module,kind:'builtin',enabled:true}));
export const DEFAULT_WIDGETS=['learning','tasks','wiki','progress','quickActions'];
const prefKey = id => 'dashboard2_user_'+id;
const catalogKey='dashboard2_widget_catalog';
async function catalog(){
 const setting=await prisma.setting.findUnique({where:{key:catalogKey}});
 let custom=[],overrides={};
 try{ const parsed=JSON.parse(setting?.value||'{}');custom=Array.isArray(parsed.custom)?parsed.custom:[];overrides=parsed.overrides||{}; }catch{}
 return [...BUILTIN_WIDGETS.map(w=>({...w,...(overrides[w.key]||{}),kind:'builtin'})),
     ...custom.filter(w=>w&&typeof w.key==='string'&&w.key.startsWith('custom_'))];
}
const validList=(value,keys)=>Array.isArray(value)&&value.length<=60&&value.every(k=>typeof k==='string'&&keys.includes(k))
 ? [...new Set(value)] : null;
const admin=req=>req.user?.role==='ADMIN';
const cleanString=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';

router.get('/catalog',async(req,res,next)=>{try{
 const widgets=await catalog();res.json({widgets:widgets.filter(w=>w.enabled!==false)});
}catch(e){next(e);}});
router.get('/admin/catalog',async(req,res,next)=>{try{
 if(!admin(req))return res.status(403).json({error:'Нет прав'});res.json({widgets:await catalog()});
}catch(e){next(e);}});
router.put('/admin/catalog',async(req,res,next)=>{try{
 if(!admin(req))return res.status(403).json({error:'Нет прав'});
 const incoming=req.body?.widgets;
 if(!Array.isArray(incoming)||incoming.length>60)return res.status(400).json({error:'Некорректный каталог'});
 const builtins=new Set(BUILTIN_WIDGETS.map(w=>w.key)),seen=new Set(),custom=[],overrides={};
 for(const w of incoming){
  if(!w||typeof w.key!=='string'||seen.has(w.key))return res.status(400).json({error:'Повторяющийся виджет'});
  seen.add(w.key);
  const title=cleanString(w.title,90),description=cleanString(w.description,240),enabled=w.enabled===true;
  if(!title)return res.status(400).json({error:'Укажите название виджета'});
  if(builtins.has(w.key)){overrides[w.key]={title,description,enabled};continue;}
  if(!/^custom_[a-z0-9_-]{6,60}$/.test(w.key)||!['text','link'].includes(w.kind))
   return res.status(400).json({error:'Неизвестный тип виджета'});
  const content=cleanString(w.content,1500);
  const url=cleanString(w.url,400);
  if(w.kind==='link'&&!(/^\/app(?:\/|$)/.test(url)))return res.status(400).json({error:'Ссылка должна вести на страницу платформы'});
  custom.push({key:w.key,title,description,enabled,kind:w.kind,content,url,module:null});
 }
 if(BUILTIN_WIDGETS.some(w=>!seen.has(w.key)))return res.status(400).json({error:'Отсутствует системный виджет'});
 await prisma.setting.upsert({where:{key:catalogKey},create:{key:catalogKey,value:JSON.stringify({custom,overrides})},update:{value:JSON.stringify({custom,overrides})}});
 res.json({widgets:await catalog()});
}catch(e){next(e);}});
router.get('/',async(req,res,next)=>{try{
 const items=(await catalog()).filter(w=>w.enabled!==false);
 const saved=await prisma.setting.findUnique({where:{key:prefKey(req.user.id)}});
 let widgets=DEFAULT_WIDGETS;
 try{if(saved)widgets=JSON.parse(saved.value);}catch{}
 if(!Array.isArray(widgets))widgets=DEFAULT_WIDGETS;
 widgets=widgets.filter(k=>items.some(w=>w.key===k));
 res.json({widgets,available:items.map(w=>w.key),catalog:items});
}catch(e){next(e);}});
router.put('/',async(req,res,next)=>{try{
 const items=(await catalog()).filter(w=>w.enabled!==false);
 const widgets=validList(req.body?.widgets,items.map(w=>w.key));
 if(!widgets)return res.status(400).json({error:'Недопустимый набор виджетов'});
 await prisma.setting.upsert({where:{key:prefKey(req.user.id)},create:{key:prefKey(req.user.id),value:JSON.stringify(widgets)},update:{value:JSON.stringify(widgets)}});
 res.json({widgets});
}catch(e){next(e);}});
export default router;
