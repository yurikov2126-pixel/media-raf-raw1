import {test,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const file=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../workers/radioPlayout.js');
test('delayed show retains original times used to authenticate reverse transition',()=>{
 const syntax=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
 expect(syntax.status,syntax.stderr).toBe(0);
 const source=readFileSync(file,'utf8');
 expect(source).toContain('originalEndMs:h.originalEndMs,actualStartMs');
 expect(source).toContain('actualEndMs:actualStartMs+(h.originalEndMs-h.originalStartMs)');
 expect(source).toContain('delayedScheduledSlot.originalEndMs===dbEndMs');
});
