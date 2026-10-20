import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const worker=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../workers/radioPlayout.js');
it('keeps server worker syntactically valid',()=>{
 const result=spawnSync(process.execPath,['--check',worker],{encoding:'utf8'});
 expect(result.status,result.stderr).toBe(0);
});
it('identifies each meaningful reservation block rather than silently returning',()=>{
 const source=readFileSync(worker,'utf8');
 for(const reason of ['AUTO_DJ_DISABLED','PUBLIC_LIVE','PREWARM_BUSY','ROTATION_ENABLED','NO_ELIGIBLE_ASSET','SOURCE_CHANGED','RESERVATION_REJECTED','LOOKUP_FAILED'])
   expect(source).toContain("reversePrewarmBlocked('"+reason+"'");
 expect(source).toContain('RADIO_REVERSE_PREWARM');
});
