/** Internal event-to-monitor nudge. Does not dispatch audio or bypass the
 * monitor's persistent deduplication ledger / three deployment gates.
 */
let handler=null;
export function registerAndroidMonitorWake(callback){
 if(typeof callback!=='function')throw new TypeError('MONITOR_CALLBACK_REQUIRED');
 handler=callback;
}
export function wakeAndroidMonitor(){
 if(!handler)return false;
 Promise.resolve().then(()=>{
  try{Promise.resolve(handler()).catch(error=>console.error(
   'MCHS_ANDROID_WAKE_FAILED',error?.message||'UNKNOWN'));}
  catch(error){console.error('MCHS_ANDROID_WAKE_FAILED',error?.message||'UNKNOWN');}
 });
 return true;
}
