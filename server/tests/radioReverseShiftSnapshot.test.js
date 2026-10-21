import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const file=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../workers/radioPlayout.js');
it('parses and snapshots delayed schedule authority during reservation',()=>{
 const parsed=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
 expect(parsed.status,parsed.stderr).toBe(0);
 const source=readFileSync(file,'utf8');
 expect(source).toContain('reverseReservedShift=delayedScheduledSlot?.id===reservation.slotId');
 expect(source).toContain('reverseReservedShift.originalEndMs===dbEndMs');
 expect(source).toContain('reverseReservedShift.actualEndMs===reservation.slotEndMs');
 expect(source).toContain('reverseReservedTarget===reservation');
});
