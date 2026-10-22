// Deterministic nested folders, resilient to broken parent references and cycles.
export function radioFolderTree(folders=[]){
 const index=new Map(folders.map(f=>[f.id,f]));
 const children=new Map();
 for(const folder of folders){
  let parent=folder.parentId||null;
  if(parent===folder.id||!index.has(parent))parent=null;
  if(parent){const visited=new Set([folder.id]);let cursor=parent;
   while(cursor&&index.has(cursor)){if(visited.has(cursor)){parent=null;break;}visited.add(cursor);cursor=index.get(cursor).parentId;}
  }
  const siblings=children.get(parent)||[];siblings.push(folder);children.set(parent,siblings);
 }
 for(const siblings of children.values())siblings.sort((a,b)=>a.name.localeCompare(b.name,'ru'));
 const result=[];
 const walk=(parent,depth)=>{for(const folder of children.get(parent)||[]){result.push({...folder,depth,hasChildren:Boolean(children.get(folder.id)?.length)});walk(folder.id,depth+1);}};
 walk(null,0);
 return result;
}
export function radioFolderPath(folders,id){
 const byId=new Map(folders.map(f=>[f.id,f])),result=[],seen=new Set();
 let current=id;
 while(current&&byId.has(current)&&!seen.has(current)){seen.add(current);const f=byId.get(current);result.unshift(f);current=f.parentId;}
 return result;
}
