import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeMchsPlaybackAck} from '../src/lib/mchsPlaybackAckNormalizer.js';
const now=Date.parse('2026-11-02T17:00:00Z');
const raw={mode:'EVENT_SCOPED_PLAYBACK',eventId:'event-1',eventType:'MISSILE_DANGER',
 action:'START',confirmed:true,receiptOnly:false,playbackState:'ACTIVE',
 confirmedAt:'2026-11-02T16:59:59Z'};
const opts={eventId:'event-1',eventType:'MISSILE_DANGER',action:'START',nowMs:now};
test('matching real event-scoped START validates',()=>assert.equal(normalizeMchsPlaybackAck(raw,opts).ack?.confirmed,true));
test('lab process and metadata receipt are always rejected',()=>{for(const patch of [{mode:'LAB_PROCESS_ONLY'},{receiptOnly:true},{eventId:'foreign'},{playbackState:'STOPPED'},{confirmedAt:'2026-11-02T16:58:00Z'}])assert.equal(normalizeMchsPlaybackAck({...raw,...patch},opts).ack,null);});
test('STOP must carry STOPPED state',()=>assert.equal(normalizeMchsPlaybackAck({...raw,action:'STOP',playbackState:'STOPPED'},{...opts,action:'STOP'}).ack?.confirmed,true));
