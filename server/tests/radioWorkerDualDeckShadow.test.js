import {test,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const file=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../workers/radioPlayout.js');
test('dual deck clock observes encoder-bound PCM but stays shadow only',()=>{
 const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
 expect(check.status,check.stderr).toBe(0);
 const source=readFileSync(file,'utf8');
 expect(source).toContain("RADIO_STATION_DUAL_DECK_SHADOW_ENABLED==='true'");
 expect(source).toContain("new RadioStationPcmClock({overlapMs:LIVE_SOURCE_OVERLAP_MS})");
 expect(source).toContain("new RadioStationDualDeck({overlapMs:LIVE_SOURCE_OVERLAP_MS})");
 expect(source).toContain("stationClock.emit(delta)");
 expect(source).toContain("RADIO_STATION_DUAL_DECK_SHADOW");
 expect(source).toContain("deckIdle:!stationDeck.active");
});
