import test from 'node:test';
import assert from 'node:assert/strict';
import {readAutoDjSettings,writeAutoDjSettings} from '../src/lib/radioAutoDj.js';

test('new handover mode defaults to off for existing installations',async()=>{
 const db={setting:{findUnique:async()=>({value:JSON.stringify({enabled:true,playlistId:'pl'})})}};
 assert.deepEqual(await readAutoDjSettings(db),{enabled:true,playlistId:'pl',finishTrackBeforeSchedule:false});
});
test('finish-track setting persists and round trips',async()=>{
 let value;
 const db={setting:{
  findUnique:async()=>({value}),
  upsert:async({create})=>{value=create.value;return {value};}
 }};
 await writeAutoDjSettings({enabled:true,playlistId:'pl',finishTrackBeforeSchedule:true},db);
 assert.equal((await readAutoDjSettings(db)).finishTrackBeforeSchedule,true);
 await writeAutoDjSettings({enabled:true,playlistId:'pl',finishTrackBeforeSchedule:false},db);
 assert.equal((await readAutoDjSettings(db)).finishTrackBeforeSchedule,false);
});
