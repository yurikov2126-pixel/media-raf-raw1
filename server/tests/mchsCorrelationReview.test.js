import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCorrelationReview} from '../src/lib/mchsCorrelationReview.js';
test('review summary does not authorize dispatch',()=>{
 const x=buildCorrelationReview([{eventId:'1',eventType:'MISSILE_DANGER',status:'PUBLICATION_CORROBORATED',
  bulletin:{url:'https://t.me/tularegion71/1'}},{eventId:'2',status:'UNMATCHED',reason:'NO_RECENT_PUBLIC_BULLETIN'}]);
 assert.equal(x.counts.corroborated,1);assert.equal(x.counts.unmatched,1);
 assert.equal(x.dispatchAuthorized,false);assert.equal(x.automaticPlaybackEnabled,false);
 assert.equal(x.items[0].bulletinUrl,'https://t.me/tularegion71/1');
});
test('unavailable source is not represented as successful comparison',()=>{
 const x=buildCorrelationReview([],{sourceAvailable:false});
 assert.equal(x.sourceAvailable,false);assert.equal(x.dispatchAuthorized,false);
});
