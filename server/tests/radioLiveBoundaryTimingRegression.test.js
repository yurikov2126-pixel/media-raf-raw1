import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {test,expect} from 'vitest';
import {pcmBoundaryDriftMs,isPcmBoundaryAligned} from '../src/lib/radioPcmBoundaryClock.js';
const file=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../workers/radioPlayout.js');
test('radio worker syntax and two directional timing guards',()=>{
 const syntax=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
 expect(syntax.status,syntax.stderr).toBe(0);
 const code=readFileSync(file,'utf8');
 expect(code).toContain('boundary-Date.now()<12000&&boundary-Date.now()>2500');
 expect(code).toContain('isPcmBoundaryAligned({remainingMs:remaining,emittedBytes');
 expect(code).toContain('!reverseMixAuthorityAt&&boundary-Date.now()<=4500');
});

test('boundary clock accounts for emitted PCM and rejects missing alignment',()=>{
 const bytesPerMs=192;
 const base={remainingMs:8000,emittedBytes:2500*bytesPerMs,
   boundaryMs:10000,nowMs:4500,bytesPerMs};
 expect(pcmBoundaryDriftMs(base)).toBe(0);
 expect(isPcmBoundaryAligned(base)).toBe(true);
 expect(isPcmBoundaryAligned({...base,emittedBytes:0})).toBe(false);
 expect(isPcmBoundaryAligned({...base,nowMs:7900})).toBe(false);
});
