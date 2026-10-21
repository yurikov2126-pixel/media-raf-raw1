/** Predict the exact broadcast duration of a draft using the same transition
 * direction used by publication: incoming fade belongs to the next music item.
 * Jingles always cut. Does not shorten, seek, or mutate source audio.
 */
export function autoPlaylistDraftDuration(items){
 let sum=0;
 for(let i=0;i<items.length;i++){
  const item=items[i],prior=items[i-1];
  if(!Number.isSafeInteger(item.durationMs)||item.durationMs<=0)throw new RangeError('Invalid duration');
  const fade=i&&prior.kind==='MUSIC'&&item.kind==='MUSIC'?
   Math.min(item.fadeMs||0,Math.floor(Math.min(prior.durationMs,item.durationMs)/2)):0;
  sum+=item.durationMs-(fade>=250?fade:0);
 }
 return sum;
}
export function fitAutoPlaylistWindow(items,tracks,{targetMs,fadeMs=2000,minTrackGap=0,minArtistGap=0}={}){
 if(!Number.isSafeInteger(targetMs)||targetMs<60000||targetMs>12*3600000)
  throw new RangeError('Invalid broadcast window');
 const base=items.map(x=>({...x}));
 const finalJingle=base.at(-1)?.kind==='JINGLE'?base.pop():null;
 const eligible=tracks.filter(a=>a&&typeof a.id==='string'&&Number.isSafeInteger(a.durationMs)&&a.durationMs>=15000);
 const artist=x=>typeof x?.artist==='string'?x.artist.trim().toLocaleLowerCase('ru-RU'):'';
 const byId=new Map(eligible.map(a=>[a.id,a]));
 const measure=autoPlaylistDraftDuration;
 // The initial generator is greedy. A bounded tail-search fills remaining time
 // using complete songs and respects the selected separation when possible.
 let result=base,remaining=targetMs-measure(finalJingle?[...base,finalJingle]:base),added=0;
 if(remaining<0)return {items:finalJingle?[...result,finalJingle]:result,durationMs:targetMs-remaining,remainingMs:remaining,warnings:['OVER_TARGET']};
 for(let step=0;step<20&&remaining>=15000;step++){
  const history=result.filter(x=>x.kind==='MUSIC');
  const blockedIds=new Set((minTrackGap?history.slice(-minTrackGap):[]).map(x=>x.assetId));
  const blockedArtists=new Set((minArtistGap?history.slice(-minArtistGap):[]).map(x=>artist(byId.get(x.assetId))).filter(Boolean));
  let candidates=eligible.filter(x=>!blockedIds.has(x.id)&&(!artist(x)||!blockedArtists.has(artist(x))));
  if(!candidates.length)break;
  const prior=result.at(-1);
  const fit=candidates.map(x=>{
   const fade=prior?.kind==='MUSIC'?Math.min(fadeMs,Math.floor(Math.min(prior.durationMs,x.durationMs)/2)):0;
   const net=x.durationMs-(fade>=250?fade:0);
   return {asset:x,net,fade:fade>=250?fade:0};
  }).filter(x=>x.net<=remaining).sort((a,b)=>b.net-a.net||a.asset.id.localeCompare(b.asset.id))[0];
  if(!fit)break;
  result=[...result,{assetId:fit.asset.id,kind:'MUSIC',durationMs:fit.asset.durationMs,fadeMs:fit.fade}];
  remaining-=fit.net;added++;
 }
 const warnings=[];
 if(remaining>0)warnings.push('WINDOW_UNFILLED');
 const complete=finalJingle?[...result,finalJingle]:result;
 return {items:complete,durationMs:measure(complete),remainingMs:targetMs-measure(complete),added,warnings};
}
