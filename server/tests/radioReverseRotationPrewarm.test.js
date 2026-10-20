import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const worker=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../workers/radioPlayout.js');
it('parses Worker',()=>{
 const check=spawnSync(process.execPath,['--check',worker],{encoding:'utf8'});
 expect(check.status,check.stderr).toBe(0);
});
it('reuses existing station rotation and strict cooldown selection for reverse source',()=>{
 const code=readFileSync(worker,'utf8');
 const reserve=code.slice(code.indexOf('// Reserve the actual next AutoDJ asset'),code.indexOf('// Reverse transition admission'));
 expect(reserve).toContain('rotationPlan(approved,rotationSettings,nowMs)');
 expect(reserve).toContain('prioritizeUnplayed(music,history,rotationSettings.cooldownMinutes,nowMs)');
 expect(reserve).toContain('chooseQueuedTrack(distinct,history,rotationSettings.cooldownMinutes,nowMs)');
 expect(reserve).toContain('selectExhaustionFallback(');
 expect(reserve).toContain('fairNextTrack(ordered,history,artistRecent,artistGap,nowMs)');
 expect(reserve).not.toContain("reversePrewarmBlocked('ROTATION_ENABLED')");
});
