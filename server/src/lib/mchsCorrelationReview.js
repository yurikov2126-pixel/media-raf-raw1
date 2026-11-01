/** Evidence records are operator reviews only. Never grant dispatch authority. */
export const MCHS_CORRELATION_REVIEW_KEY='mchs_correlation_review_v1';
export function buildCorrelationReview(comparisons,{checkedAt=new Date().toISOString(),sourceAvailable=true}={}){
 const items=(Array.isArray(comparisons)?comparisons:[]).slice(0,100).map(item=>({
  eventId:item.eventId||null,eventType:item.eventType||null,status:item.status||'UNKNOWN',
  reason:item.reason||null,sourceEventId:item.sourceEventId||null,
  bulletinUrl:item.bulletin?.url||null}));
 return {checkedAt,sourceAvailable,counts:{
  corroborated:items.filter(x=>x.status==='PUBLICATION_CORROBORATED').length,
  unmatched:items.filter(x=>x.status==='UNMATCHED').length,
  rejected:items.filter(x=>x.status==='REJECTED').length
 },items,dispatchAuthorized:false,automaticPlaybackEnabled:false};
}
