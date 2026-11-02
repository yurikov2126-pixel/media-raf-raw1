import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyMchsAudioBinding,assessMchsChannelAudioAgreement} from '../src/lib/mchsEventAudioBinding.js';
const bytes=Buffer.from('verified-isolated-alarm-test');
const event={id:'e1',eventType:'MISSILE_DANGER',assetId:'asset1',repeats:2};
const asset={id:'asset1',eventType:'MISSILE_DANGER',
 sha256:createHash('sha256').update(bytes).digest('hex')};
test('exact bytes and event asset type are bound without broadcast authorization',()=>{
 const bound=verifyMchsAudioBinding({event,asset,bytes});
 assert.equal(bound.verified,true);assert.equal(bound.publicPlaybackAuthorized,false);
 assert.equal(assessMchsChannelAudioAgreement(bound,
  {eventId:'e1',assetId:'asset1',sha256:asset.sha256,repeats:2},
  {eventId:'e1',assetId:'asset1',sha256:asset.sha256,repeats:2}).agreed,true);
});
test('reject corrupt bytes, swapped type, substituted id and audio disagreement',()=>{
 assert.equal(verifyMchsAudioBinding({event,asset,bytes:Buffer.from('different')}).reason,'AUDIO_DIGEST_MISMATCH');
 assert.equal(verifyMchsAudioBinding({event,asset:{...asset,eventType:'MISSILE_ALL_CLEAR'},bytes}).verified,false);
 assert.equal(verifyMchsAudioBinding({event:{...event,assetId:'other'},asset,bytes}).verified,false);
 const bound=verifyMchsAudioBinding({event,asset,bytes});
 assert.equal(assessMchsChannelAudioAgreement(bound,
  {eventId:'e1',assetId:'asset1',sha256:asset.sha256,repeats:2},
  {eventId:'e1',assetId:'asset1',sha256:'0'.repeat(64),repeats:2}).agreed,false);
});
test('all-clear must play exactly once',()=>{
 const clear={...event,eventType:'MISSILE_ALL_CLEAR',repeats:2};
 assert.equal(verifyMchsAudioBinding({event:clear,asset:{...asset,eventType:'MISSILE_ALL_CLEAR'},bytes}).reason,'INVALID_REPEAT_POLICY');
});
