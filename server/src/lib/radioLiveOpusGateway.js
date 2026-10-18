import http from 'node:http';
import { once } from 'node:events';
import { createOpusPcmDecoder, pcmPacketize } from './radioOpusPcmGateway.js';
import { RadioPcmStaging } from './radioPcmStaging.js';

// Server-only, loopback-only live decoding pilot. This DOES NOT connect to station output.
export class RadioLiveOpusGateway {
  constructor({decoderFactory=createOpusPcmDecoder, request=workerRequest, maxPendingBytes=512*1024}={}) {
    this.decoderFactory=decoderFactory;this.request=request;this.maxPendingBytes=maxPendingBytes;
    this.running=false;this.pendingBytes=0;this.packets=0;this.samples=0;
    this.lastError=null;this.session=null;this.decoder=null;
    this.pcmStaging=new RadioPcmStaging();
  }
  async start() {
    if(this.running)throw new Error('GATEWAY_ALREADY_RUNNING');
    // Acquire exclusive intake session before starting FFmpeg.
    const created=await this.request('POST','/live-pcm/session',null,{'x-radio-session-owner':'browser-opus-isolated'});
    if(typeof created.sessionToken!=='string'||!created.sessionToken)throw new Error('SESSION_UNAVAILABLE');
    this.session=created.sessionToken;
    try {
      this.decoder=this.decoderFactory();
      this.running=true;
      this.decoder.stderr?.on('data',()=>{}); // consume stderr to avoid pipe deadlock
      this.decoder.on('error',e=>this.abort(e));
      this.decoder.on('close',code=>{if(this.running)this.abort(new Error('FFMPEG_EXIT_'+code));});
      this.pump=this.forwardPcm().catch(e=>this.abort(e));
    } catch(e) {await this.stop();throw e;}
    return this.snapshot();
  }
  async forwardPcm(){
    for await(const {pcm,frameIndex} of pcmPacketize(this.decoder.stdout)){
      if(!this.running)break;
      const staged=this.pcmStaging.push({pcm,frameIndex});
      if(!staged.accepted)throw new Error(staged.reason);
      await this.request('POST','/live-pcm/ingest',pcm,{
        'x-radio-session-token':this.session,'x-radio-pcm-frame-index':String(frameIndex),
      });
      this.pcmStaging.shift(); // staging tracks only in-flight PCM, not playout readiness
      this.packets++;this.samples+=pcm.length/4;
    }
  }
  async write(chunk) {
    if(!this.running||!this.decoder||!this.session)throw new Error('GATEWAY_INACTIVE');
    if(!Buffer.isBuffer(chunk)||chunk.length===0||chunk.length>128*1024)throw new Error('INVALID_CHUNK');
    if(this.pendingBytes+chunk.length>this.maxPendingBytes) {
      this.abort(new Error('GATEWAY_BACKPRESSURE'));
      throw new Error('GATEWAY_BACKPRESSURE');
    }
    this.pendingBytes+=chunk.length;
    try {
      if(!this.decoder.stdin.write(chunk)){
        // Stop accepting the browser's next chunk until FFmpeg signals writable.
        await Promise.race([
          once(this.decoder.stdin,'drain'),
          new Promise((_,reject)=>setTimeout(()=>reject(new Error('DECODER_STALLED')),3000)),
        ]);
      }
      if(!this.running)throw new Error('GATEWAY_STOPPED');
      return this.snapshot();
    } catch(e) {this.abort(e);throw e;}
    finally {this.pendingBytes-=chunk.length;}
  }
  abort(error){
    this.lastError=String(error?.message||error);
    void this.stop();
  }
  async stop(){
    this.running=false;
    if(this.decoder){
      const decoder=this.decoder;this.decoder=null;
      decoder.stdin?.destroy();
      decoder.stdout?.destroy();
      if(!decoder.killed)decoder.kill('SIGTERM');
    }
    if(this.session){
      const token=this.session;this.session=null;
      await this.request('DELETE','/live-pcm/session',null,{'x-radio-session-token':token}).catch(()=>{});
    }
    this.pendingBytes=0;
    this.pcmStaging.clearQueue();
  }
  snapshot(){return {running:this.running,packets:this.packets,samples:this.samples,
    pendingBytes:this.pendingBytes,lastError:this.lastError,pcm:this.pcmStaging.snapshot(),connectedToEncoder:false,mode:'ISOLATED_PCM_INTAKE'};}
}
export function workerRequest(method,path,body=null,headers={}){
  const secret=process.env.RADIO_PLAYOUT_SECRET||'';
  const port=Number(process.env.RADIO_PLAYOUT_PORT||4105);
  if(secret.length<32||!Number.isInteger(port)||port<1||port>65535)
    return Promise.reject(new Error('WORKER_NOT_CONFIGURED'));
  return new Promise((resolve,reject)=>{
    const req=http.request({hostname:'127.0.0.1',port,path,method,
      timeout:3000,headers:{'x-radio-worker-secret':secret,...headers,...(body?{
        'content-type':'application/octet-stream','content-length':body.length,
      }:{})}},res=>{
        const chunks=[];let length=0;
        res.on('data',b=>{length+=b.length;if(length>300000)res.destroy(new Error('RESPONSE_TOO_LARGE'));else chunks.push(b);});
        res.on('error',reject);
        res.on('end',()=>{
          if(res.statusCode<200||res.statusCode>=300)return reject(new Error('WORKER_HTTP_'+res.statusCode));
          try{resolve(JSON.parse(Buffer.concat(chunks).toString()||'{}'));}catch(e){reject(e);}
        });
      });
    req.on('timeout',()=>req.destroy(new Error('WORKER_TIMEOUT')));
    req.on('error',reject);req.end(body);
  });
}
