import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRegionalOfficialFeed,REGIONAL_OFFICIAL_FEED_URL} from '../src/lib/mchsRegionalOfficialFeed.js';
const now=Date.parse('2026-11-01T19:01:10Z');
const data={messages:[
 {body:{mid:'a1',text:'РАКЕТНАЯ ОПАСНОСТЬ на территории Тульской области!'},timestamp:Date.parse('2026-11-01T19:00:00Z'),url:'https://max.ru/tularegion71/AaBb'},
 {body:{mid:'b2',text:'ОТБОЙ РАКЕТНОЙ ОПАСНОСТИ на территории Тульской области!'},timestamp:Date.parse('2026-11-01T19:01:00Z'),url:'https://max.ru/tularegion71/BbCc'}
]};
test('MAX official channel posts parse as read-only missile events',()=>{
 const posts=parseRegionalOfficialFeed(data,{nowMs:now});
 assert.deepEqual(posts.map(p=>p.eventType),['MISSILE_DANGER','MISSILE_ALL_CLEAR']);
 assert.equal(posts[1].fresh,true);
 assert.equal(posts[0].independentlyAuthenticated,false);
 assert.equal(posts[0].executionEnabled,false);
 assert.equal(REGIONAL_OFFICIAL_FEED_URL,'https://max.ru/tularegion71');
});
test('malformed MAX posts cannot create alert candidates',()=>{
 assert.deepEqual(parseRegionalOfficialFeed({messages:[{body:{text:'Ракетная опасность'},timestamp:now}]}),[]);
 assert.deepEqual(parseRegionalOfficialFeed('<html>'),[]);
});
