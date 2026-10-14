import {Router} from 'express';
import multer from 'multer';
import zlib from 'node:zlib';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {safe} from './_shared.js';
import {validateCurriculum,importCurriculum} from '../../lib/bulkActions.js';

const router=Router();
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:40*1024*1024,files:1}});
const DEST=path.resolve('uploads/course-assets');
const MAX_FILES=240,MAX_UNCOMPRESSED=120*1024*1024;
function unpackZip(buffer){
 const entries=new Map();
 let eocd=-1;
 for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--){
  if(buffer.readUInt32LE(i)===0x06054b50){eocd=i;break;}
 }
 if(eocd<0)throw new Error('Некорректный ZIP-архив');
 const count=buffer.readUInt16LE(eocd+10),offset=buffer.readUInt32LE(eocd+16);
 if(count>MAX_FILES)throw new Error('Слишком много файлов в архиве');
 let cursor=offset,total=0;
 for(let i=0;i<count;i++){
  if(cursor+46>buffer.length||buffer.readUInt32LE(cursor)!==0x02014b50)throw new Error('Повреждён каталог ZIP');
  const method=buffer.readUInt16LE(cursor+10),flags=buffer.readUInt16LE(cursor+8);
  const compressed=buffer.readUInt32LE(cursor+20),size=buffer.readUInt32LE(cursor+24);
  const nameLength=buffer.readUInt16LE(cursor+28),extra=buffer.readUInt16LE(cursor+30),comment=buffer.readUInt16LE(cursor+32);
  const local=buffer.readUInt32LE(cursor+42);
  const name=buffer.subarray(cursor+46,cursor+46+nameLength).toString('utf8');
  cursor+=46+nameLength+extra+comment;
  if(!name||name.endsWith('/'))continue;
  if(name.includes('\\')||name.startsWith('/')||name.split('/').some(x=>x==='..'||!x))throw new Error('Небезопасный путь в ZIP');
  if(flags&1||![0,8].includes(method))throw new Error('Неподдерживаемый метод ZIP');
  total+=size;if(total>MAX_UNCOMPRESSED)throw new Error('Слишком большой распакованный архив');
  if(local+30>buffer.length||buffer.readUInt32LE(local)!==0x04034b50)throw new Error('Повреждена запись ZIP');
  const start=local+30+buffer.readUInt16LE(local+26)+buffer.readUInt16LE(local+28);
  if(start+compressed>buffer.length)throw new Error('Обрезанный файл в ZIP');
  const raw=buffer.subarray(start,start+compressed);
  const data=method===8?zlib.inflateRawSync(raw,{maxOutputLength:MAX_UNCOMPRESSED}):raw;
  if(data.length!==size)throw new Error('Некорректный размер файла в ZIP');
  if(entries.has(name))throw new Error('Повтор имени в ZIP');
  entries.set(name,data);
 }
 return entries;
}
router.post('/bulk/import-course-zip',upload.single('archive'),safe(async(req,res)=>{
 if(!req.file)return res.status(400).json({error:'Выберите ZIP-архив'});
 const entries=unpackZip(req.file.buffer);
 const manifest=entries.get('course.json');
 if(!manifest)return res.status(400).json({error:'Нужен course.json в корне архива'});
 const courses=JSON.parse(manifest.toString('utf8'));
 const validation=validateCurriculum(courses);
 if(!validation.valid)return res.status(400).json({error:'Некорректный JSON курса',errors:validation.errors});
 const courseIds=courses.map(c=>c.slug);
 const assets=new Map();
 for(const [name,data] of entries){
  if(name==='course.json')continue;
  if(!/^assets\/[a-zA-Z0-9_.-]+\.(png|jpe?g|webp)$/i.test(name))return res.status(400).json({error:'Некорректный путь иллюстрации: '+name});
  if(data.length>8*1024*1024) return res.status(400).json({error:'Изображение больше 8 МБ: '+name});
  const png=data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpg=data[0]===255&&data[1]===216&&data[2]===255;
  const webp=data.subarray(0,4).toString()==='RIFF'&&data.subarray(8,12).toString()==='WEBP';
  if(!((name.endsWith('.png')&&png)||( /\.jpe?g$/i.test(name)&&jpg)||(/\.webp$/i.test(name)&&webp)))
   return res.status(400).json({error:'Неизвестный формат: '+name});
  assets.set(name,data);
 }
 const references=[];
 for(const course of courses)for(const lesson of course.lessons||[]){
  const matches=[...String(lesson.content||'').matchAll(/!\[([^\]\n]*)\]\((assets\/[a-zA-Z0-9_.-]+\.(?:png|jpg|jpeg|webp))\)/gi)];
  for(const match of matches){if(!assets.has(match[2]))return res.status(400).json({error:'В архиве отсутствует '+match[2]});references.push(match[2]);}
 }
 if(references.length===0)return res.status(400).json({error:'Не найдены изображения, связанные с уроками'});
 await fs.mkdir(DEST,{recursive:true});
 const saved=[];
 try {
  const urls=new Map();
  for(const [name,data] of assets){
   const extension=path.extname(name).toLowerCase(),filename=randomUUID()+extension;
   await fs.writeFile(path.join(DEST,filename),data,{flag:'wx'});
   saved.push(filename);
   urls.set(name,'/uploads/course-assets/'+filename);
  }
  for(const course of courses)for(const lesson of course.lessons||[]){
   lesson.content=lesson.content.replace(/!\[([^\]\n]*)\]\((assets\/[a-zA-Z0-9_.-]+\.(?:png|jpg|jpeg|webp))\)/gi,
    (_full,alt,name)=>'!['+alt+']('+urls.get(name)+')');
  }
  const result=await importCurriculum({adminId:req.user.id,data:courses,mode:'merge',preserveProgress:false});
  return res.json({ok:true,result,images:assets.size,references:references.length,courses:courseIds});
 }catch(err){await Promise.all(saved.map(filename=>fs.unlink(path.join(DEST,filename)).catch(()=>{})));throw err;}
}));
export default router;
