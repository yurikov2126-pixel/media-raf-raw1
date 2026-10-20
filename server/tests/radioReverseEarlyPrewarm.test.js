import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const worker=readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../workers/radioPlayout.js'),'utf8');
it('starts reverse prewarm early enough and does not flood async DB reservations',()=>{
 expect(worker).toContain('boundary-Date.now()<12000&&boundary-Date.now()>2000');
 expect(worker).toContain('!reverseReserveInFlight');
 expect(worker).toContain('reverseReserveInFlight=true');
 expect(worker).toContain('finally{reverseReserveInFlight=false;}');
});
