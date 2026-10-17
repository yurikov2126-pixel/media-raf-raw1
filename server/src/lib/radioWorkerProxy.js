import http from 'node:http';
const port=Number(process.env.RADIO_PLAYOUT_PORT || 4105);
const secret=process.env.RADIO_PLAYOUT_SECRET || '';

function requestWorker(endpoint, response) {
  if(process.env.RADIO_PLAYOUT_ENABLED!=='true' || secret.length<32)
    return response.status(503).json({error:'Серверный playout не активирован'});
  const upstream=http.request({hostname:'127.0.0.1',port,path:endpoint,method:'GET',
    headers:{'x-radio-worker-secret':secret},timeout:5000},worker=>{
      if(worker.statusCode!==200) {
        response.status(503).json({error:'Playout недоступен'});
        worker.resume();return;
      }
      if(endpoint==='/stream') {
        response.setHeader('Content-Type','audio/mpeg');
        response.setHeader('Cache-Control','private, no-store, no-transform');
        response.setHeader('X-Content-Type-Options','nosniff');
        worker.pipe(response);
        response.on('close',()=>{upstream.destroy();worker.destroy();});
      } else {
        response.setHeader('Cache-Control','no-store');
        response.setHeader('Content-Type','application/json');
        worker.pipe(response);
      }
    });
  upstream.on('timeout',()=>upstream.destroy(new Error('Playout timeout')));
  upstream.on('error',()=>{
    if(!response.headersSent)response.status(503).json({error:'Нет связи с серверным playout'});
    else response.destroy();
  });
  upstream.end();
}
export const streamWorker=(req,res)=>requestWorker('/stream',res);
export const workerHealth=(req,res)=>requestWorker('/health',res);
