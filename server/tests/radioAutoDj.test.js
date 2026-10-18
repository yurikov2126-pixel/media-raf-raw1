import { describe, expect, it } from 'vitest';
import { autoDjCursor, selectAutoDjAssets } from '../src/lib/radioAutoDj.js';

const assets=[{id:'a',name:'Первый',durationMs:60000},
  {id:'b',name:'Второй',durationMs:120000}];

describe('Auto-DJ rotation',()=>{
  it('is disabled when no approved playlist is available',()=>{
    expect(selectAutoDjAssets(null)).toEqual([]);
    expect(selectAutoDjAssets({status:'SUBMITTED',items:assets.map(asset=>({asset}))})).toEqual([]);
  });
  it('uses only valid audio files',()=>{
    expect(selectAutoDjAssets({status:'APPROVED',items:[
      {asset:assets[0]}, {asset:{id:'bad',durationMs:0}}, {asset:assets[1]}
    ]})).toEqual(assets);
  });
  it('starts second track at its exact time boundary',()=>{
    expect(autoDjCursor(assets,60000)).toMatchObject({id:'b',offsetMs:0,index:1});
    expect(autoDjCursor(assets,90000)).toMatchObject({id:'b',offsetMs:30000});
  });
  it('wraps at the end of the playlist and has stable position after restart',()=>{
    expect(autoDjCursor(assets,180000)).toMatchObject({id:'a',offsetMs:0});
    expect(autoDjCursor(assets,190000)).toMatchObject({id:'a',offsetMs:10000});
    expect(autoDjCursor(assets,190000)).toEqual(autoDjCursor(assets,190000));
  });
  it('never schedules empty rotation',()=>{
    expect(autoDjCursor([],Date.now())).toBeNull();
  });
});
