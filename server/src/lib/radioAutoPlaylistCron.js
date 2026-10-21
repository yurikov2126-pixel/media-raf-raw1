import cron from 'node-cron';
import {materializeRadioAutoPlaylistRules} from './radioAutoPlaylistRecurrence.js';
let running=false;
export function scheduleRadioAutoPlaylists(){
 // Fail closed: no background planning until the feature is explicitly enabled.
 if(process.env.RADIO_AUTO_PLAYLIST_RECURRENCE_ENABLED!=='true')return;
 cron.schedule('15 * * * *',async()=>{
  if(running)return;
  running=true;
  try{
   const summary=await materializeRadioAutoPlaylistRules();
   console.info('RADIO_AUTO_PLAYLIST_RECURRENCE',JSON.stringify(summary));
  }catch(error){console.error('RADIO_AUTO_PLAYLIST_RECURRENCE_FAILED',error);}
  finally{running=false;}
 });
}
