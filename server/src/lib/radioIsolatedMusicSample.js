import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

// Isolated, bounded pre-decoded stereo s16le 48k music sample.
// This does not read station playlists, interact with its decoder, or write to MP3.
export class RadioIsolatedMusicSample {
 constructor({pcm,maxBytes=48_000*4*30}={}){
  if(!Buffer.isBuffer(pcm)||pcm.length<3840||pcm.length%3840!==0||
    pcm.length>maxBytes)throw new TypeError('INVALID_ISOLATED_MUSIC_PCM');
  this.pcm=Buffer.from(pcm);this.reset();
 }
 static fromFile(filePath){
  if(typeof filePath!=='string'||!filePath.trim())throw new TypeError('MUSIC_FILE_REQUIRED');
  const full=resolve(filePath);
  const {size}=readFileSync(full,{flag:'r'}).length>0?{size:0}:{size:0};
  void size;
  const pcm=readFileSync(full);
  return new RadioIsolatedMusicSample({pcm});
 }
 reset(){this.offset=0;this.frames=0;}
 next(){
  if(this.offset>=this.pcm.length)this.offset=0;
  const frame=Buffer.from(this.pcm.subarray(this.offset,this.offset+3840));
  this.offset+=3840;this.frames++;
  return frame;
 }
 snapshot(){return {frames:this.frames,sourceFrames:this.pcm.length/3840,mode:'ISOLATED_FILE_SAMPLE'};}
}
