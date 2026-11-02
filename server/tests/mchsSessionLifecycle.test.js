import test from 'node:test';import assert from 'node:assert/strict';
import {advanceMchsSessionLifecycle} from '../src/lib/mchsSessionLifecycle.js';
const event={id:'e1',eventType:'MISSILE_DANGER'};
test('HALT prevents session progress',()=>{const x=advanceMchsSessionLifecycle(null,{event,halted:true});assert.equal(x.state,'HALTED');assert.equal(x.automaticPlaybackEnabled,false);});
test('terminal event cannot replay',()=>assert.equal(advanceMchsSessionLifecycle({eventId:'e1',state:'STOP_CONFIRMED'},{event}).reason,'TERMINAL_EVENT_REPLAY'));
test('another event cannot interrupt without stop confirmation',()=>assert.equal(advanceMchsSessionLifecycle({eventId:'e0',state:'START_CONFIRMED'},{event}).reason,'PREVIOUS_SESSION_NOT_STOPPED'));
test('no audio ACK remains pending',()=>{const x=advanceMchsSessionLifecycle(null,{event});assert.equal(x.state,'PENDING_CONFIRMATIONS');assert.equal(x.automaticPlaybackEnabled,false);});
