import test from 'node:test';
import assert from 'node:assert/strict';
import {selectMchsAgentCommand as select} from '../src/lib/mchsAgentCommandSelection.js';
const command={version:1,sequence:1,action:'START',eventId:'e1',
 assetId:'alarm1',sha256:'a'.repeat(64),trialOnly:true,officialSourceVerified:true};
const trial={delivered:{command},ledger:{halted:false},dispatch:{halted:false},
 isolatedTrialEnabled:true,deviceTrialBound:true};
test('isolated START is selected only with all independent gates',()=>{
 const result=select(trial);
 assert.equal(result.command,command);
 assert.equal(result.executionEnabled,true);
 assert.equal(result.automaticPlaybackEnabled,false);
 for(const patch of [{isolatedTrialEnabled:false},{deviceTrialBound:false},
  {ledger:{halted:true}},{dispatch:{halted:true}},
  {delivered:{command:{...command,trialOnly:false}}}]){
  const denied=select({...trial,...patch});
  assert.equal(denied.command,null);
  assert.equal(denied.executionEnabled,false);
 }
});
test('STOP survives active HALT and has precedence over START',()=>{
 const stop={version:1,action:'STOP',sequence:2,eventId:'e1'};
 const result=select({delivered:{command:stop},ledger:{halted:true},
  dispatch:{halted:true},isolatedTrialEnabled:false,deviceTrialBound:false});
 assert.equal(result.command,stop);
 assert.equal(result.halted,true);
 assert.equal(result.executionEnabled,false);
});
test('no command remains fail closed',()=>{
 assert.equal(select({}).command,null);
 assert.equal(select({}).halted,true);
});
