import { describe, it, expect, vi } from 'vitest';
import { PassThrough } from 'node:stream';
import { RadioLiveOpusGateway } from '../src/lib/radioLiveOpusGateway.js';

function setup(){
  const stdin=new PassThrough(),stdout=new PassThrough(),stderr=new PassThrough();
  const decoder={stdin,stdout,stderr,killed:false,
    on:vi.fn(),kill:vi.fn(function(){this.killed=true;})};
  const calls=[];
  const request=vi.fn(async(method,path,body,headers)=>{
    calls.push({method,path,body,headers});
    if(path==='/live-pcm/session'&&method==='POST')return {sessionToken:'test-session'};
    return {};
  });
  const gateway=new RadioLiveOpusGateway({decoderFactory:()=>decoder,request});
  return {gateway,decoder,request,calls};
}
describe('isolated browser Opus / PCM gateway',()=>{
  it('acquires and releases a worker session, never the station encoder',async()=>{
    const {gateway,calls}=setup();
    await gateway.start();
    expect(gateway.snapshot().connectedToEncoder).toBe(false);
    expect(calls[0].path).toBe('/live-pcm/session');
    await gateway.stop();
    expect(calls.at(-1).path).toBe('/live-pcm/session');
    expect(calls.at(-1).method).toBe('DELETE');
  });
  it('enforces a strict bounded input and rejects malformed packets',async()=>{
    const {gateway}=setup();
    await gateway.start();
    await expect(gateway.write(Buffer.alloc(0))).rejects.toThrow('INVALID_CHUNK');
    await expect(gateway.write(Buffer.alloc(131073))).rejects.toThrow('INVALID_CHUNK');
    await gateway.write(Buffer.from([1,2,3,4]));
    await gateway.stop();
    await expect(gateway.write(Buffer.from([1]))).rejects.toThrow('GATEWAY_INACTIVE');
  });
  it('fails closed when worker session cannot be acquired',async()=>{
    const gateway=new RadioLiveOpusGateway({request:async()=>{throw Error('WORKER_UNAVAILABLE');}});
    await expect(gateway.start()).rejects.toThrow('WORKER_UNAVAILABLE');
    expect(gateway.snapshot().running).toBe(false);
  });
  it('refuses to start a second decoder for the same session',async()=>{
    const {gateway}=setup();
    await gateway.start();
    await expect(gateway.start()).rejects.toThrow('GATEWAY_ALREADY_RUNNING');
    await gateway.stop();
  });
});
