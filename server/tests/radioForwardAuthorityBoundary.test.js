import {test,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const file=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../workers/radioPlayout.js');
test('approved target remains eligible throughout authorized transition window',()=>{
 const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
 expect(result.status,result.stderr).toBe(0);
 const source=readFileSync(file,'utf8');
 const begin=source.indexOf('const forwardEligible=');
 const end=source.indexOf('const eligible=forwardEligible||reverseEligible;',begin);
 const gate=source.slice(begin,end);
 expect(gate).toContain('preparedSlot.sourceAuthorityConfirmedAt<=Date.now()');
 expect(gate).toContain('Date.now()<boundary');
 expect(gate).not.toContain('Date.now()-preparedSlot.sourceAuthorityConfirmedAt<2200');
 expect(gate).toContain("preparedSlot?.scheduledSlotStartMs===boundary");
});
