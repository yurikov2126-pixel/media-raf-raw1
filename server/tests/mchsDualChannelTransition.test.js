import test from 'node:test';import assert from 'node:assert/strict';
import {assessMchsDualChannelTransition} from '../src/lib/mchsDualChannelTransition.js';
const now=Date.parse('2026-11-02T15:00:00Z');
const base={eventId:'e1',eventType:'MISSILE_DANGER',action:'START',confirmedAt:'2026-11-02T14:59:59Z',confirmed:true,playbackState:'ACTIVE'};
const params={eventId:'e1',eventType:'MISSILE_DANGER',action:'START',worker:base,agent:base,nowMs:now};
test('both START acknowledgements must be event-specific',()=>{const x=assessMchsDualChannelTransition(params);assert.equal(x.bothConfirmed,true);assert.equal(x.automaticDispatchEnabled,false);});
test('metadata receipt alone cannot confirm agent audio',()=>{const x=assessMchsDualChannelTransition({...params,agent:{...base,playbackState:'OBSERVED'}});assert.equal(x.bothConfirmed,false);});
test('STOP requires both channels STOPPED',()=>{const stop={...base,action:'STOP',playbackState:'STOPPED'};assert.equal(assessMchsDualChannelTransition({...params,action:'STOP',worker:stop,agent:stop}).bothConfirmed,true);assert.equal(assessMchsDualChannelTransition({...params,action:'STOP',worker:stop,agent:{...stop,confirmed:false}}).bothConfirmed,false);});
test('stale, foreign and missing receipts are rejected',()=>{for(const agent of [null,{...base,eventId:'other'},{...base,confirmedAt:'2026-11-02T14:00:00Z'}])assert.equal(assessMchsDualChannelTransition({...params,agent}).bothConfirmed,false);});
