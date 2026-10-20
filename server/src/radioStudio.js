import { prisma } from './lib/prisma.js';
import { createHash, randomUUID } from 'node:crypto';
import { BrowserOpusUplink } from './lib/radioBrowserOpusUplink.js';
import { RadioLiveOpusGateway, workerRequest } from './lib/radioLiveOpusGateway.js';
import { evaluateRadioPresenterReadiness } from './lib/radioPresenterReadiness.js';
import { readRadioScheduleAuthority, scheduleAwareReadiness } from './lib/radioScheduleAuthority.js';
import { collectRadioHandoverObservation } from './lib/radioHandoverObservation.js';
import { RadioHandoverDryRunCoordinator } from './lib/radioHandoverDryRunCoordinator.js';

// Only signaling passes via Socket.IO; audio flows peer-to-peer over WebRTC.
// Pilot supports one presenter and one listening browser at a time.
export function initRadioStudio(io) {
  let presenter = null;
  let listener = null;
  let deviceListener = null;
  const browserUplinkEnabled=process.env.RADIO_BROWSER_OPUS_UPLINK_ENABLED==='true';
  const uplink=new BrowserOpusUplink();
  let uplinkOwner=null;
  const gatewayEnabled=browserUplinkEnabled&&process.env.RADIO_BROWSER_PCM_GATEWAY_ENABLED==='true';
  let gateway=null;
  const handoverDryRun=new RadioHandoverDryRunCoordinator();
  let pilotLease=null;
  const closeGateway=()=>{handoverDryRun.onPresenterLost('GATEWAY_CLOSED');pilotLease=null;const current=gateway;gateway=null;void current?.stop();};
  // Server-side lease: a disappeared presenter must not hold a decoder or Worker session indefinitely.
  const leaseTimer=setInterval(()=>{
    if(!uplinkOwner)return;
    const snapshot=uplink.snapshot();
    if(snapshot.active && (!gatewayEnabled || gateway?.running))return;
    const oldOwner=uplinkOwner;
    closeGateway();uplink.reset();uplinkOwner=null;
    io.to(oldOwner).emit('radio:studio:uplink:ended',{reason:'UPLINK_LEASE_EXPIRED'});
  },1000);
  leaseTimer.unref?.();
  const devices = io.of('/radio-device');
  devices.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string' || !/^rr_[a-f0-9]{64}$/.test(token)) return next(new Error('unauthorized'));
      const tokenHash = createHash('sha256').update(token).digest('hex');
      const device = await prisma.radioDevice.findUnique({ where: { tokenHash } });
      if (!device || device.revokedAt || !device.playbackAllowed) return next(new Error('device_not_authorized'));
      socket.data.deviceId = device.id;
      next();
    } catch (error) { next(error); }
  });
  const state = () => ({ live: !!presenter, listener: !!listener });
  const signalTo = (target, event, message) => {
    if (deviceListener === target) devices.to(target).emit(event, message);
    else io.to(target).emit(event, message);
  };
  const broadcast = () => { io.emit('radio:studio:state', state()); devices.emit('radio:studio:state', state()); };

  devices.on('connection', socket => {
    socket.emit('radio:studio:state', state());
    socket.on('radio:studio:state', cb => cb?.(state()));
    socket.on('radio:studio:listen', cb => {
      if (!presenter) return cb?.({error:'Ведущий ещё не вышел в эфир'});
      if (listener === socket.id) return cb?.({ok:true,alreadyListening:true});
      if (listener && listener !== socket.id) return cb?.({error:'Приёмник занят'});
      listener = socket.id; deviceListener = socket.id;
      io.to(presenter).emit('radio:studio:listener', {id:listener});
      broadcast(); cb?.({ok:true});
    });
    socket.on('radio:studio:signal', ({target,payload} = {}, cb) => {
      if (socket.id !== deviceListener || target !== presenter || !payload ||
          !['answer','candidate'].includes(payload.type) || JSON.stringify(payload).length > 30000)
        return cb?.({error:'Недопустимый сигнал'});
      io.to(presenter).emit('radio:studio:signal', {from:socket.id,payload}); cb?.({ok:true});
    });
    const leave = () => {
      if (listener === socket.id) {
        listener=null; deviceListener=null;
        if (presenter) io.to(presenter).emit('radio:studio:listener-left');
        broadcast();
      }
    };
    socket.on('radio:studio:leave',leave);
    socket.on('disconnect',leave);
  });
  io.on('connection', async socket => {
    const user = await prisma.user.findUnique({ where: { id: socket.userId }, select: { role: true } }).catch(() => null);
    if (user?.role !== 'ADMIN') return;
    socket.on('radio:studio:state', callback => callback?.(state()));
    socket.on('radio:studio:public-live:start',async callback=>{
      if(typeof callback!=='function')return;
      if(process.env.RADIO_PUBLIC_LIVE_ENABLED!=='true')
        return callback({ok:false,reason:'PUBLIC_LIVE_DISABLED'});
      if(socket.id!==presenter||uplinkOwner!==socket.id||!gateway?.running||!gateway.session)
        return callback({ok:false,reason:'ACTIVE_PRESENTER_REQUIRED'});
      try{
        const slot=await prisma.radioScheduleSlot.findFirst({
          where:{startAt:{lte:new Date()},endAt:{gt:new Date()},playlist:{status:'APPROVED'}},
          select:{id:true}
        });
        if(slot)return callback({ok:false,reason:'SCHEDULE_HAS_PRIORITY'});
        const result=await workerRequest('POST','/live-pcm/on-air',null,{'x-radio-session-token':gateway.session});
        callback({ok:result.ok===true,onAir:result.live?.onAir===true,reason:result.reason||null});
        if(result.ok)io.emit('radio:studio:public-live:changed',{onAir:true});
      }catch(error){callback({ok:false,reason:'WORKER_SWITCH_FAILED'});}
    });
    socket.on('radio:studio:public-live:stop',async callback=>{
      if(typeof callback!=='function')return;
      if(socket.id!==presenter||uplinkOwner!==socket.id||!gateway?.running||!gateway.session)
        return callback({ok:false,reason:'ACTIVE_PRESENTER_REQUIRED'});
      try{
        const result=await workerRequest('DELETE','/live-pcm/on-air',null,{'x-radio-session-token':gateway.session});
        callback({ok:result.ok===true,onAir:false});
        io.emit('radio:studio:public-live:changed',{onAir:false});
      }catch{callback({ok:false,reason:'WORKER_SWITCH_FAILED'});}
    });
    socket.on('radio:studio:uplink:start', async callback=>{
      if(!browserUplinkEnabled)return callback?.({ok:false,error:'Тестовый шлюз отключён'});
      if(socket.id!==presenter)return callback?.({ok:false,error:'Только текущий ведущий'});
      if(uplinkOwner)return callback?.({ok:false,error:'Другой вход занят'});
      uplinkOwner=socket.id;
      pilotLease=randomUUID();
      uplink.start();
      if(gatewayEnabled){
        try {
          const next=new RadioLiveOpusGateway();
          gateway=next;
          await next.start();
          if(uplinkOwner!==socket.id){await next.stop();return callback?.({ok:false,error:'Сессия завершена'});}
        } catch(error){
          closeGateway();uplink.reset();uplinkOwner=null;
          return callback?.({ok:false,error:'PCM шлюз недоступен: '+error.message});
        }
      }
      callback?.({ok:true,connectedToEncoder:false,mode:gatewayEnabled?'ISOLATED_PCM_INTAKE':'VALIDATION_ONLY'});
    });
    let chunkBusy=false;
    socket.on('radio:studio:uplink:chunk',async ({chunk,sequence}={},callback)=>{
      if(socket.id!==presenter||uplinkOwner!==socket.id)return callback?.({ok:false,error:'Нет активного входа'});
      if(chunkBusy)return callback?.({ok:false,reason:'CONCURRENT_CHUNK'});
      chunkBusy=true;
      try {
        const packet=Buffer.isBuffer(chunk)?chunk:Buffer.alloc(0);
        // Verify sequence before sending anything into FFmpeg.
        if(!uplink.snapshot().active || !Number.isSafeInteger(sequence)||sequence!==uplink.sequence||
          !packet.length||packet.length>uplink.maxChunkBytes){
          closeGateway();uplink.reset();uplinkOwner=null;
          return callback?.({ok:false,reason:'INVALID_OR_STALE_OR_OUT_OF_ORDER'});
        }
        if(gatewayEnabled){
          if(!gateway?.running)throw new Error('GATEWAY_INACTIVE');
          await gateway.write(packet);
        }
        const result=uplink.receive(packet,sequence);
        callback?.({ok:result.accepted,reason:result.reason||null,nextSequence:result.nextSequence??null});
        if(!result.accepted){closeGateway();uplink.reset();uplinkOwner=null;}
      }catch(error){
        // Capture the underlying gateway/Worker failure before closeGateway()
        // releases the decoder and resets the session. Do not expose internal
        // exception strings to public browser clients.
        const detail=String(gateway?.lastError||error?.message||'UNKNOWN');
        console.error('[RADIO_PCM_GATEWAY_FAILED]',{
          detail,
          sequence,
          gateway:gateway?.snapshot()||null,
          uplink:uplink.snapshot(),
        });
        closeGateway();uplink.reset();uplinkOwner=null;
        callback?.({ok:false,reason:'PCM_GATEWAY_FAILED'});
      }finally{chunkBusy=false;}
    });
    socket.on('radio:studio:uplink:stop',callback=>{
      if(uplinkOwner!==socket.id)return callback?.({ok:false});
      closeGateway();uplink.reset();uplinkOwner=null;callback?.({ok:true});
    });
    socket.on('radio:studio:health',async callback=>{
      if(typeof callback!=='function')return;
      // Accessible to authenticated admins only, with no public route or secrets in response.
      // Without authoritative schedule data, readiness is deliberately blocked.
      const connected=socket.id===presenter;
      const activeGateway=connected&&uplinkOwner===socket.id&&gateway?.running===true;
      let workerStatus=null;
      let workerReachable=false;
      if(gatewayEnabled&&activeGateway){
        try{
          workerStatus=await workerRequest('GET','/live-pcm/status');
          workerReachable=true;
        }catch{ /* No Worker details or credentials are exposed to the browser. */ }
      }
      let authority=null;
      try{authority=await readRadioScheduleAuthority(prisma);}catch{ /* fail closed on DB errors */ }
      const readiness=evaluateRadioPresenterReadiness({
        workerStatus,presenterAuthorized:connected,presenterConnected:connected,
        gatewayRunning:activeGateway,
        // If schedule authority cannot be read, never permit even diagnostic readiness.
        scheduledActive:authority?.known===true?authority.active:true,
        scheduledSourceReady:authority?.known===true?authority.sourceReady:false,
      });
      const verified=scheduleAwareReadiness({authority,readiness});
      const apiPublicLiveEnabled=process.env.RADIO_PUBLIC_LIVE_ENABLED==='true';
      const workerPublicLiveEnabled=workerStatus?.publicLiveEnabled===true;
      const publicLiveReady=apiPublicLiveEnabled&&workerReachable&&workerPublicLiveEnabled&&activeGateway;
      callback({ok:true,observedAt:Date.now(),
        publicLiveEnabled:apiPublicLiveEnabled,
        publicLiveWorkerEnabled:workerReachable?workerPublicLiveEnabled:null,
        publicLiveReady,publicLiveOnAir:workerStatus?.publicLive?.onAir===true,
        pilotEnabled:gatewayEnabled,opusEnabled:browserUplinkEnabled,
        pilotMode:!browserUplinkEnabled?'DISABLED':gatewayEnabled?'PCM_GATEWAY':'VALIDATION_ONLY',
        pilotBlocker:!browserUplinkEnabled?'OPUS_UPLINK_DISABLED':!gatewayEnabled?'PCM_GATEWAY_DISABLED':null,
        workerReachable,transportConnected:connected,decoderRunning:activeGateway,
        ...verified,blockers:[...new Set([...verified.blockers,
          ...(!workerReachable?['WORKER_UNAVAILABLE']:[])])],
        changeApplied:false,liveOutputConnected:false});
    });
    const observeHandover=async()=>{
      const connected=presenter===socket.id&&uplinkOwner===socket.id;
      const running=connected&&gateway?.running===true;
      let workerStatus=null;
      if(!gatewayEnabled||!running)throw new Error('PILOT_NOT_ACTIVE');
      workerStatus=await workerRequest('GET','/live-pcm/status');
      return collectRadioHandoverObservation({prisma,workerStatus,connected,gatewayRunning:running,
        presenterId:connected?socket.id:null,leaseId:connected?pilotLease:null});
    };
    socket.on('radio:studio:handover:prepare',async callback=>{
      if(typeof callback!=='function')return;
      try{
        const snapshot=await observeHandover();
        const result=handoverDryRun.prepare({owner:socket.id,snapshot});
        callback({ ...result,mode:'DRY_RUN_ONLY',connectedToEncoder:false});
      }catch{callback({ok:false,reason:'DRY_RUN_DEPENDENCY_UNAVAILABLE',changeApplied:false});}
    });
    socket.on('radio:studio:handover:verify',async ({proposalId}={},callback)=>{
      if(typeof callback!=='function')return;
      try{
        const snapshot=await observeHandover();
        callback({...handoverDryRun.verify({owner:socket.id,proposalId,snapshot}),
          mode:'DRY_RUN_ONLY',connectedToEncoder:false});
      }catch{
        handoverDryRun.onPresenterLost('VERIFICATION_UNAVAILABLE');
        callback({ok:false,reason:'AUTHORITY_OR_WORKER_UNAVAILABLE',changeApplied:false});
      }
    });
    socket.on('radio:studio:handover:cancel',callback=>{
      if(typeof callback!=='function')return;
      callback(handoverDryRun.release({owner:socket.id}));
    });
    socket.on('radio:studio:handover:journal',callback=>{
      if(typeof callback!=='function')return;
      const snapshot=handoverDryRun.snapshot();
      callback({ok:true,mode:'DRY_RUN_ONLY',pending:snapshot.pending,
        // Do not expose another admin's identity or raw session tokens.
        journal:snapshot.journal.slice(-20),changeApplied:false,connectedToEncoder:false});
    });
    socket.on('radio:studio:private-mix',async ({after}={},callback)=>{
      if(typeof callback!=='function')return;
      if(socket.id!==presenter||uplinkOwner!==socket.id||gateway?.running!==true)
        return callback({ok:false,reason:'PRESENTER_SESSION_REQUIRED'});
      if(after!==null&&(!Number.isSafeInteger(after)||after<0||after>999999999999))
        return callback({ok:false,reason:'INVALID_CURSOR'});
      try{
        const payload=await workerRequest('GET','/live-pcm/private-mix?after='+(after===null?-1:after));
        if(!payload?.ok||!Array.isArray(payload.frames)||payload.frames.length>8)
          throw new Error('INVALID_RESPONSE');
        callback({ok:true,frames:payload.frames,nextSequence:payload.nextSequence,
          connectedToEncoder:false,changeApplied:false});
      }catch{return callback({ok:false,reason:'MIX_UNAVAILABLE'});}
    });
    socket.on('radio:studio:private-live',async ({after}={},callback)=>{
      if(typeof callback!=='function')return;
      if(socket.id!==presenter||uplinkOwner!==socket.id||gateway?.running!==true)
        return callback({ok:false,reason:'PRESENTER_SESSION_REQUIRED'});
      if(after!==null&&(!Number.isSafeInteger(after)||after<0||after>999999999999))
        return callback({ok:false,reason:'INVALID_CURSOR'});
      try{
        const cursor=after===null?-1:after;
        const payload=await workerRequest('GET','/live-pcm/private-live?after='+cursor);
        if(!payload?.ok||!Array.isArray(payload.frames)||payload.frames.length>8)
          throw new Error('INVALID_RESPONSE');
        callback({ok:true,frames:payload.frames,nextSequence:payload.nextSequence,
          connectedToEncoder:false,changeApplied:false});
      }catch{return callback({ok:false,reason:'MONITOR_UNAVAILABLE'});}
    });
    socket.on('radio:studio:private-preview',async callback=>{
      if(typeof callback!=='function')return;
      if(socket.id!==presenter||uplinkOwner!==socket.id||gateway?.running!==true)
        return callback({ok:false,reason:'PRESENTER_SESSION_REQUIRED'});
      try{
        const preview=await workerRequest('GET','/live-pcm/private-preview');
        if(typeof preview?.wavBase64!=='string'||preview.wavBase64.length>270000)
          throw new Error('PREVIEW_INVALID');
        callback({ok:true,wavBase64:preview.wavBase64,durationMs:preview.durationMs,
          connectedToEncoder:false,changeApplied:false});
      }catch{return callback({ok:false,reason:'PREVIEW_UNAVAILABLE'});}
    });
    socket.on('radio:studio:uplink:status',callback=>{
      callback?.({enabled:browserUplinkEnabled,connectedToEncoder:false,
        mode:gatewayEnabled?'ISOLATED_PCM_INTAKE':'VALIDATION_ONLY',
        ...uplink.snapshot(),gateway:gateway?.snapshot()||null});
    });

    socket.on('radio:studio:present', callback => {
      if (presenter && presenter !== socket.id) return callback?.({ error: 'Другой ведущий уже в эфире' });
      presenter = socket.id;
      callback?.({ ok: true });
      setImmediate(broadcast);
    });
    socket.on('radio:studio:listen', callback => {
      if (!presenter) return callback?.({ error: 'Прямой эфир не запущен' });
      if (listener && listener !== socket.id) return callback?.({ error: 'Приёмник уже подключён' });
      listener = socket.id; deviceListener = null;
      io.to(presenter).emit('radio:studio:listener', { id: listener });
      broadcast();
      callback?.({ ok: true });
    });
    socket.on('radio:studio:signal', ({ target, payload } = {}, callback) => {
      const valid = (socket.id === presenter && target === listener) ||
        (socket.id === listener && target === presenter);
      if (!valid || !payload || !['offer', 'answer', 'candidate'].includes(payload.type) ||
          JSON.stringify(payload).length > 30000) return callback?.({ error: 'Недопустимый сигнал' });
      signalTo(target, 'radio:studio:signal', { from: socket.id, payload });
      callback?.({ ok: true });
    });
    const leave = () => {
      handoverDryRun.release({owner:socket.id,reason:'OPERATOR_DISCONNECTED'});
      const wasPresenter = presenter === socket.id;
      if (wasPresenter) { if(uplinkOwner===socket.id){closeGateway();uplink.reset();uplinkOwner=null;} presenter = null; if (listener) signalTo(listener, 'radio:studio:ended'); listener = null; deviceListener = null; }
      else if (listener === socket.id) { listener = null; deviceListener = null; if (presenter) io.to(presenter).emit('radio:studio:listener-left'); }
      broadcast();
    };
    socket.on('radio:studio:leave', leave);
    socket.on('disconnect', leave);
  });
}
