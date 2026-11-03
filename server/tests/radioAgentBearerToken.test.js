import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRadioAgentBearerToken} from '../src/lib/radioAgentBearerToken.js';

const token='rr_'+'a'.repeat(64);
test('accepts the same valid device Authorization header as the established command endpoint',()=>{
 assert.equal(parseRadioAgentBearerToken('Bearer '+token),token);
});
test('rejects missing, malformed, altered and secret-leaking inputs',()=>{
 for(const header of [undefined,'','Bearer','bearer '+token,'Bearer  '+token,
  'Bearer '+token+' trailing','Bearer rr_bad','Basic '+token,
  'Bearer '+'rr_'+'g'.repeat(64)]){
  assert.equal(parseRadioAgentBearerToken(header),null);
 }
});
