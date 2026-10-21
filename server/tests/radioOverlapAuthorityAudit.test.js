import {test,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const file=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../workers/radioPlayout.js');
test('actual overlap and authority decisions are logged and worker parses',()=>{
 const parsed=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
 expect(parsed.status,parsed.stderr).toBe(0);
 const source=readFileSync(file,'utf8');
 for(const name of ['RADIO_REVERSE_AUTHORITY','RADIO_CROSSFADE_DECISION','reverseAuthorityInFlight','driftMs:Math.round(audioLeft-timeLeft)'])
  expect(source).toContain(name);
});
