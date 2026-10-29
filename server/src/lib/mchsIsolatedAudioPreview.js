/**
 * Original, generated test chime. Completely detached from station PCM and GPIO.
 * Short 48kHz 16-bit mono WAV intended only for browser-local preview.
 */
export function makeEmergencyTestWav({sampleRate=48000,durationMs=1600}={}){
 if(!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>48000||
    !Number.isInteger(durationMs)||durationMs<100||durationMs>5000)
   throw new RangeError('Invalid test signal parameters');
 const samples=Math.floor(sampleRate*durationMs/1000),dataBytes=samples*2;
 const wav=Buffer.alloc(44+dataBytes);
 wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);
 wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);
 wav.writeUInt32LE(sampleRate,24);wav.writeUInt32LE(sampleRate*2,28);
 wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);
 wav.write('data',36);wav.writeUInt32LE(dataBytes,40);
 for(let i=0;i<samples;i++){
   const t=i/sampleRate,segment=Math.floor(t/0.4),frequency=[660,880,660,440][segment]||440;
   const local=(t%0.4)/0.4;
   const envelope=Math.min(1,local*12, (1-local)*10);
   const value=Math.round(Math.sin(2*Math.PI*frequency*t)*envelope*0.12*32767);
   wav.writeInt16LE(value,44+i*2);
 }
 return wav;
}
