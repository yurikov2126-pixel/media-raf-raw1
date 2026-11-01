import test from 'node:test';
import assert from 'node:assert/strict';
import {assessTrainingAudioQuality} from '../src/lib/mchsTrainingAudioQuality.js';
test('zero PCM stalls only verifies server feed, never browser or Agent',()=>{
 const x=assessTrainingAudioQuality({clock:{frames:2116,gaps:0,maxDelayMs:0},overlay:{lastStopReason:'FILE_COMPLETED'}});
 assert.equal(x.state,'PCM_FEED_STABLE');
 assert.equal(x.agentPlaybackVerified,false);
 assert.equal(x.browserPlaybackVerified,false);
});
test('missing metrics, incomplete playback and gaps remain distinct',()=>{
 assert.equal(assessTrainingAudioQuality().state,'NO_MEASUREMENT');
 assert.equal(assessTrainingAudioQuality({clock:{frames:1,gaps:0,maxDelayMs:0}}).state,'NOT_COMPLETED');
 assert.equal(assessTrainingAudioQuality({clock:{frames:100,gaps:2,maxDelayMs:85},overlay:{lastStopReason:'FILE_COMPLETED'}}).state,'PCM_FEED_GAPS');
});
