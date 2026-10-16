const CACHE = 'mrr-wiki-favorites-v1';
const key = (slug) => '/__offline-wiki__/' + encodeURIComponent(slug);
export async function saveWikiOffline(article) {
 if (!('caches' in window)) throw new Error('Офлайн-хранилище недоступно на этом устройстве');
 const cache = await caches.open(CACHE);
 const images = [article.cover,...[...(article.content || '').matchAll(/!\[[^\]]*\]\((\/uploads\/wiki-assets\/[^)]+)\)/g)].map(x=>x[1])].filter(Boolean);
 await Promise.all(images.map(async path=>{
  try { const response=await fetch(path); if(response.ok) await cache.put(path,response); }catch{}
 }));
 await cache.put(key(article.slug),new Response(JSON.stringify({...article,savedOfflineAt:new Date().toISOString()}),{headers:{'Content-Type':'application/json'}}));
}
export async function getWikiOffline(slug) {
 if(!('caches' in window))return null;
 const cache=await caches.open(CACHE);
 const response=await cache.match(key(slug));
 return response?response.json():null;
}
export async function removeWikiOffline(slug) {
 if(!('caches' in window))return;
 const cache=await caches.open(CACHE);
 await cache.delete(key(slug));
}
