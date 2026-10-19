import { Router } from 'express';
import { validLanIpv4 } from '../lib/radioEsp32Address.js';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { prisma } from '../lib/prisma.js';
import { resolveRadioCursor } from '../lib/radioTimeline.js';
import { DEFAULT_AMP_PRE_SECONDS, DEFAULT_AMP_POST_SECONDS, ampSeconds, amplifierScheduleWindow } from '../lib/radioAmplifierWindow.js';
import { readAutoDjSettings, selectAutoDjAssets, autoDjCursor } from '../lib/radioAutoDj.js';
import { servePilotStream, stationStreamHealth, stationSnapshot } from '../lib/radioStreamPilot.js';
import { streamWorker, workerHealth } from '../lib/radioWorkerProxy.js';
import { workerRequest } from '../lib/radioLiveOpusGateway.js';
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

// ESP32 inventory is configuration only; never exposes a mains relay control.
const ESP32_REGISTRY_KEY='radio_esp32_registry_v1';
const ESP32_STATUS_KEY='radio_esp32_status_v1';
async function readEsp32Registry(){
  const row=await prisma.setting.findUnique({where:{key:ESP32_REGISTRY_KEY}});
  try{
    const value=JSON.parse(row?.value||'[]');
    return Array.isArray(value)?value.filter(d=>d&&typeof d.id==='string').slice(0,50):[];
  }catch{return [];}
}
async function readEsp32Status(){
  const row=await prisma.setting.findUnique({where:{key:ESP32_STATUS_KEY}});
  try{
    const value=JSON.parse(row?.value||'{}');
    return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  }catch{return {};}
}
router.get('/esp32',...admin,safe(async(_req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const [devices,status]=await Promise.all([readEsp32Registry(),readEsp32Status()]);
  const now=Date.now();
  res.json({devices:devices.map(d=>{
    const t=status[d.id];
    const fresh=!!t&&Number.isFinite(Date.parse(t.observedAt))&&now-Date.parse(t.observedAt)<12000&&now>=Date.parse(t.observedAt);
    return {...d,telemetry:fresh?{...t,online:t.heartbeatFresh===true}:null,
      connectivity:fresh&&t.heartbeatFresh===true?'ONLINE':'OFFLINE'};
  })});
}));
router.post('/agent/esp32-status',deviceAuth,safe(async(req,res)=>{
  const ip=req.body?.ip;
  const status=req.body?.status;
  if(!validLanIpv4(ip)||!status||typeof status!=='object'||Array.isArray(status))
    return res.status(400).json({error:'Некорректная телеметрия ESP32'});
  const devices=await readEsp32Registry();
  const device=devices.find(d=>d.ip===ip);
  if(!device)return res.status(404).json({error:'ESP32 не зарегистрирован'});
  if(status.device!=='MEDIA_RAF_RAW_ESP32'||!['SAFE_PILOT','POWER_CONTROL_V1'].includes(status.mode)||
    typeof status.relayOutputEnabled!=='boolean'||
    status.relayGpio!==13||typeof status.heartbeatFresh!=='boolean'||
    !['CENTRAL','LOCAL_RESERVE','STOPPED','DISCONNECTED'].includes(status.agentMode))
    return res.status(400).json({error:'Ожидается безопасная телеметрия SAFE_PILOT'});
  const last=await readEsp32Status();
  last[device.id]={observedAt:new Date().toISOString(),agentMode:status.agentMode,
    heartbeatFresh:status.heartbeatFresh,heartbeatCount:Number(status.heartbeatCount)||0,
    leaseValid:status.leaseValid===true,relayOutputEnabled:status.relayOutputEnabled===true,
    amplifierPower:status.amplifierPower||'UNKNOWN',
    reporterId:req.radioDevice.id};
  await prisma.setting.upsert({where:{key:ESP32_STATUS_KEY},
    create:{key:ESP32_STATUS_KEY,value:JSON.stringify(last)},
    update:{value:JSON.stringify(last)}});
  res.json({ok:true});
}));
// Logical amplifier control plane; SAFE_PILOT does not actuate mains GPIO.
const AMP_KEY='radio_amplifier_policy_v1';
async function ampState(){
  const row=await prisma.setting.findUnique({where:{key:AMP_KEY}});
  try{
    const v=JSON.parse(row?.value||'{}');
    return {mode:v.mode==='MANUAL'?'MANUAL':'AUTO',manualOn:v.manualOn===true,
      emergencyOff:v.emergencyOff===true,preSeconds:ampSeconds(v.preSeconds,DEFAULT_AMP_PRE_SECONDS),
      postSeconds:ampSeconds(v.postSeconds,DEFAULT_AMP_POST_SECONDS),updatedAt:v.updatedAt||null};
  }catch{return {mode:'AUTO',manualOn:false,emergencyOff:false,preSeconds:DEFAULT_AMP_PRE_SECONDS,
      postSeconds:DEFAULT_AMP_POST_SECONDS,updatedAt:null};}
}
async function ampDecision(){
  const policy=await ampState();
  const now=Date.now();
  // Query a superset of the configurable window; then apply one consistent
  // [start - pre, end + post) predicate to avoid ON→OFF→ON at slot start.
  const [esp32,devices,autoDj,slots]=await Promise.all([
    readEsp32Status(),readEsp32Registry(),readAutoDjSettings(),
    prisma.radioScheduleSlot.findMany({where:{
      endAt:{gt:new Date(now-policy.postSeconds*1000)},
      startAt:{lte:new Date(now+policy.preSeconds*1000)},
      playlist:{status:'APPROVED'}},
      orderBy:{startAt:'asc'},select:{id:true,startAt:true,endAt:true},take:20})
  ]);
  const nextSlot=amplifierScheduleWindow(slots,now,policy.preSeconds,policy.postSeconds);
  const device=devices[0]||null,telemetry=device?esp32[device.id]:null;
  const fresh=telemetry&&Date.now()-Date.parse(telemetry.observedAt)<12000&&Date.now()>=Date.parse(telemetry.observedAt);
  const connected=!!fresh&&telemetry.heartbeatFresh===true;
  const requested=policy.emergencyOff?false:policy.mode==='MANUAL'?policy.manualOn:Boolean(nextSlot||autoDj.enabled);
  return {policy,requested,reason:policy.emergencyOff?'Аварийное отключение':policy.mode==='MANUAL'?'Ручной режим':nextSlot?'Окно расписания (подготовка / эфир / задержка отключения)':autoDj.enabled?'Auto-DJ включён':'Нет активной трансляции',
    connection:connected?'ONLINE':'OFFLINE',agentMode:fresh?telemetry.agentMode:null,
    leaseValid:connected&&telemetry.leaseValid===true,physicalRelay:fresh?telemetry.amplifierPower||'UNKNOWN':'UNKNOWN',gpio:13,
    nextSlotStart:nextSlot?.startAt||null,hardwareReady:connected&&telemetry.relayOutputEnabled===true};
}
router.get('/agent/amplifier-intent',deviceAuth,safe(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const result=await ampDecision();
  const devices=await readEsp32Registry();
  // Agent must be expressly allowed to play; this endpoint does not issue
  // user-facing manual control tokens or expose any ESP32 pair secrets.
  const permit=!!req.radioDevice.playbackAllowed&&!!result.requested&&
    !result.policy.emergencyOff&&devices.length===1;
  res.json({permit,leaseMs:permit?8000:0,esp32Ip:devices.length===1?devices[0].ip:null,
    reason:result.reason,hardwareExpected:'POWER_CONTROL_V1',
    evaluatedAt:new Date().toISOString()});
}));
router.get('/amplifier',...admin,safe(async(_req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.json(await ampDecision());
}));
router.post('/amplifier/policy',...admin,safe(async(req,res)=>{
  const {mode,manualOn,emergencyOff,preSeconds,postSeconds}=req.body||{};
  if(!['AUTO','MANUAL'].includes(mode)||typeof manualOn!=='boolean'||typeof emergencyOff!=='boolean'||
    !Number.isInteger(preSeconds)||preSeconds<0||preSeconds>600||
    !Number.isInteger(postSeconds)||postSeconds<0||postSeconds>600)
    return res.status(400).json({error:'Некорректные параметры усилителя'});
  const policy={mode,manualOn,emergencyOff,preSeconds,postSeconds,updatedAt:new Date().toISOString()};
  await prisma.setting.upsert({where:{key:AMP_KEY},create:{key:AMP_KEY,value:JSON.stringify(policy)},update:{value:JSON.stringify(policy)}});
  await prisma.adminAction.create({data:{adminId:req.user.id,action:'RADIO_AMPLIFIER_POLICY',payload:JSON.stringify(policy)}});
  res.json(await ampDecision());
}));
router.post('/esp32',...admin,safe(async(req,res)=>{
  const name=typeof req.body?.name==='string'?req.body.name.trim():'';
  const ip=typeof req.body?.ip==='string'?req.body.ip.trim():'';
  const gpio=req.body?.gpio;
  if(!name||name.length>80||!validLanIpv4(ip)||gpio!==13)
    return res.status(400).json({error:'Укажите имя, локальный IPv4 и GPIO 13'});
  const devices=await readEsp32Registry();
  if(devices.length>=50)return res.status(409).json({error:'Достигнут лимит устройств'});
  if(devices.some(d=>d.ip===ip))return res.status(409).json({error:'Этот IP уже зарегистрирован'});
  const device={id:randomBytes(12).toString('hex'),name,ip,gpio:13,
    firmware:'SAFE_PILOT',controlEnabled:false,createdAt:new Date().toISOString()};
  devices.push(device);
  await prisma.setting.upsert({where:{key:ESP32_REGISTRY_KEY},
    create:{key:ESP32_REGISTRY_KEY,value:JSON.stringify(devices)},
    update:{value:JSON.stringify(devices)}});
  res.status(201).json({device});
}));
router.delete('/esp32/:id',...admin,safe(async(req,res)=>{
  const devices=await readEsp32Registry();
  const updated=devices.filter(d=>d.id!==req.params.id);
  if(updated.length===devices.length)return res.status(404).json({error:'ESP32 не найден'});
  await prisma.setting.upsert({where:{key:ESP32_REGISTRY_KEY},
    create:{key:ESP32_REGISTRY_KEY,value:JSON.stringify(updated)},
    update:{value:JSON.stringify(updated)}});
  res.json({ok:true});
}));
router.post('/devices', ...admin, safe(async(req,res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name || name.length > 100) return res.status(400).json({ error:'Укажите название радиокомпьютера' });
  const token = 'rr_' + randomBytes(32).toString('hex');
  const device = await prisma.radioDevice.create({ data: { name, tokenHash: digest(token) } });
  res.status(201).json({ device: { id: device.id, name: device.name }, token });
}));
router.get('/devices', ...admin, safe(async(_req,res) => {
  const devices = await prisma.radioDevice.findMany({ orderBy: { createdAt:'desc' }, select: {
    id:true, name:true, createdAt:true, lastSeenAt:true, revokedAt:true, playbackAllowed:true,
  } });
  res.json({ devices });
}));
router.post('/devices/:id/revoke', ...admin, safe(async(req,res) => {
  const changed = await prisma.radioDevice.updateMany({ where: { id: req.params.id, revokedAt:null },
    data:{ revokedAt:new Date() } });
  if (!changed.count) return res.status(404).json({error:'Устройство не найдено или уже отключено'});
  res.json({ok:true});
}));
router.post('/devices/:id/playback', ...admin, safe(async(req,res) => {
  if (typeof req.body?.enabled !== 'boolean') return res.status(400).json({error:'Передайте enabled: true или false'});
  const changed=await prisma.radioDevice.updateMany({where:{id:req.params.id,revokedAt:null},
    data:{playbackAllowed:req.body.enabled}});
  if(!changed.count) return res.status(404).json({error:'Устройство не найдено или отключено'});
  res.json({ok:true,playbackAllowed:req.body.enabled});
}));
router.get('/agent/status', deviceAuth, safe(async(req,res) => {
  await prisma.radioDevice.update({ where: { id:req.radioDevice.id }, data:{lastSeenAt:new Date()} });
  res.json({ deviceId:req.radioDevice.id, mode:req.radioDevice.playbackAllowed ? 'PILOT' : 'SYNC_ONLY', timezone:'Europe/Moscow', serverTime:new Date().toISOString(),
    playbackEnabled:!!req.radioDevice.playbackAllowed, amplifierControlEnabled:false });
}));
// Single station-wide playback position for future server stream and local failover.
router.get('/agent/stream', deviceAuth, (req,res) => {
  if(!req.radioDevice.playbackAllowed) return res.status(403).json({error:'Воспроизведение запрещено'});
  return streamWorker(req,res);
});
// Limited public metadata; never expose device tokens, Worker diagnostics or private files.
router.get('/listen/now-playing',safe(async(_req,res)=>{
  res.setHeader('Cache-Control','no-store');
  let worker;
  try{worker=await workerRequest('GET','/health');}
  catch{return res.status(503).json({available:false});}
  const trackId=typeof worker.trackId==='string'?worker.trackId:null;
  const asset=trackId?await prisma.radioAsset.findUnique({where:{id:trackId},select:{name:true,tags:true,durationMs:true}}):null;
  res.json({available:true,mode:worker.mode,
    track:asset?{name:asset.name,title:asset.tags?.title||null,artist:asset.tags?.artist||null,durationMs:asset.durationMs}:null,
    playout:worker.playout?.trackId===trackId?{startedAt:worker.playout.startedAt,
      emittedMs:worker.playout.emittedMs,seekMs:worker.playout.seekMs,durationMs:worker.playout.durationMs}:null,
    observedAt:Date.now()});
}));
// Browser <audio> does not send bearer headers; public station output is intentionally listen-only.
router.get('/listen', (req,res)=>streamWorker(req,res));
router.get('/dashboard/worker', ...admin, workerHealth);
router.get('/dashboard/now-playing',...admin,safe(async(_req,res)=>{
  res.setHeader('Cache-Control','no-store');
  let status;
  try{status=await workerRequest('GET','/health');}
  catch{return res.status(503).json({available:false,reason:'WORKER_UNAVAILABLE'});}
  const mode=typeof status?.mode==='string'?status.mode:'UNKNOWN';
  const trackId=typeof status?.trackId==='string'?status.trackId:null;
  const slotId=typeof status?.slotId==='string'?status.slotId:null;
  const nextTrackId=typeof status?.nextTrackId==='string'?status.nextTrackId:null;
  const [asset,slot,nextAsset,nextSlot]=await Promise.all([
    trackId?prisma.radioAsset.findUnique({where:{id:trackId},select:{id:true,name:true,durationMs:true,tags:true}}):null,
    slotId?prisma.radioScheduleSlot.findUnique({where:{id:slotId},select:{id:true,endAt:true,playlist:{select:{name:true,items:{orderBy:{position:'asc'},include:{asset:{select:{id:true,name:true,tags:true}}}}}}}}):null,
    nextTrackId?prisma.radioAsset.findUnique({where:{id:nextTrackId},select:{id:true,name:true,tags:true}}):null,
    prisma.radioScheduleSlot.findFirst({where:{startAt:{gt:new Date()},playlist:{status:'APPROVED'}},orderBy:{startAt:'asc'},select:{id:true,startAt:true,playlist:{select:{name:true,items:{orderBy:{position:'asc'},take:1,include:{asset:{select:{id:true,name:true,tags:true}}}}}}}}),
  ]);
  // Scheduled playlists advance by their saved order. They override Auto-DJ projections.
  let scheduledNext=null;
  if(mode==='SCHEDULED'&&slot?.playlist?.items?.length){
    const items=slot.playlist.items;
    const index=items.findIndex(i=>i.asset.id===trackId);
    const following=index>=0?items[index+1]?.asset:null;
    if(following)scheduledNext={id:following.id,name:following.name,
      title:following.tags?.title||null,artist:following.tags?.artist||null,estimated:true};
  }
  res.json({available:true,source:'PUBLIC_MP3_WORKER',mode,
    track:asset?{id:asset.id,name:asset.name,durationMs:asset.durationMs,
      title:asset.tags?.title||null,artist:asset.tags?.artist||null}:null,
    slot:slot?{id:slot.id,name:slot.playlist?.name||'Передача'}:null,
    trackId,slotId,trackResolved:!trackId||Boolean(asset),observedAt:new Date().toISOString(),
    playout:status.playout?.trackId===trackId?status.playout:null,
    nextTrack:scheduledNext||(mode==='AUTO_DJ'&&nextAsset?{id:nextAsset.id,name:nextAsset.name,title:nextAsset.tags?.title||null,artist:nextAsset.tags?.artist||null,estimated:true}:null),
    upcomingSlot:nextSlot?{id:nextSlot.id,name:nextSlot.playlist.name,startAt:nextSlot.startAt,
      firstTrack:nextSlot.playlist.items[0]?.asset?.name||null}:null,
    listenerCount:Number.isFinite(status?.connected)?status.connected:null,
    lastError:typeof status?.lastError==='string'?status.lastError:null});
}));

router.get('/agent/stream-pilot', deviceAuth, safe(async (req,res) => {
  if (!req.radioDevice.playbackAllowed) return res.status(403).json({error:'Тестовое воспроизведение запрещено'});
  await servePilotStream(req,res);
}));
router.get('/dashboard', ...admin, safe(async (_req,res) => {
  const {cursor}=await stationSnapshot();
  const devices=await prisma.radioDevice.findMany({
    where:{revokedAt:null}, select:{id:true,name:true,lastSeenAt:true,playbackAllowed:true},
    orderBy:{createdAt:'desc'},take:40,
  });
  const upcoming=await prisma.radioScheduleSlot.findMany({
    where:{startAt:{gt:new Date()},playlist:{status:'APPROVED'}},
    orderBy:{startAt:'asc'},take:6,include:{playlist:{select:{name:true}}},
  });
  res.setHeader('Cache-Control','no-store');
  const autoDj=await getAutoDj();
  const autoDjConfigured=await readAutoDjSettings();
  res.json({autoDj:{configured:autoDjConfigured.enabled,ready:autoDj.enabled,
    playlistId:autoDjConfigured.playlistId,trackCount:autoDj.tracks.length,
    reason:!autoDjConfigured.enabled?'DISABLED':autoDj.enabled?'READY':'PLAYLIST_UNAVAILABLE'},
    serverTime:new Date().toISOString(),timezone:'Europe/Moscow',
    stream:stationStreamHealth(),cursor,devices,
    upcoming:upcoming.map(s=>({id:s.id,startAt:s.startAt,endAt:s.endAt,name:s.playlist.name})),
    amplifier:{connected:false},liveStudio:{integration:'SEPARATE_WEBRTC_PILOT'}});
}));
async function getAutoDj() {
  const config=await readAutoDjSettings();
  if(!config.enabled||!config.playlistId)return {enabled:false,playlistId:null,tracks:[]};
  const playlist=await prisma.radioPlaylist.findUnique({where:{id:config.playlistId},include:{items:{orderBy:{position:'asc'},include:{asset:true}}}});
  const tracks=selectAutoDjAssets(playlist);
  return {enabled:tracks.length>0,playlistId:config.playlistId,tracks};
}
const autoDjTrack = asset => ({id:asset.id,name:asset.name,sha256:asset.sha256,
  byteSize:asset.byteSize,durationMs:asset.durationMs,url:'/api/radio-agent/agent/assets/'+asset.id});
router.get('/agent/now-playing', deviceAuth, safe(async(req,res) => {
  const now = new Date();
  const slots = await prisma.radioScheduleSlot.findMany({
    where: { startAt: { lte: now }, endAt: { gt: now }, playlist: { status: 'APPROVED' } },
    include: { playlist: { include: { items: {
      orderBy: { position: 'asc' }, include: { asset: {
        select: { id: true, name: true, durationMs: true },
      } },
    } } } },
    orderBy: { startAt: 'asc' }, take: 2,
  });
  res.setHeader('Cache-Control', 'no-store');
  const cursor=resolveRadioCursor(slots,now.getTime());
  const dj=cursor.status==='IDLE' && !cursor.slot ? await getAutoDj():null;
  const active=dj?.enabled?autoDjCursor(dj.tracks,now.getTime()):null;
  res.json({ timezone:'Europe/Moscow',
    cursor:active?{status:'AUTO_DJ',at:now.toISOString(),slot:null,track:active}:cursor });
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
  const dj=await getAutoDj();
  const autoDj={enabled:dj.enabled,playlistId:dj.playlistId,
    tracks:dj.tracks.map(autoDjTrack)};
  const json=JSON.stringify({entries,autoDj});
  const revision=digest(json);
  res.setHeader('Cache-Control','no-store');
  res.json({ revision, generatedAt:new Date().toISOString(),timezone:'Europe/Moscow',mode:req.radioDevice.playbackAllowed ? 'PILOT' : 'SYNC_ONLY',
    playbackEnabled:!!req.radioDevice.playbackAllowed, slots:entries,autoDj });
}));
router.get('/agent/assets/:id', deviceAuth, safe(async(req,res) => {
  // Allow only files currently referenced in the approved schedule.
  const start=new Date(Date.now()-3600000),end=new Date(Date.now()+14*86400000);
  const use=await prisma.radioPlaylistItem.findFirst({ where:{assetId:req.params.id,
    playlist:{status:'APPROVED',slots:{some:{startAt:{lt:end},endAt:{gt:start}}}}} });
  if(!use) {
    const dj=await getAutoDj();
    if(!dj.enabled || !dj.tracks.some(asset=>asset.id===req.params.id))
      return res.status(404).json({error:'Запись не включена в разрешённую эфирную сетку'});
  }
  const asset=await prisma.radioAsset.findUnique({where:{id:req.params.id}});
  if(!asset) return res.status(404).json({error:'Запись не найдена'});
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Type','application/octet-stream');
  res.sendFile(path.join(assetsRoot,path.basename(asset.storageKey)));
}));
export default router;
