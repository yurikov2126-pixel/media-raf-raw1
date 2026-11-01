import test from 'node:test';
import assert from 'node:assert/strict';
import {correlateMissileBulletins} from '../src/lib/mchsBulletinCorrelation.js';
const now=Date.parse('2026-11-01T20:00:00Z');
const event={id:'event-1',source:'MCHS_ANDROID',sourceEventId:'original-1',
 title:'Ракетная опасность',body:'Тульская область',region:'Тульская область',
 occurredAt:new Date(now-10000).toISOString(),verified:true};
const post={postId:'100',eventType:'MISSILE_DANGER',fresh:true,
 publishedAt:new Date(now-15000).toISOString(),sourceUrl:'https://t.me/tularegion71/100'};
test('fresh public post can corroborate but never authorize ALARM',()=>{
 const [result]=correlateMissileBulletins([event],[post],{nowMs:now});
 assert.equal(result.status,'PUBLICATION_CORROBORATED');
 assert.equal(result.dispatchAuthorized,false);
 assert.equal(result.automaticPlaybackEnabled,false);
 assert.equal(result.bulletin.url,post.sourceUrl);
});
test('stale event, absent bulletin and mismatched hazard stay blocked',()=>{
 assert.equal(correlateMissileBulletins([{...event,occurredAt:new Date(now-500000).toISOString()}],[post],{nowMs:now})[0].status,'REJECTED');
 assert.equal(correlateMissileBulletins([event],[],{nowMs:now})[0].status,'UNMATCHED');
 assert.equal(correlateMissileBulletins([event],[{...post,eventType:'MISSILE_ALL_CLEAR'}],{nowMs:now})[0].status,'UNMATCHED');
});
test('one publication cannot validate two incoming observations',()=>{
 const matches=correlateMissileBulletins([event,{...event,id:'event-2',sourceEventId:'original-2'}],[post],{nowMs:now});
 assert.deepEqual(matches.map(x=>x.status),['PUBLICATION_CORROBORATED','UNMATCHED']);
});
