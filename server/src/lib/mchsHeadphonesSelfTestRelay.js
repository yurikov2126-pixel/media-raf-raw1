import http from 'node:http';

// A bounded, one-shot relay. This cannot target a station stream or take
// arbitrary URLs/asset IDs from the caller.
export async function fetchIsolatedHeadphonesSelfTest({
 request=http.request,secret=process.env.RADIO_PLAYOUT_SECRET,
 port=Number(process.env.RADIO_PLAYOUT_PORT||4105),maxBytes=400000
}={}){
 if(typeof secret!=='string'||secret.length<32)throw Error('WORKER_SECRET_UNAVAILABLE');
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('INVALID_WORKER_PORT');
 return await new Promise((resolve,reject)=>{
  let settled=false;
  const fail=error=>{if(!settled){settled=true;reject(error);}};
  const req=request({hostname:'127.0.0.1',port,
   path:'/mchs-isolated-wav/self-test',method:'GET',
   headers:{'x-radio-worker-secret':secret}},res=>{
    if(res.statusCode!==200){res.resume();fail(Error('ISOLATED_WAV_UNAVAILABLE'));return;}
    if(res.headers['content-type']!=='audio/wav'){
      res.destroy();fail(Error('INVALID_WAV_CONTENT_TYPE'));return;
    }
    const declared=Number(res.headers['content-length']);
    if(!Number.isSafeInteger(declared)||declared<44||declared>maxBytes){
      res.destroy();fail(Error('INVALID_WAV_SIZE'));return;
    }
    const chunks=[];let total=0;
    res.on('data',chunk=>{
      total+=chunk.length;
      if(total>maxBytes){res.destroy();fail(Error('ISOLATED_WAV_TOO_LARGE'));return;}
      chunks.push(chunk);
    });
    res.on('error',fail);
    res.on('end',()=>{
      if(settled)return;
      if(total!==declared){fail(Error('ISOLATED_WAV_TRUNCATED'));return;}
      const bytes=Buffer.concat(chunks);
      // Only accept the fixed 2 s, 48 kHz stereo PCM16 self-test.
      if(bytes.length!==384044||bytes.toString('ascii',0,4)!=='RIFF'||
       bytes.toString('ascii',8,12)!=='WAVE'||
       bytes.toString('ascii',12,16)!=='fmt '||
       bytes.readUInt16LE(20)!==1||bytes.readUInt16LE(22)!==2||
       bytes.readUInt32LE(24)!==48000||bytes.readUInt16LE(34)!==16||
       bytes.toString('ascii',36,40)!=='data'||
       bytes.readUInt32LE(40)!==384000){
        fail(Error('INVALID_SELF_TEST_WAV'));return;
      }
      settled=true;resolve(bytes);
    });
  });
  req.setTimeout(5000,()=>req.destroy(Error('ISOLATED_WAV_TIMEOUT')));
  req.on('error',fail);
  req.end();
 });
}
