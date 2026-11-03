import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {fetchIsolatedHeadphonesSelfTest} from '../src/lib/mchsHeadphonesSelfTestRelay.js';
import {createIsolatedPcmWavStream,createIsolatedSelfTestPcm} from '../src/lib/mchsIsolatedWav.js';
function fixture(){
 const pcm=createIsolatedSelfTestPcm();
 const wav=createIsolatedPcmWavStream(pcm);
 const chunks=[wav.header];let b;
 while((b=wav.next())!==null)chunks.push(b);
 return Buffer.concat(chunks);
}
function mockRequest({status=200,body=fixture(),contentType='audio/wav'}={}){
 return (options,callback)=>{
  assert.equal(options.hostname,'127.0.0.1');
  assert.equal(options.path,'/mchs-isolated-wav/self-test');
  assert.equal(options.method,'GET');
  assert.equal(options.headers['x-radio-worker-secret'],'x'.repeat(32));
  const req=new EventEmitter();
  req.setTimeout=()=>{};
  req.end=()=>{
   Promise.resolve().then(()=>{
    const res=new EventEmitter();
    res.statusCode=status;
    res.headers={'content-type':contentType,'content-length':String(body.length)};
    res.resume=()=>{};
    res.destroy=()=>{};
    callback(res);
    if(status===200){
     res.emit('data',body);
     res.emit('end');
    }
   });
  };
  return req;
 };
}
test('authenticated fixed-route proxy delivers exactly one valid WAV',async()=>{
 const wav=await fetchIsolatedHeadphonesSelfTest({
  secret:'x'.repeat(32),request:mockRequest()
 });
 assert.equal(wav.length,384044);
 assert.equal(wav.toString('ascii',0,4),'RIFF');
});
test('rejects disabled Worker response and non-WAV',async()=>{
 await assert.rejects(fetchIsolatedHeadphonesSelfTest({
  secret:'x'.repeat(32),request:mockRequest({status:404})
 }),/ISOLATED_WAV_UNAVAILABLE/);
 await assert.rejects(fetchIsolatedHeadphonesSelfTest({
  secret:'x'.repeat(32),request:mockRequest({contentType:'application/json'})
 }),/INVALID_WAV_CONTENT_TYPE/);
});
test('rejects mutated self-test bytes and missing secret',async()=>{
 const broken=fixture();broken.writeUInt32LE(44100,24);
 await assert.rejects(fetchIsolatedHeadphonesSelfTest({
  secret:'x'.repeat(32),request:mockRequest({body:broken})
 }),/INVALID_SELF_TEST_WAV/);
 await assert.rejects(fetchIsolatedHeadphonesSelfTest({
  secret:'short',request:mockRequest()
 }),/WORKER_SECRET_UNAVAILABLE/);
});
