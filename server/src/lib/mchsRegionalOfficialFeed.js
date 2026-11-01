import https from 'node:https';
import {classifyMchsObservation} from './mchsClassification.js';

// Pinned publicly readable regional government channel; not a cryptographic dispatch API.
const SOURCE='https://t.me/s/tularegion71';
const MAX_BYTES=600000;
const decode=s=>s.replace(/&nbsp;|&#160;/g,' ').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'")
 .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&')
 .replace(/<br\\s*\\/?\\s*>/gi,' ').replace(/<[^>]*>/g,' ').replace(/\\s+/g,' ').trim();
export function parseRegionalOfficialFeed(html,{nowMs=Date.now()}={}){
 if(typeof html!=='string')return [];
 const blocks=html.split(/<div class="tgme_widget_message_wrap/).slice(1,100);
 return blocks.map(block=>{
  const postId=block.match(/data-post="tularegion71\\/(\\d+)"/)?.[1];
  const publishedAt=block.match(/<time[^>]+datetime="([^"]+)"/)?.[1];
  const textHtml=block.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\\s\\S]*?)<\\/div>/)?.[1]||'';
  const message=decode(textHtml);
  const type=classifyMchsObservation(message,'');
  const time=Date.parse(publishedAt||'');
  if(!postId||!Number.isFinite(time)||!['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(type))return null;
  return {source:'REGIONAL_GOVERNMENT_PUBLIC_POST',postId,sourceUrl:SOURCE.replace('/s/','/')+'/'+postId,
   publishedAt:new Date(time).toISOString(),eventType:type,message:message.slice(0,600),
   fresh:time<=nowMs+30000&&nowMs-time<=120000,
   independentlyAuthenticated:false,executionEnabled:false};
 }).filter(Boolean).slice(-30);
}
export function fetchRegionalOfficialFeed({timeoutMs=5000}={}){
 return new Promise((resolve,reject)=>{
  const req=https.get(SOURCE,{timeout:timeoutMs,headers:{'User-Agent':'MEDIA-RAF-RAW-ReadOnly/1.0','Accept':'text/html'}},res=>{
   if(res.statusCode!==200){res.resume();reject(new Error('OFFICIAL_FEED_HTTP_'+res.statusCode));return;}
   let bytes=0,parts=[];
   res.on('data',chunk=>{bytes+=chunk.length;if(bytes>MAX_BYTES){res.destroy(new Error('OFFICIAL_FEED_TOO_LARGE'));return;}parts.push(chunk);});
   res.on('end',()=>resolve(parseRegionalOfficialFeed(Buffer.concat(parts).toString('utf8'))));
   res.on('error',reject);
  });
  req.on('timeout',()=>req.destroy(new Error('OFFICIAL_FEED_TIMEOUT')));
  req.on('error',reject);
 });
}
export const REGIONAL_OFFICIAL_FEED_URL=SOURCE;
