/** Return the next scheduled asset only when the current cursor has
 * a discrete (non-mixed) boundary. No source is connected to the encoder here.
 */
export function scheduledSuccessor(items,cursor){
 if(cursor?.status!=='SCHEDULED'||!cursor.track||cursor.track.blend)return null;
 const index=cursor.track.index;
 if(!Number.isInteger(index)||index<0||index>=items.length-1)return null;
 const next=items[index+1];
 return typeof next?.assetId==='string'&&next.assetId?next.assetId:null;
}
