import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMissileProvenance} from '../src/lib/mchsMissileProvenance.js';
const now=Date.parse('2026-11-01T12:00:00Z');
const base={eventId:'event-1',channelId:'official-channel',region:'Тульская область',occurredAt:new Date(now-10000).toISOString(),title:'Ракетная опасность',body:''};
const options={nowMs:now,allowedChannels:['official-channel']};
test('only missile danger and all-clear from configured source are acceptable',()=>{
 assert.equal(assessMissileProvenance(base,options).acceptable,true);
 assert.equal(assessMissileProvenance({...base,title:'Отбой ракетной опасности'},options).acceptable,true);
 assert.equal(assessMissileProvenance({...base,title:'Опасность атаки БПЛА'},options).reason,'TYPE_NOT_AUTOMATED');
});
test('provenance is never official verification',()=>{
 const result=assessMissileProvenance(base,options);
 assert.equal(result.officiallyVerified,false);assert.equal(result.automaticPlaybackEnabled,false);
});
test('unconfigured, mismatched or stale source cannot pass',()=>{
 assert.equal(assessMissileProvenance(base,{nowMs:now}).reason,'SOURCE_ALLOWLIST_EMPTY');
 assert.equal(assessMissileProvenance({...base,channelId:'other'},options).reason,'CHANNEL_NOT_ALLOWLISTED');
 assert.equal(assessMissileProvenance({...base,region:'Другая область'},options).reason,'REGION_MISMATCH');
 assert.equal(assessMissileProvenance({...base,occurredAt:new Date(now-300000).toISOString()},options).reason,'STALE_OR_UNKNOWN_TIME');
});
