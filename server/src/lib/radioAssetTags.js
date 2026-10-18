/** Normalize ffprobe audio metadata (including ID3 v2 tags in MP3).
 * No user-controlled tag is interpreted as a filesystem path or command.
 */
const clean=(v,max=160)=>typeof v==='string'?v.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max):'';
export function normalizeRadioTags(probe={}){
 const t={...(probe.format?.tags||{}),...(probe.streams?.find(s=>s.codec_type==='audio')?.tags||{})};
 const normalized=Object.fromEntries(Object.entries(t).map(([k,v])=>[k.toLowerCase(),v]));
 const get=(...keys)=>clean(keys.map(k=>normalized[k.toLowerCase()]).find(Boolean));
 return {title:get('title'),artist:get('artist','album_artist'),album:get('album'),
  genre:get('genre'),year:get('date','year').slice(0,10),track:get('track').slice(0,12),
  composer:get('composer'),comment:get('comment', 'description', 'TXXX:COMMENT')};
}
export function safeRadioTags(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const fields=['title','artist','album','genre','year','track','composer','comment'];
 return Object.fromEntries(fields.map(key=>[key,clean(value[key],key==='comment'?300:160)]));
}
