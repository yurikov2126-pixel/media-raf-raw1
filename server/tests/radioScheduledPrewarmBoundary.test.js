import {test,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const file=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../workers/radioPlayout.js');
test('12-second early prewarm does not query only a 5-second future window',()=>{
 const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
 expect(check.status,check.stderr).toBe(0);
 const source=readFileSync(file,'utf8');
 const section=source.slice(source.indexOf('if(!scheduledPrewarmRequested&&'),source.indexOf('if(state.playout?.trackId===asset.id)'));
 expect(section).toContain('boundary-Date.now()<12000');
 expect(section).toContain('new Date(boundary-500)');
 expect(section).toContain('new Date(boundary+500)');
 expect(section).not.toContain('Date.now()+5000');
 expect(section).toContain('scheduledPrewarmRequested=false');
 expect(section).toContain('RADIO_SCHEDULED_PREWARM');
});
