import cron from 'node-cron';
import {prisma} from './prisma.js';
import {materializeRadioAutoPlaylistRules} from './radioAutoPlaylistRecurrence.js';
let running=false;
export async function runRadioAutoPlaylistPreparation(){
 if(running)return {status:'BUSY'};
 running=true;
 try{
  const status=await prisma.radioAutoPlaylistAutomation.findUnique({where:{id:1}});
  if(!status?.enabled)return {status:'DISABLED'};
  const summary=await materializeRadioAutoPlaylistRules();
  console.info('RADIO_AUTO_PLAYLIST_RECURRENCE',JSON.stringify(summary));
  return {status:'COMPLETED',summary};
 }catch(error){console.error('RADIO_AUTO_PLAYLIST_RECURRENCE_FAILED',error);throw error;}
 finally{running=false;}
}
export function scheduleRadioAutoPlaylists(){
 // Registered on the production API only. Actual enablement is persisted in DB
 // and can be changed from the admin screen without restarting on-air playout.
 cron.schedule('15 * * * *',()=>runRadioAutoPlaylistPreparation().catch(()=>{}),{timezone:'Europe/Moscow'});
}
