import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateAndroidMissileSequence} from '../src/lib/mchsAndroidSingleSource.js';
const now=Date.parse('2026-11-02T10:00:00Z');
const mk=(id,title,offset)=>({id,sourceEventId:id,title,body:'Тульская область',
 source:'MCHS_ANDROID',region:'Тульская область',verified:true,
 occurredAt:new Date(now+offset).toISOString()});
test('Android-only danger and clear observations never authorize automatic loudspeakers',()=>{
 const x=evaluateAndroidMissileSequence([mk('danger','Ракетная опасность',-20000),
 mk('clear','Отбой ракетной опасности',-10000)],{nowMs:now});
 assert.equal(x.state,'CLEAR');assert.equal(x.corroborationRequired,false);
 assert.deepEqual(x.results.map(z=>z.transition),['OBSERVED','OBSERVED']);
 assert.equal(x.dispatchAuthorized,false);assert.equal(x.automaticPlaybackEnabled,false);
});
test('dedupe and out-of-order clear are blocked',()=>{
 const x=evaluateAndroidMissileSequence([mk('clear','Отбой ракетной опасности',-20000),
 mk('danger','Ракетная опасность',-10000),mk('danger','Ракетная опасность',-10000)],{nowMs:now});
 assert.equal(x.results[0].reason,'CLEAR_WITHOUT_DANGER');
 assert.equal(x.results[2].transition,'BLOCKED');
});
