import cron from 'node-cron';
import {materializeRadioAutoPlaylistRules} from './radioAutoPlaylistRecurrence.js';
let running=false;
export function scheduleRadioAutoPlaylists(){
 // Fail closed: no background planning until the feature is explicitly enabled.

 cron.schedule('15 * * * *',async()=>{
  if(running)return;
  running=true;
  try{
   const {prisma}=await import('./prisma.js');
   const settings=await prisma.radioAutoPlaylistAutomationSettings.findUnique({where:{id:1}});
   if(!settings?.enabled)return;
   const summary=await materializeRadioAutoPlaylistRules();
   console.info('RADIO_AUTO_PLAYLIST_RECURRENCE',JSON.stringify(summary));
  }catch(error){console.error('RADIO_AUTO_PLAYLIST_RECURRENCE_FAILED',error);}
  finally{running=false;}
 });
}
