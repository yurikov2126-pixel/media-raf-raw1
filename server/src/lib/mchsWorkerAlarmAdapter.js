import {createMchsVerifiedWorkerTransport} from './mchsVerifiedWorkerTransport.js';

/** The Worker adapter must acknowledge START immediately and expose playback
 * completion separately. The previous implementation waited for all repeats
 * inside start(), making it incompatible with the two-channel executor.
 *
 * The underlying PCM overlay is shared with public /radio/live. This adapter
 * remains disabled unless output isolation has genuinely been established.
 */
export function createMchsWorkerAlarmAdapter(options={}){
 return createMchsVerifiedWorkerTransport(options);
}
