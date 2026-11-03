/** Read a device Bearer token using the same contract as radioAgent deviceAuth. */
export function parseRadioAgentBearerToken(authorization){
 const match=/^Bearer (\S+)$/.exec(authorization||'');
 const token=match?.[1];
 return token&&/^rr_[a-f0-9]{64}$/.test(token)?token:null;
}
