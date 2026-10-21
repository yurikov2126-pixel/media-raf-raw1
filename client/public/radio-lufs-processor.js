// EBU R128 / ITU-R BS.1770 K-weighting, fixed 48 kHz.
// This meter analyzes the locally decoded MP3 stream, not the station's pre-encoder PCM.
// 100 ms non-overlapping energy buckets; rolling 400 ms M and 3 s S (both ungated).
const RATE=48000, BUCKET=4800, CAL=-0.691;
class Biquad {
 constructor(b,a){this.b=b;this.a=a;this.x1=0;this.x2=0;this.y1=0;this.y2=0;}
 sample(x){const y=this.b[0]*x+this.b[1]*this.x1+this.b[2]*this.x2-this.a[1]*this.y1-this.a[2]*this.y2;this.x2=this.x1;this.x1=x;this.y2=this.y1;this.y1=y;return y;}
}
class Channel {
 constructor(){this.shelf=new Biquad([1.53512485958697,-2.69169618940638,1.19839281085285],[1,-1.69065929318241,.73248077421585]);this.highpass=new Biquad([1,-2,1],[1,-1.99004745483398,.99007225036621]);}
 sample(x){return this.highpass.sample(this.shelf.sample(x));}
}
class RadioLufsProcessor extends AudioWorkletProcessor{
 constructor(){super();this.channels=[new Channel(),new Channel()];this.buckets=[];this.samples=0;this.energy=0;this.invalidRate=sampleRate!==RATE;this.frames=0;}
 process(inputs,outputs){
  const input=inputs[0]||[];
  const output=outputs[0]||[];
  for(const out of output)out.fill(0); // A separate direct path carries the audible signal.
  if(this.invalidRate)return true;
  const left=input[0],right=input[1];
  if(!left)return true;
  for(let i=0;i<left.length;i++){
   const a=this.channels[0].sample(left[i]||0);
   const b=right?this.channels[1].sample(right[i]||0):0;
   // BS.1770 stereo channel weights are 1.0. Mono is a single weighted channel.
   this.energy+=a*a+(right?b*b:0);
   this.samples++;
   if(this.samples===BUCKET){
    this.buckets.push(this.energy/BUCKET);
    if(this.buckets.length>30)this.buckets.shift();
    this.samples=0;this.energy=0;this.frames++;
    if(this.frames%2===0){
     const mean=n=>{if(this.buckets.length<n)return null;let total=0;for(let j=this.buckets.length-n;j<this.buckets.length;j++)total+=this.buckets[j];return total/n;};
     const toLufs=e=>e===null?null:e<=0?-Infinity:CAL+10*Math.log10(e);
     const m=toLufs(mean(4)),s=toLufs(mean(30));
     this.port.postMessage({momentary:Number.isFinite(m)?m:null,shortTerm:Number.isFinite(s)?s:null,measuring:true});
    }
   }
  }
  return true;
 }
}
registerProcessor('radio-lufs-meter',RadioLufsProcessor);
