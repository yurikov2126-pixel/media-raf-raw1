import {test,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const worker=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../workers/radioPlayout.js');
test('forward PCM mix can continue after an overlap session is created',()=>{
 const result=spawnSync(process.execPath,['--check',worker],{encoding:'utf8'});
 expect(result.status,result.stderr).toBe(0);
 const source=readFileSync(worker,'utf8');
 expect(source).toContain("(liveMixSession?.direction==='FORWARD'||!preparedSlot.iterator)");
 expect(source).toContain("(liveMixSession?.direction==='FORWARD'||");
 expect(source).toContain("RADIO_CROSSFADE_MIX");
 expect(source).toContain("status:'COMPLETED'");
});
