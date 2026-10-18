import { prisma } from './lib/prisma.js';
import { createHash } from 'node:crypto';
import { BrowserOpusUplink } from './lib/radioBrowserOpusUplink.js';
import { RadioLiveOpusGateway, workerRequest } from './lib/radioLiveOpusGateway.js';
import { evaluateRadioPresenterReadiness } from './lib/radioPresenterReadiness.js';

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
  const closeGateway=()=>{const current=gateway;gateway=null;void current?.stop();};
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
    socket.on('radio:studio:uplink:start', async callback=>{
      if(!browserUplinkEnabled)return callback?.({ok:false,error:'Тестовый шлюз отключён'});
      if(socket.id!==presenter)return callback?.({ok:false,error:'Только текущий ведущий'});
      if(uplinkOwner)return callback?.({ok:false,error:'Другой вход занят'});
      uplinkOwner=socket.id;
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
      const readiness=evaluateRadioPresenterReadiness({
        workerStatus,presenterAuthorized:connected,presenterConnected:connected,
        gatewayRunning:activeGateway,
        // Fail closed: actual schedule arbitration is not wired to this diagnostic yet.
        scheduledActive:true,scheduledSourceReady:false,
      });
      callback({ok:true,observedAt:Date.now(),pilotEnabled:gatewayEnabled,
        workerReachable,transportConnected:connected,decoderRunning:activeGateway,
        ...readiness,blockers:[...new Set([...readiness.blockers,
          'SCHEDULE_AUTHORITY_UNAVAILABLE',
          ...(!workerReachable?['WORKER_UNAVAILABLE']:[])])],
        changeApplied:false,liveOutputConnected:false});
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
      const wasPresenter = presenter === socket.id;
      if (wasPresenter) { if(uplinkOwner===socket.id){closeGateway();uplink.reset();uplinkOwner=null;} presenter = null; if (listener) signalTo(listener, 'radio:studio:ended'); listener = null; deviceListener = null; }
      else if (listener === socket.id) { listener = null; deviceListener = null; if (presenter) io.to(presenter).emit('radio:studio:listener-left'); }
      broadcast();
    };
    socket.on('radio:studio:leave', leave);
    socket.on('disconnect', leave);
  });
}
