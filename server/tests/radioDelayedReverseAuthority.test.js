import {test,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const file=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../workers/radioPlayout.js');
test('worker parses and delayed slot validation retains all three identity gates',()=>{
 const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
 expect(result.status,result.stderr).toBe(0);
 const source=readFileSync(file,'utf8');
 expect(source).toContain('delayedScheduledSlot.id===reservation.slotId');
 expect(source).toContain('delayedScheduledSlot.originalEndMs===dbEndMs');
 expect(source).toContain('delayedScheduledSlot.actualEndMs===reservation.slotEndMs');
 expect(source).toContain("!active&&!publicLive.onAir");
 expect(source).toContain('lastEndMismatchKey');
});
