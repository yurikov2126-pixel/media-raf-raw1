import { prisma } from './lib/prisma.js';

// Only signaling passes via Socket.IO; audio flows peer-to-peer over WebRTC.
// Pilot supports one presenter and one listening browser at a time.
export function initRadioStudio(io) {
  let presenter = null;
  let listener = null;
  const state = () => ({ live: !!presenter, listener: !!listener });
  const broadcast = () => io.emit('radio:studio:state', state());

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
      listener = socket.id;
      io.to(presenter).emit('radio:studio:listener', { id: listener });
      broadcast();
      callback?.({ ok: true });
    });
    socket.on('radio:studio:signal', ({ target, payload } = {}, callback) => {
      const valid = (socket.id === presenter && target === listener) ||
        (socket.id === listener && target === presenter);
      if (!valid || !payload || !['offer', 'answer', 'candidate'].includes(payload.type) ||
          JSON.stringify(payload).length > 30000) return callback?.({ error: 'Недопустимый сигнал' });
      io.to(target).emit('radio:studio:signal', { from: socket.id, payload });
      callback?.({ ok: true });
    });
    const leave = () => {
      const wasPresenter = presenter === socket.id;
      if (wasPresenter) { presenter = null; if (listener) io.to(listener).emit('radio:studio:ended'); listener = null; }
      else if (listener === socket.id) { listener = null; if (presenter) io.to(presenter).emit('radio:studio:listener-left'); }
      broadcast();
    };
    socket.on('radio:studio:leave', leave);
    socket.on('disconnect', leave);
  });
}
