import http from 'node:http';
export function mchsLabFixtureRequest({method='GET',kind=null,data=null}={}){
 if(!['GET','POST','DELETE'].includes(method)||method==='POST'&&!['music','trainingVoice'].includes(kind))return Promise.reject(new Error('INVALID_ACTION'));
 const port=Number(process.env.RADIO_PLAYOUT_PORT||4105),secret=process.env.RADIO_PLAYOUT_SECRET||'';
 if(!Number.isInteger(port)||port<1||port>65535||secret.length<32)return Promise.reject(new Error('NOT_CONFIGURED'));
 if(data&&(!Buffer.isBuffer(data)||data.length>480044))return Promise.reject(new Error('TOO_LARGE'));
 return new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port,method,path:'/mchs-lab/fixtures'+(kind?'/'+kind:''),
   timeout:4000,headers:{'x-radio-worker-secret':secret,...(data?{'Content-Type':'audio/wav','Content-Length':data.length}:{})}},res=>{
   const chunks=[];let size=0;
   res.on('data',chunk=>{size+=chunk.length;if(size>4096){res.destroy(new Error('RESPONSE_TOO_LARGE'));return;}chunks.push(chunk);});
   res.on('error',reject);
   res.on('end',()=>{
    if(res.statusCode===204)return resolve({status:204,data:null});
    let payload=null;try{payload=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{}
    resolve({status:res.statusCode,data:payload});
   });
  });
  req.on('timeout',()=>req.destroy(new Error('WORKER_TIMEOUT')));
  req.on('error',reject);req.end(data||undefined);
 });
}
