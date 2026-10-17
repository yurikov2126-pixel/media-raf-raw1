import { prisma } from './lib/prisma.js';
import { createHash } from 'node:crypto';

// Only signaling passes via Socket.IO; audio flows peer-to-peer over WebRTC.
// Pilot supports one presenter and one listening browser at a time.
export function initRadioStudio(io) {
  let presenter = null;
  let listener = null;
  let deviceListener = null;
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
    socket.on('radio:studio:present', callback => {
      if (presenter && presenter !== socket.id) return callback?.({ error: 'Другой ведущий уже в эфире' });
      presenter = socket.id;
      broadcast();
      callback?.({ ok: true });
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
      if (wasPresenter) { presenter = null; if (listener) signalTo(listener, 'radio:studio:ended'); listener = null; deviceListener = null; }
      else if (listener === socket.id) { listener = null; deviceListener = null; if (presenter) io.to(presenter).emit('radio:studio:listener-left'); }
      broadcast();
    };
    socket.on('radio:studio:leave', leave);
    socket.on('disconnect', leave);
  });
}
