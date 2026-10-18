#!/usr/bin/env node
/**
 * Radio staging preflight. Read-only; no sessions started, no audio played.
 * Run on the STAGING server with RADIO_PLAYOUT_SECRET configured.
 */
import 'dotenv/config';
import {workerRequest} from '../src/lib/radioLiveOpusGateway.js';

function checkStatus(data){
 const results=[
  ['Worker intake',data.enabled===true],
  ['No encoder connection',data.connectedToEncoder===false],
  ['Timed PCM shadow enabled',data.timedShadow?.enabled===true],
  ['Live monitor not public',data.switchShadow?.connectedToEncoder===false],
  ['Private PCM lab status available',Boolean(data.pcmMixLab)],
  ['Session diagnostics available',Boolean(data.session)],
 ];
 return results;
}

try{
 const data=await workerRequest('GET','/live-pcm/status');
 const checks=checkStatus(data);
 checks.forEach(([label,ok])=>console.log((ok?'PASS':'FAIL')+' '+label));
 console.log('Session active:',data.session?.active===true?'yes':'no');
 console.log('PCM buffered (ms):',data.timedShadow?.bufferedMs??'unknown');
 console.log('No public streaming or amplifier switching was attempted.');
 if(checks.some(([,ok])=>!ok))process.exitCode=2;
}catch(error){
 console.error('STAGING PREFLIGHT FAILED:',error.message);
 process.exitCode=1;
}
