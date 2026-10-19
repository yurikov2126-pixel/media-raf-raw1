import { describe,it,expect } from 'vitest';
import { preferArtistGap } from '../src/lib/radioRotation.js';

const track=(id,artist)=>({id,tags:{artist}});
describe('AutoDJ artist spacing at playback boundaries',()=>{
  it('avoids repeating the most recent artist when alternatives exist',()=>{
    const items=[track('a','Artist A'),track('b','Artist B'),track('c','Artist A')];
    expect(preferArtistGap(items,['Artist A'],1)[0].id).toBe('b');
  });
  it('normalizes case and spacing in artist ID3 tags',()=>{
    const items=[track('a','  ТЕСТ  ГРУППА '),track('b','Other')];
    expect(preferArtistGap(items,['тест группа'],1)[0].id).toBe('b');
  });
  it('chooses the least conflicting candidate when all artists repeat',()=>{
    const items=[track('a','Same'),track('b','Earlier')];
    expect(preferArtistGap(items,['Earlier','Same'],2)[0].id).toBe('b');
  });
  it('preserves original playback order when gap is disabled',()=>{
    const items=[track('a','Same'),track('b','Other')];
    expect(preferArtistGap(items,['Same'],0).map(x=>x.id)).toEqual(['a','b']);
  });
  it('does not group unknown artist tags into a fake artist',()=>{
    const items=[track('unknown',''),track('a','Known')];
    expect(preferArtistGap(items,['Known'],1)[0].id).toBe('unknown');
  });
});
