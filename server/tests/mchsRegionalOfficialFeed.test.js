import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRegionalOfficialFeed} from '../src/lib/mchsRegionalOfficialFeed.js';
const html='<div class="tgme_widget_message_wrap"><div data-post="tularegion71/30100"><div class="tgme_widget_message_text js-message_text" dir="auto">РАКЕТНАЯ ОПАСНОСТЬ на территории Тульской области!</div><time datetime="2026-11-01T19:00:00+00:00"></time></div></div><div class="tgme_widget_message_wrap"><div data-post="tularegion71/30101"><div class="tgme_widget_message_text js-message_text" dir="auto">ОТБОЙ РАКЕТНОЙ опасности на территории Тульской области!</div><time datetime="2026-11-01T19:01:00+00:00"></time></div></div>';
test('parses regional government danger and all-clear without authorizing automatic audio',()=>{
 const posts=parseRegionalOfficialFeed(html,{nowMs:Date.parse('2026-11-01T19:01:10Z')});
 assert.deepEqual(posts.map(p=>p.eventType),['MISSILE_DANGER','MISSILE_ALL_CLEAR']);
 assert.equal(posts[1].fresh,true);
 assert.equal(posts[0].independentlyAuthenticated,false);
 assert.equal(posts[0].executionEnabled,false);
});
test('rejects posts lacking stable ID, time or matching event type',()=>{
 const invalid='<div class="tgme_widget_message_wrap"><time datetime="2026-11-01T19:00:00Z"></time><div class="tgme_widget_message_text">РАКЕТНАЯ ОПАСНОСТЬ</div></div>';
 assert.deepEqual(parseRegionalOfficialFeed(invalid),[]);
});
