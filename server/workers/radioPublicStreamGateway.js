#!/usr/bin/env node
// Loopback-only public MP3 gateway. Independent of the main Express service.
import 'dotenv/config';
import http from 'node:http';

const port=Number(process.env.RADIO_PUBLIC_STREAM_PORT||4106);
const workerPort=Number(process.env.RADIO_PLAYOUT_PORT||4105);
const secret=process.env.RADIO_PLAYOUT_SECRET||'';
if(process.env.RADIO_PLAYOUT_ENABLED!=='true'||secret.length<32)throw new Error('Radio worker secret is required');
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid gateway port');

let clients=0;
const server=http.createServer((req,res)=>{
  const pathname=(req.url||'').split('?')[0];
  if(req.method!=='GET'||!['/api/radio-agent/listen','/health'].includes(pathname)){
    res.writeHead(404).end();return;
  }
  if(pathname==='/health'){
    res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify({ok:true,clients}));return;
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
