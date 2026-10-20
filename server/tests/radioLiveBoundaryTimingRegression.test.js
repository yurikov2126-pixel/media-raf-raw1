import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {test,expect} from 'vitest';
const file=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../workers/radioPlayout.js');
test('radio worker syntax and two directional timing guards',()=>{
 const syntax=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
 expect(syntax.status,syntax.stderr).toBe(0);
 const code=readFileSync(file,'utf8');
 expect(code).toContain('boundary-Date.now()<12000&&boundary-Date.now()>2500');
 expect(code).toContain('Math.abs((remaining-emittedBytes/PCM_BYTES_PER_MS)-(boundary-Date.now()))<900');
 expect(code).toContain('!reverseMixAuthorityAt&&boundary-Date.now()<=4500');
});
