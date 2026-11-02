/** Playback plan metadata for individual event rules. Never authorizes output. */
export const MCHS_TYPE_REPEAT_MIN=1;
export const MCHS_TYPE_REPEAT_MAX=5;
export function validateMchsTypeRepeats(value){
 return Number.isInteger(value)&&value>=MCHS_TYPE_REPEAT_MIN&&value<=MCHS_TYPE_REPEAT_MAX;
}
export function normalizeMchsTypeRepeats(value){
 return validateMchsTypeRepeats(value)?value:1;
}
export function buildMchsTypeAudioPreview(rule,asset){
 const repeats=normalizeMchsTypeRepeats(rule?.repeats);
 const available=!!asset&&asset.id===rule?.audioAssetId&&
  typeof asset.name==='string'&&Number.isFinite(asset.durationMs)&&asset.durationMs>0;
 return {assetId:rule?.audioAssetId||null,assetName:available?asset.name:null,repeats,
  expectedDurationMs:available?asset.durationMs*repeats:null,
  configured:available,executable:false,automaticPlaybackEnabled:false};
}
