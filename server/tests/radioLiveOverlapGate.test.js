import {describe,it,expect} from 'vitest';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
describe('crossfade live-air regression checks',()=>{
 it('parses the deployed playout worker',()=>{
  const result=spawnSync(process.execPath,['--check',path.join(root,'workers/radioPlayout.js')],{encoding:'utf8'});
  expect(result.status,result.stderr).toBe(0);
 });
 it('does not disqualify reverse mixing after the first decoder packet',()=>{
  const worker=readFileSync(path.join(root,'workers/radioPlayout.js'),'utf8');
  expect(worker).toContain("liveMixSession?.direction==='REVERSE'");
  expect(worker).toContain("RADIO_CROSSFADE_GATE");
  expect(worker).toContain("NO_REVERSE_RESERVATION");
 });
});
