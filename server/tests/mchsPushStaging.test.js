import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {shouldStageMchsPushDelivery} from '../src/lib/mchsPushStaging.js';
import {assessMchsPushCandidate} from '../src/lib/mchsPushEligibility.js';

const nowMs=Date.parse('2026-11-06T20:00:00Z');
const candidate=assessMchsPushCandidate({
 eventId:'android-test',title:'Ракетная опасность',body:'Ракетная опасность',
 channelId:'tula',region:'Тульская область',occurredAt:'2026-11-06T19:59:59Z'
},{allowedChannels:['tula'],nowMs});

test('regression: ingest Prisma projection includes classified eventType used by outbox gate',()=>{
 const route=readFileSync(fileURLToPath(new URL('../src/routes/safetyIngest.js',import.meta.url)),'utf8');
 assert.match(route,/select:\s*\{\s*id:\s*true,\s*receivedAt:\s*true,\s*verified:\s*true,\s*eventType:\s*true\s*\}/);
});

test('new signed and classified event stages exactly one PUSH job',()=>{
 assert.equal(candidate.eligible,true);
 assert.equal(shouldStageMchsPushDelivery({
  candidate,alreadySaved:false,
  storedEvent:{id:'event-1',eventType:'MISSILE_DANGER',verified:true}
 }),true);
});

test('duplicate Android event is never staged again',()=>{
 assert.equal(shouldStageMchsPushDelivery({
  candidate,alreadySaved:true,
  storedEvent:{id:'event-1',eventType:'MISSILE_DANGER',verified:true}
 }),false);
});

test('missing or mismatched eventType fails closed; verified is audio-only',()=>{
 for(const event of [
  {id:'a',verified:true},
  {id:'a',verified:true,eventType:'UAV_DANGER'}
 ]){
  assert.equal(shouldStageMchsPushDelivery({
   candidate,alreadySaved:false,storedEvent:event
  }),false);
 }
});

test('UAV PUSH is staged without being eligible for missile audio',()=>{
 const uav=assessMchsPushCandidate({
  eventId:'uav',title:'Опасность атаки БПЛА',body:'Опасность атаки БПЛА',
  channelId:'tula',region:'Тульская область',occurredAt:'2026-11-06T19:59:59Z'
 },{allowedChannels:['tula'],nowMs});
 assert.equal(uav.eligible,true);
 assert.equal(shouldStageMchsPushDelivery({candidate:uav,alreadySaved:false,
  storedEvent:{id:'event-uav',verified:false,eventType:'UAV_DANGER'}}),true);
 assert.equal(shouldStageMchsPushDelivery({candidate:uav,alreadySaved:false,
  storedEvent:{id:'event-uav',verified:true,eventType:'UAV_DANGER'}}),true);
});
