const DB = 'mrr-wiki-offline-v1';
function database() {
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open(DB,1);
  request.onupgradeneeded=()=>request.result.createObjectStore('articles');
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
 });
}
async function operate(key,mode,value) {
 const db=await database();
 try {return await new Promise((resolve,reject)=>{
  const tx=db.transaction('articles',mode);
  const req=value===undefined?tx.objectStore('articles').get(key):tx.objectStore('articles').put(value,key);
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error);
 });} finally {db.close();}
}
export const readOfflineWiki=(userId,slug)=>operate(userId+':'+slug,'readonly');
export async function saveOfflineWiki(userId,article) {
 await operate(userId+':'+article.slug,'readwrite',{...article,offlineSavedAt:Date.now()});
 if('caches' in window){
  const cache=await caches.open('wiki-explicit-assets-v1');
  const images=[article.cover,...[...article.content.matchAll(/!\[[^\]]*\]\((\/uploads\/wiki-assets\/[^)]+)\)/g)].map(x=>x[1])].filter(Boolean);
  for(const url of new Set(images)){try{const response=await fetch(url);if(response.ok)await cache.put(url,response)}catch{}}
 }
}
export async function removeOfflineWiki(userId,slug){
 const db=await database();
 try {await new Promise((resolve,reject)=>{const tx=db.transaction('articles','readwrite');tx.objectStore('articles').delete(userId+':'+slug);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}finally{db.close()}
}
