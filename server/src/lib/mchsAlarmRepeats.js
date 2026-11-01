/** Bounded repeats for the danger announcement; ALL_CLEAR is always played once. */
export const MCHS_ALARM_REPEATS_KEY='mchs_danger_alarm_repeats_v1';
export const DEFAULT_DANGER_REPEATS=1;
export const MAX_DANGER_REPEATS=5;
export function normalizeDangerRepeats(value){
 return Number.isInteger(value)&&value>=1&&value<=MAX_DANGER_REPEATS?value:DEFAULT_DANGER_REPEATS;
}
export function validateDangerRepeats(value){
 return Number.isInteger(value)&&value>=1&&value<=MAX_DANGER_REPEATS;
}
export function planAlarmSequence({dangerAssetId,clearAssetId,dangerRepeats=1}={}){
 const repetitions=normalizeDangerRepeats(dangerRepeats);
 return [...Array.from({length:repetitions},(_,index)=>({stage:'DANGER',assetId:dangerAssetId,repetition:index+1,total:repetitions})),
 {stage:'ALL_CLEAR',assetId:clearAssetId,repetition:1,total:1}];
}
