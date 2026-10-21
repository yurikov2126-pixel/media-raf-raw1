import {describe,it,expect} from 'vitest';
import {validateAudioReport,audioHealth} from '../src/lib/radioAgentAudioHealth.js';
describe('radio device audio telemetry',()=>{
 it('accepts valid independent playback reports',()=>{expect(validateAudioReport({playback:'PLAYING',outputDevice:'Speakers',lastPacketAgeMs:250})).toMatchObject({playback:'PLAYING',lastPacketAgeMs:250});});
 it('rejects bogus or unbounded reports',()=>{expect(validateAudioReport({playback:'OK',outputDevice:'x'})).toBeNull();expect(validateAudioReport({playback:'PLAYING',outputDevice:'x',lastPacketAgeMs:-1})).toBeNull();});
 it('distinguishes unknown stale and degraded',()=>{const now=Date.parse('2026-10-22T00:00:00Z');expect(audioHealth(null,now).status).toBe('UNKNOWN');expect(audioHealth({playback:'PLAYING',lastPacketAgeMs:0,receivedAt:new Date(now-30000).toISOString()},now).status).toBe('STALE');expect(audioHealth({playback:'PLAYING',lastPacketAgeMs:18000,receivedAt:new Date(now).toISOString()},now).status).toBe('DEGRADED');});
});