/** Durable, strictly non-actuating command protocol rehearsal. */
export const MCHS_DISPATCH_PROTOCOL_KEY='mchs_dispatch_protocol_v1';
const STATES=new Set(['STAGED','ACKED_DRY_RUN','EXPIRED','HALTED']);
export function normalizeMchsDispatchProtocol(raw){
 const r=raw&&typeof raw==='object'?raw:{};
 return {halted:true,commands:Array.isArray(r.commands)?r.commands.filter(c=>
  c&&typeof c.commandId==='string'&&STATES.has(c.status)).slice(-250)
  .map(c=>({commandId:c.commandId,sourceEventId:typeof c.sourceEventId==='string'?c.sourceEventId:null,
   eventType:c.eventType,status:c.status,createdAt:c.createdAt,updatedAt:c.updatedAt})):[],
  executionEnabled:false,dispatchAuthorized:false};
}
export function stageMchsDispatchCommand(raw,{commandId,sourceEventId,eventType,createdAt},nowMs=Date.now()){
 const state=normalizeMchsDispatchProtocol(raw);
 if(typeof commandId!=='string'||!/^[-a-zA-Z0-9_]{1,120}$/.test(commandId)||
    typeof sourceEventId!=='string'||sourceEventId.length<1||sourceEventId.length>200||
    !['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(eventType))
   return {state,accepted:false,reason:'INVALID_COMMAND'};
 const existing=state.commands.find(c=>c.commandId===commandId||c.sourceEventId===sourceEventId);
 if(existing)return {state,accepted:false,reason:'DUPLICATE',command:existing};
 const when=Date.parse(createdAt);
 if(!Number.isFinite(when)||when>nowMs+30000||nowMs-when>120000)
   return {state,accepted:false,reason:'EXPIRED_OR_FUTURE'};
 const command={commandId,sourceEventId,eventType,status:'STAGED',createdAt,updatedAt:new Date(nowMs).toISOString()};
 return {state:{...state,commands:[...state.commands,command].slice(-250)},accepted:true,
  command,executionEnabled:false};
}
export function recordMchsDispatchDryRunAck(raw,{commandId,sourceEventId},nowMs=Date.now()){
 const state=normalizeMchsDispatchProtocol(raw);
 const command=state.commands.find(c=>c.commandId===commandId);
 if(!command||command.sourceEventId!==sourceEventId)return {state,accepted:false,reason:'UNKNOWN_COMMAND'};
 if(command.status==='ACKED_DRY_RUN')return {state,accepted:false,reason:'DUPLICATE_ACK'};
 if(command.status!=='STAGED')return {state,accepted:false,reason:'NOT_STAGED'};
 const created=Date.parse(command.createdAt);
 if(!Number.isFinite(created)||nowMs-created>120000||created>nowMs+30000)
   return {state:{...state,commands:state.commands.map(c=>c===command?{...c,status:'EXPIRED',updatedAt:new Date(nowMs).toISOString()}:c)},
    accepted:false,reason:'EXPIRED'};
 const updated={...command,status:'ACKED_DRY_RUN',updatedAt:new Date(nowMs).toISOString()};
 return {state:{...state,commands:state.commands.map(c=>c===command?updated:c)},accepted:true,
  command:updated,playbackVerified:false,executionEnabled:false};
}
export function haltMchsDispatchProtocol(raw,nowMs=Date.now()){
 const state=normalizeMchsDispatchProtocol(raw);
 return {...state,halted:true,commands:state.commands.map(c=>c.status==='STAGED'?
  {...c,status:'HALTED',updatedAt:new Date(nowMs).toISOString()}:c),
  executionEnabled:false,dispatchAuthorized:false};
}
