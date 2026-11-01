import https from 'node:https';
import {classifyMchsObservation} from './mchsClassification.js';

// MAX channel reading is permitted only when the bot is an administrator.
// This is a public-post corroboration source, NEVER broadcast authorization.
export const REGIONAL_OFFICIAL_FEED_URL='https://max.ru/tularegion71';
const API_HOST='platform-api2.max.ru';
export function parseRegionalOfficialFeed(payload,{nowMs=Date.now()}={}){
 const messages=Array.isArray(payload?.messages)?payload.messages:[];
 return messages.slice(0,100).map(item=>{
  const id=item?.body?.mid;
  const message=item?.body?.text;
  const published=item?.timestamp;
  const postUrl=item?.url;
  const eventType=classifyMchsObservation(message,'');
  if(typeof id!=='string'||!id||typeof message!=='string'||!Number.isFinite(published)||
     !['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(eventType))return null;
  const validUrl=typeof postUrl==='string'&&/^https:\/\/max\.ru\/tularegion71\/[a-zA-Z0-9_-]+$/.test(postUrl);
  return {source:'REGIONAL_GOVERNMENT_MAX_POST',postId:id,
   sourceUrl:validUrl?postUrl:null,publishedAt:new Date(published).toISOString(),
   eventType,message:message.slice(0,600),
   fresh:published<=nowMs+30000&&nowMs-published<=120000,
   independentlyAuthenticated:false,executionEnabled:false};
 }).filter(Boolean).slice(0,30);
}
export function fetchRegionalOfficialFeed({timeoutMs=5000}={}){
 const token=process.env.MCHS_MAX_BOT_TOKEN;
 const chatId=process.env.MCHS_MAX_CHANNEL_CHAT_ID;
 if(!token||!/^-?\d{1,20}$/.test(chatId||''))return Promise.reject(new Error('MAX_CHANNEL_ACCESS_NOT_CONFIGURED'));
 return new Promise((resolve,reject)=>{
  const request=https.get({hostname:API_HOST,path:'/messages?chat_id='+encodeURIComponent(chatId)+'&count=100',
   timeout:timeoutMs,headers:{Authorization:token,Accept:'application/json'}},response=>{
    if(response.statusCode!==200){response.resume();reject(new Error('MAX_API_HTTP_'+response.statusCode));return;}
    let size=0,parts=[];
    response.on('data',part=>{
     size+=part.length;if(size>500000){response.destroy(new Error('MAX_RESPONSE_TOO_LARGE'));return;}parts.push(part);
    });
    response.on('error',reject);
    response.on('end',()=>{
     try{
      const data=JSON.parse(Buffer.concat(parts).toString('utf8'));
      if(!Array.isArray(data.messages))throw new Error('MAX_INVALID_MESSAGES');
      resolve(parseRegionalOfficialFeed(data));
     }catch(error){reject(error);}
    });
   });
  request.on('timeout',()=>request.destroy(new Error('MAX_API_TIMEOUT')));
  request.on('error',reject);
 });
}
