import {randomUUID,timingSafeEqual} from 'node:crypto';
/** Isolated ingest-session gate: no microphone capture, encoder output, or public HTTP access. */
export class LivePcmSessionGate {
 constructor({ttlMs=15000}={}){this.ttlMs=ttlMs;this.session=null;this.receivedBytes=0;this.rejected=0;}
 start(owner,nowMs=Date.now()){
  if(typeof owner!=='string'||!owner.trim()||owner.length>120)throw new TypeError('Invalid session owner');
  if(this.session && nowMs-this.session.lastAt<=this.ttlMs)throw new Error('Another live intake session is active');
  const token=randomUUID()+randomUUID();
  this.session={owner,token,lastAt:nowMs,createdAt:nowMs};this.receivedBytes=0;
  return token;
 }
 valid(token,nowMs=Date.now()){
  const s=this.session;
  if(!s||typeof token!=='string'||token.length!==s.token.length)return false;
  if(nowMs<s.lastAt||nowMs-s.lastAt>this.ttlMs)return false;
  return timingSafeEqual(Buffer.from(token),Buffer.from(s.token));
 }
 touch(token,bytes,nowMs=Date.now()){
  if(!this.valid(token,nowMs)||!Number.isSafeInteger(bytes)||bytes<=0){this.rejected++;return false;}
  this.session.lastAt=nowMs;this.receivedBytes+=bytes;return true;
 }
 stop(token){if(!this.valid(token)){this.rejected++;return false;}this.session=null;return true;}
 snapshot(nowMs=Date.now()){
  const s=this.session;return {active:!!s&&nowMs>=s.lastAt&&nowMs-s.lastAt<=this.ttlMs,
   owner:s?.owner||null,sessionStartedAt:s?new Date(s.createdAt).toISOString():null,
   lastPacketAt:s?new Date(s.lastAt).toISOString():null,receivedBytes:this.receivedBytes,rejected:this.rejected};
 }
}
