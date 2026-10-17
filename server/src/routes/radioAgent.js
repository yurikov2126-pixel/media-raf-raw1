import { Router } from 'express';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { prisma } from '../lib/prisma.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = Router();
const assetsRoot = path.resolve(process.env.RADIO_ASSET_DIR || 'private/radio-audio');
const digest = value => createHash('sha256').update(value).digest('hex');
const admin = [auth, requireRole('ADMIN')];
const safe = fn => (req,res,next) => Promise.resolve(fn(req,res)).catch(next);

async function deviceAuth(req,res,next) {
  try {
    const token = /^Bearer (\S+)$/.exec(req.headers.authorization || '')?.[1];
    if (!token || !/^rr_[a-f0-9]{64}$/.test(token)) return res.status(401).json({ error: 'Токен устройства отсутствует' });
    const device = await prisma.radioDevice.findUnique({ where: { tokenHash: digest(token) } });
    if (!device || device.revokedAt) return res.status(401).json({ error: 'Устройство отключено' });
    req.radioDevice = device;
    return next();
  } catch(e) { next(e); }
}

router.post('/devices', ...admin, safe(async(req,res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name || name.length > 100) return res.status(400).json({ error:'Укажите название радиокомпьютера' });
  const token = 'rr_' + randomBytes(32).toString('hex');
  const device = await prisma.radioDevice.create({ data: { name, tokenHash: digest(token) } });
  res.status(201).json({ device: { id: device.id, name: device.name }, token });
}));
router.get('/devices', ...admin, safe(async(_req,res) => {
  const devices = await prisma.radioDevice.findMany({ orderBy: { createdAt:'desc' }, select: {
    id:true, name:true, createdAt:true, lastSeenAt:true, revokedAt:true,
  } });
  res.json({ devices });
}));
router.post('/devices/:id/revoke', ...admin, safe(async(req,res) => {
  const changed = await prisma.radioDevice.updateMany({ where: { id: req.params.id, revokedAt:null },
    data:{ revokedAt:new Date() } });
  if (!changed.count) return res.status(404).json({error:'Устройство не найдено или уже отключено'});
  res.json({ok:true});
}));
router.get('/agent/status', deviceAuth, safe(async(req,res) => {
  await prisma.radioDevice.update({ where: { id:req.radioDevice.id }, data:{lastSeenAt:new Date()} });
  res.json({ deviceId:req.radioDevice.id, mode:'SYNC_ONLY', timezone:'Europe/Moscow', serverTime:new Date().toISOString(),
    playbackEnabled:false, amplifierControlEnabled:false });
}));
router.get('/agent/snapshot', deviceAuth, safe(async(req,res) => {
  const from=new Date(Date.now()-3600000), to=new Date(Date.now()+14*86400000);
  const slots=await prisma.radioScheduleSlot.findMany({ where:{ startAt:{lt:to}, endAt:{gt:from},playlist:{status:'APPROVED'} },
    include:{playlist:{include:{items:{orderBy:{position:'asc'},include:{asset:true}}}}},
    orderBy:{startAt:'asc'},take:500 });
  const entries=slots.map(slot=>({ id:slot.id,startAt:slot.startAt.toISOString(),endAt:slot.endAt.toISOString(),
    playlistId:slot.playlistId,playlistName:slot.playlist.name,
    tracks:slot.playlist.items.map(({asset})=>({id:asset.id,name:asset.name,sha256:asset.sha256,
      byteSize:asset.byteSize,durationMs:asset.durationMs,url:'/api/radio-agent/agent/assets/'+asset.id})) }));
  const json=JSON.stringify(entries);
  const revision=digest(json);
  res.setHeader('Cache-Control','no-store');
  res.json({ revision, generatedAt:new Date().toISOString(),timezone:'Europe/Moscow',mode:'SYNC_ONLY',
    playbackEnabled:false, slots:entries });
}));
router.get('/agent/assets/:id', deviceAuth, safe(async(req,res) => {
  // Allow only files currently referenced in the approved schedule.
  const start=new Date(Date.now()-3600000),end=new Date(Date.now()+14*86400000);
  const use=await prisma.radioPlaylistItem.findFirst({ where:{assetId:req.params.id,
    playlist:{status:'APPROVED',slots:{some:{startAt:{lt:end},endAt:{gt:start}}}}} });
  if(!use) return res.status(404).json({error:'Запись не включена в актуальную эфирную сетку'});
  const asset=await prisma.radioAsset.findUnique({where:{id:req.params.id}});
  if(!asset) return res.status(404).json({error:'Запись не найдена'});
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Type','application/octet-stream');
  res.sendFile(path.join(assetsRoot,path.basename(asset.storageKey)));
}));
export default router;
