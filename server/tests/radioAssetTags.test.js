import {describe,it,expect} from 'vitest';
import {normalizeRadioTags,safeRadioTags} from '../src/lib/radioAssetTags.js';
describe('radio ID3 metadata normalization',()=>{
 it('recognizes common ffprobe format and audio-stream tags',()=>{
  const tags=normalizeRadioTags({format:{tags:{TITLE:'Song',artist:'Performer',album:'Album',genre:'Jazz',date:'2025'}},
   streams:[{codec_type:'audio',tags:{TRACK:'03/11'}}]});
  expect(tags).toMatchObject({title:'Song',artist:'Performer',album:'Album',genre:'Jazz',year:'2025',track:'03/11'});
 });
 it('sanitizes long or invalid tag fields without modifying source files',()=>{
  expect(normalizeRadioTags({format:{tags:{TITLE:'A'.repeat(250)}}}).title.length).toBe(160);
  expect(safeRadioTags({title:'Hello',comment:'X'.repeat(1000)})).toMatchObject({title:'Hello'});
  expect(safeRadioTags({comment:'X'.repeat(1000)}).comment.length).toBe(300);
  expect(safeRadioTags(null)).toBeNull();
 });
});
