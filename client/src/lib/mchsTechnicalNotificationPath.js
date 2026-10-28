/** Only technical MCHS notifications may deep-link to the administrative diagnostic journal. */
export function mchsTechnicalNotificationPath(notification) {
  if (notification?.type !== 'system') return null;
  const payload=notification.payload;
  if (!payload || payload.diagnosticOnly !== true || payload.officialAlert !== false) return null;
  if (!payload.incidentId && payload.diagnosticProbe !== true) return null;
  const path=payload.url;
  if (typeof path !== 'string') return null;
  const match=/^\/app\/admin\?tab=safety-mchs(?:&incident=([a-zA-Z0-9_-]{1,128}))?$/.exec(path);
  if (!match) return null;
  if (payload.incidentId && match[1] !== payload.incidentId) return null;
  return path;
}
