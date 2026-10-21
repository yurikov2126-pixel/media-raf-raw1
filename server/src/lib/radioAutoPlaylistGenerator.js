/** Pure deterministic draft generation; never changes approved or on-air playlists. */
export function generateRadioAutoPlaylist({tracks,jingles=[],durationMs,fadeMs=2000,
  jingleEvery=3,minTrackGap=20,minArtistGap=3,seed='default',order='SMART'}={}){
 if(!Number.isInteger(durationMs)||durationMs<60_000||durationMs>24*3600_000)
  throw new RangeError('durationMs must be between one minute and 24 hours');
 if(!Number.isInteger(fadeMs)||fadeMs<0||fadeMs>8000)throw new RangeError('invalid fadeMs');
 if(!Number.isInteger(jingleEvery)||jingleEvery<0||jingleEvery>50)throw new RangeError('invalid jingleEvery');
 if(!Number.isInteger(minTrackGap)||minTrackGap<0||minTrackGap>1000)throw new RangeError('invalid minTrackGap');
 if(!Number.isInteger(minArtistGap)||minArtistGap<0||minArtistGap>1000)throw new RangeError('invalid minArtistGap');
 if(!['SMART','SHUFFLE','ORDERED'].includes(order))throw new RangeError('invalid order');
 const valid=(a)=>a&&typeof a.id==='string'&&Number.isFinite(a.durationMs)&&a.durationMs>0;
 const songs=(tracks||[]).filter(valid).filter(a=>a.durationMs>=15_000);
 const ids=new Set();const unique=songs.filter(a=>!ids.has(a.id)&&ids.add(a.id));
 const jinglesValid=(jingles||[]).filter(valid).filter(a=>!ids.has(a.id));
 if(!unique.length)return {items:[],durationMs:0,warnings:['NO_VALID_TRACKS']};
 if(!jinglesValid.length)return {items:[],durationMs:0,warnings:['REQUIRED_BOUNDARY_JINGLES_MISSING']};
 const opening=jinglesValid[0];
 const closing=jinglesValid.length>1?jinglesValid[1]:jinglesValid[0];
 const musicBudget=durationMs-opening.durationMs-closing.durationMs;
 if(musicBudget<15000)return {items:[],durationMs:0,warnings:['NO_ROOM_FOR_BOUNDARY_JINGLES']};
 // Stable seeded shuffle, reproducible during preview and snapshot creation.
 let state=2166136261;
 for(const char of String(seed))state=Math.imul(state^char.charCodeAt(0),16777619)>>>0;
 const next=()=>((state=Math.imul(state,1664525)+1013904223>>>0)/4294967296);
 const pool=[...unique];
 if(order!=='ORDERED')for(let i=pool.length-1;i>0;i--){const j=Math.floor(next()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
 const items=[{assetId:opening.id,kind:'JINGLE',durationMs:opening.durationMs,fadeMs:0}],warnings=[];let elapsed=opening.durationMs,songCount=0,jingleIndex=0;
 const history=[];const recentArtists=[];
 const normalizeArtist=value=>typeof value==='string'?value.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('ru-RU'):'';
 const artistOf=x=>normalizeArtist(x.artist??x.tags?.artist);
 const gap=Math.min(minTrackGap,Math.max(0,pool.length-1));
 let steps=0;
 while(steps++<10000){
  let options=pool.filter(x=>!history.slice(-gap).includes(x.id));
  if(!options.length)options=pool;
  if(minArtistGap>0){
   const forbidden=new Set(recentArtists.slice(-minArtistGap));
   const artistSafe=options.filter(x=>!artistOf(x)||!forbidden.has(artistOf(x)));
   if(artistSafe.length)options=artistSafe;
   else if(!warnings.includes('ARTIST_GAP_RELAXED'))warnings.push('ARTIST_GAP_RELAXED');
  }
  const index=order==='ORDERED'?songCount%options.length:
    order==='SMART'?options.reduce((best,x,i)=>((history.lastIndexOf(x.id)<history.lastIndexOf(options[best].id))?i:best),0):
      Math.floor(next()*options.length);
  const song=options[index];
  const transition=items.at(-1)?.kind==='MUSIC'?Math.min(fadeMs,song.durationMs/2,items.at(-1).durationMs/2):0;
  const net=song.durationMs-transition;
  if(elapsed+net+closing.durationMs>durationMs){
   const fit=options.filter(x=>{const fade=items.at(-1)?.kind==='MUSIC'?Math.min(fadeMs,x.durationMs/2,items.at(-1).durationMs/2):0;return elapsed+x.durationMs-fade+closing.durationMs<=durationMs;}).sort((a,b)=>b.durationMs-a.durationMs)[0];
   if(!fit)break;
   const altFade=items.at(-1)?.kind==='MUSIC'?Math.min(fadeMs,fit.durationMs/2,items.at(-1).durationMs/2):0;
   items.push({assetId:fit.id,kind:'MUSIC',durationMs:fit.durationMs,fadeMs:altFade});
   elapsed+=fit.durationMs-altFade;songCount++;history.push(fit.id);if(artistOf(fit))recentArtists.push(artistOf(fit));
   continue;
  } // reserve mandatory closing jingle
  items.push({assetId:song.id,kind:'MUSIC',durationMs:song.durationMs,fadeMs:transition});
  elapsed+=net;songCount++;history.push(song.id);if(artistOf(song))recentArtists.push(artistOf(song));
  if(jingleEvery&&songCount%jingleEvery===0&&jinglesValid.length){
   const jingle=jinglesValid[jingleIndex++%jinglesValid.length];
   // Jingles default to a clean sequential insertion, avoiding ducking until designed.
   if(elapsed+jingle.durationMs+closing.durationMs<=durationMs){
    items.push({assetId:jingle.id,kind:'JINGLE',durationMs:jingle.durationMs,fadeMs:0});
    elapsed+=jingle.durationMs;
   }
  }
 }
 if(!songCount)return {items:[],durationMs:0,warnings:['NO_MUSIC_FIT']};
 items.push({assetId:closing.id,kind:'JINGLE',durationMs:closing.durationMs,fadeMs:0});
 elapsed+=closing.durationMs;

 if(elapsed<durationMs)warnings.push('UNFILLED_DURATION');
 return {items,durationMs:Math.round(elapsed),warnings};
}
