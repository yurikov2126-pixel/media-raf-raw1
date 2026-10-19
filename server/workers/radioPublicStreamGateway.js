#!/usr/bin/env node
// Loopback-only public MP3 gateway. Independent of the main Express service.
import 'dotenv/config';
import http from 'node:http';

const port=Number(process.env.RADIO_PUBLIC_STREAM_PORT||4106);
const workerPort=Number(process.env.RADIO_PLAYOUT_PORT||4105);
const secret=process.env.RADIO_PLAYOUT_SECRET||'';
if(process.env.RADIO_PLAYOUT_ENABLED!=='true'||secret.length<32)throw new Error('Radio worker secret is required');
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid gateway port');

async function authorizeAgent(authorization){
  if(typeof authorization!=='string'||!/^Bearer rr_[a-f0-9]{64}$/.test(authorization))return 401;
  return new Promise(resolve=>{
    const check=http.request({hostname:'127.0.0.1',port:Number(process.env.PORT||4000),
      path:'/api/radio-agent/agent/status',method:'GET',timeout:4000,
      headers:{Authorization:authorization}},response=>{
      let body='';
      response.on('data',chunk=>{body+=chunk;if(body.length>8192){check.destroy();resolve(503);}});
      response.on('end',()=>{
        if(response.statusCode===401||response.statusCode===403)return resolve(response.statusCode);
        if(response.statusCode!==200)return resolve(503);
        try{resolve(JSON.parse(body).playbackEnabled===true?200:403);}catch{resolve(503);}
      });
    });
    check.on('timeout',()=>check.destroy());
    check.on('error',()=>resolve(503));
    check.end();
  });
}
let clients=0;
const server=http.createServer(async(req,res)=>{
  const pathname=(req.url||'').split('?')[0];
  if(req.method!=='GET'||!['/api/radio-agent/listen','/api/radio-agent/agent/stream','/health'].includes(pathname)){
    res.writeHead(404).end();return;
  }
  if(pathname==='/health'){
    res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify({ok:true,clients}));return;
  }
  if(pathname==='/api/radio-agent/agent/stream'){
    const status=await authorizeAgent(req.headers.authorization);
    if(res.destroyed)return;
    if(status!==200){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:status===503?'Проверка устройства временно недоступна':status===403?'Воспроизведение запрещено':'Устройство не авторизовано'}));return;}
  }
  const upstream=http.request({hostname:'127.0.0.1',port:workerPort,path:'/stream',
    method:'GET',headers:{'x-radio-worker-secret':secret},timeout:8000},worker=>{
    if(worker.statusCode!==200){
      worker.resume();
      res.writeHead(503,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});
      res.end('Radio stream unavailable');return;
    }
    clients++;
    res.writeHead(200,{'Content-Type':'audio/mpeg','Cache-Control':'no-store, no-transform',
      'X-Content-Type-Options':'nosniff','X-Accel-Buffering':'no'});
    worker.pipe(res);
    res.once('close',()=>{clients=Math.max(0,clients-1);worker.destroy();upstream.destroy();});
    worker.once('error',()=>res.destroy());
  });
  upstream.once('timeout',()=>upstream.destroy(new Error('Upstream timeout')));
  upstream.once('error',()=>{
    if(res.headersSent){res.destroy();return;}
    res.writeHead(503,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});
    res.end('Radio stream unavailable');
  });
  upstream.end();
});
server.requestTimeout=0;
server.listen(port,'127.0.0.1',()=>console.log('Public radio gateway listening on 127.0.0.1:'+port));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close());
