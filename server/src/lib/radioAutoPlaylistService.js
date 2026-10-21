import {prisma} from './prisma.js';
import {generateRadioAutoPlaylist} from './radioAutoPlaylistGenerator.js';
import {fitAutoPlaylistWindow} from './radioAutoPlaylistWindowFit.js';

export function validateAutoPlaylistInput(input){
 if(!input||typeof input.name!=='string'||!input.name.trim()||input.name.length>140)
  throw new RangeError('Название должно содержать от 1 до 140 символов');
 if(typeof input.sourceFolderId!=='string'||!input.sourceFolderId.trim())
  throw new RangeError('Выберите папку музыки');
 const int=(key,min,max,defaultValue)=>{
  const v=input[key]===undefined?defaultValue:input[key];
  if(!Number.isInteger(v)||v<min||v>max)throw new RangeError('Некорректное значение '+key);
  return v;
 };
 const trackOrder=input.trackOrder??'SMART';
 if(!['SMART','SHUFFLE','ORDERED'].includes(trackOrder))throw new RangeError('Некорректная ротация');
 if(input.includeChildren!==undefined&&typeof input.includeChildren!=='boolean')
  throw new RangeError('Некорректный выбор подпапок');
 const jingleAssetIds=input.jingleAssetIds??[];
 if(!Array.isArray(jingleAssetIds)||jingleAssetIds.length>100||
    !jingleAssetIds.every(x=>typeof x==='string'&&x.length>0)||
    new Set(jingleAssetIds).size!==jingleAssetIds.length)
  throw new RangeError('Некорректный набор джинглов');
 return {name:input.name.trim(),sourceFolderId:input.sourceFolderId,
  includeChildren:input.includeChildren??true,
  targetMinutes:int('targetMinutes',1,720,60),trackOrder,
  minTrackGap:int('minTrackGap',0,1000,20),
  minArtistGap:int('minArtistGap',0,1000,3),
  jingleEvery:int('jingleEvery',0,50,3),
  fadeMs:int('fadeMs',0,8000,2000),jingleAssetIds};
}

export async function collectAutoPlaylistAssets(config,db=prisma){
 const root=await db.radioAssetFolder.findUnique({where:{id:config.sourceFolderId},select:{id:true}});
 if(!root)throw new RangeError('Музыкальная папка не найдена');
 const ids=new Set([root.id]);
 if(config.includeChildren){
  let frontier=[root.id];
  for(let depth=0;frontier.length&&depth<100;depth++){
   const found=await db.radioAssetFolder.findMany({where:{parentId:{in:frontier}},select:{id:true}});
   frontier=found.map(x=>x.id).filter(id=>!ids.has(id));
   for(const id of frontier)ids.add(id);
  }
  if(frontier.length)throw new RangeError('Слишком глубокая структура папок');
 }
 const assets=await db.radioAsset.findMany({where:{folderId:{in:[...ids]}},
  select:{id:true,name:true,durationMs:true,tags:true},orderBy:{createdAt:'asc'}});
 const jingles=config.jingleAssetIds.length?await db.radioAsset.findMany({
  where:{id:{in:config.jingleAssetIds}},
  select:{id:true,name:true,durationMs:true,tags:true}}):[];
 if(jingles.length!==config.jingleAssetIds.length)throw new RangeError('Один из джинглов не найден');
 const jingleSet=new Set(config.jingleAssetIds);
 return {tracks:assets.filter(x=>!jingleSet.has(x.id)).map(x=>({...x,artist:x.tags?.artist})),
  jingles:jingles.map(x=>({...x,artist:x.tags?.artist}))};
}
export async function previewAutoPlaylist(config,{db=prisma,seed='preview'}={}){
 const {tracks,jingles}=await collectAutoPlaylistAssets(config,db);
 const targetMs=config.targetMinutes*60000;
 const generated=generateRadioAutoPlaylist({tracks,jingles,durationMs:targetMs,
  fadeMs:config.fadeMs,jingleEvery:config.jingleEvery,
  minTrackGap:config.minTrackGap,minArtistGap:config.minArtistGap,
  order:config.trackOrder,seed});
 if(!generated.items.length)return {...generated,targetMs,remainingMs:targetMs};
 const fitted=fitAutoPlaylistWindow(generated.items,tracks,{targetMs,fadeMs:config.fadeMs,
  minTrackGap:config.minTrackGap,minArtistGap:config.minArtistGap});
 return {items:fitted.items,durationMs:fitted.durationMs,targetMs,
  remainingMs:fitted.remainingMs,addedTailTracks:fitted.added,
  warnings:[...new Set([...generated.warnings.filter(w=>w!=='UNFILLED_DURATION'),...fitted.warnings])]};
}
