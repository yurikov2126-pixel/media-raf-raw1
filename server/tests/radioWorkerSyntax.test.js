import {describe,it,expect} from 'vitest';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
describe('live PCM worker syntax',()=>{
 it('parses actual worker including opt-in source mixing code',()=>{
  const worker=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../workers/radioPlayout.js');
  const result=spawnSync(process.execPath,['--check',worker],{encoding:'utf8'});
  expect(result.status,result.stderr||result.stdout).toBe(0);
 });
});
