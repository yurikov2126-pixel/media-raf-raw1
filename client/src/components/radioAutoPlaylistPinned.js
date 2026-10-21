/** Merge regenerated candidate sequence with explicit pinned draft positions.
 * Positional pins win. Candidate entries used by a pin are removed once from
 * the generated pool, so regeneration does not duplicate the same occurrence.
 * Caller validates and saves the result through the draft API.
 */
export function mergePinnedAutoPlaylist(previous,generated){
 if(!Array.isArray(previous)||!Array.isArray(generated))throw new TypeError('Expected playlist arrays');
 const pins=previous.map((item,index)=>({item,index})).filter(({item})=>item?.pinned);
 if(!pins.length)return generated.map(item=>({...item,pinned:false}));
 const keys=new Map();
 for(const {item} of pins){const key=item.kind+':'+item.assetId;keys.set(key,(keys.get(key)||0)+1);}
 const pool=[];
 for(const item of generated){
  const key=item.kind+':'+item.assetId;
  if(keys.get(key)>0){keys.set(key,keys.get(key)-1);continue;}
  pool.push({...item,pinned:false});
 }
 const length=Math.max(previous.length,generated.length,pins.at(-1).index+1);
 const result=Array(length).fill(null);
 for(const {item,index} of pins)result[index]={...item,pinned:true};
 let cursor=0;
 for(let index=0;index<result.length;index++)if(!result[index]&&cursor<pool.length)result[index]=pool[cursor++];
 return result.filter(Boolean).concat(pool.slice(cursor));
}
