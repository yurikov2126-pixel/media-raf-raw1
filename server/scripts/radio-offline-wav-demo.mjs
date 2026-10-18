import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {makeOfflineRadioWav} from '../src/lib/radioOfflineWavDemo.js';

const destination=resolve(process.argv[2]||'radio-mixer-offline-demo.wav');
const wav=makeOfflineRadioWav({seconds:4});
await writeFile(destination,wav,{flag:'wx'});
console.log('Offline WAV created:',destination,'bytes:',wav.length);
console.log('Synthetic tones only. No microphone, network or public radio output.');
