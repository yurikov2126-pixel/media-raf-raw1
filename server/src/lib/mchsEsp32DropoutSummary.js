/** Read-only summaries of observed firmware GPIO commands and reporting gaps.
 * A command transition is NOT an electrical voltage measurement.
 */
const GAP_KINDS=new Set(['TELEMETRY_GAP','FIRMWARE_HISTORY_OVERFLOW',
  'FIRMWARE_REBOOT','FIRMWARE_COUNTER_RESET']);
export function summarizeEsp32Dropouts(events=[]){
 const list=Array.isArray(events)?events:[];
 const offs=list.filter(e=>e&&e.kind==='FIRMWARE_GPIO_OFF');
 const gaps=list.filter(e=>e&&GAP_KINDS.has(e.kind));
 const last=offs.at(-1)||null;
 const reasons={};
 for(const row of offs){
  const key=typeof row.detail==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(row.detail)?
   row.detail:'UNKNOWN';
  reasons[key]=(reasons[key]||0)+1;
 }
 return {
  readOnly:true,
  gpioOffObserved:offs.length,
  lastOff:last?{at:last.at,reason:last.detail,seq:last.seq,uptimeMs:last.uptimeMs}:null,
  dataGapsObserved:gaps.length,
  reasons,
  noPhysicalVoltageMeasurement:true,
  completeHistoryGuaranteed:false
 };
}
