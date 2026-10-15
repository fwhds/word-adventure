import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

// Original pictures and provenance are retained. Generate uncropped WebP choices
// once at build-authoring time; ordinary Cloudflare builds only copy these files.
const require=createRequire(import.meta.url);
const sharp=require(process.env.WORD_SHARP_MODULE||'sharp');
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const file=path.join(root,'photos.js'),context=vm.createContext({});
vm.runInContext(await fs.readFile(file,'utf8'),context);
const photos=vm.runInContext('WORD_PHOTOS',context);
vm.runInContext(await fs.readFile(path.join(root,'vocab.js'),'utf8'),context);
const categories=new Map(vm.runInContext('WORDS.map(w=>[w.id,w.category])',context));
const qualities={body:82,animals:78,school:78,food:76,clothes:76,sports:76,weather:76};
const cards=path.join(root,'assets/cards');await fs.mkdir(cards,{recursive:true});
const oldPaths=new Set(Object.values(photos).flatMap(p=>[p.thumbnail,...(p.variants||[]).map(v=>v.src)]).filter(Boolean));
const active=new Set(),totals={320:0,480:0,640:0};let sourceBytes=0,previousBytes=0;
for(const [id,p]of Object.entries(photos)){
 const source=await fs.readFile(path.join(root,p.src));sourceBytes+=source.length;
 if(p.thumbnail)previousBytes+=(await fs.stat(path.join(root,p.thumbnail))).size;
 const quality=qualities[categories.get(id)]||76,choices=[];
 for(const edge of [320,480,640]){
  const {data,info}=await sharp(source).rotate().resize({width:edge,height:edge,fit:'inside',withoutEnlargement:true}).webp({quality,effort:6}).toBuffer({resolveWithObject:true});
  const hash=createHash('sha256').update(data).digest('hex').slice(0,16),src=`assets/cards/${id}.${hash}.webp`;
  await fs.writeFile(path.join(root,src),data);totals[edge]+=data.length;
  choices.push({src,w:info.width,h:info.height,bytes:data.length});
  if(edge===480)p.thumbnail=src;
 }
 // A small original may produce identical dimensions at several target sizes.
 // Also discard a smaller option when a larger one costs no more bytes.
 const unique=choices.filter((v,i,list)=>!list.some((other,j)=>j!==i&&other.w>=v.w&&other.h>=v.h&&other.bytes<=v.bytes&&(other.w>v.w||other.h>v.h||other.bytes<v.bytes||j<i)));
 p.variants=unique.sort((a,b)=>a.w-b.w).map(({src,w,h})=>({src,w,h}));
 p.imageQuality=quality;
 active.add(p.thumbnail);for(const v of p.variants)active.add(v.src);
 // Exact, validated generated paths only; never recurse or touch source images.
 for(const candidate of choices)if(!active.has(candidate.src))oldPaths.add(candidate.src);
}
for(const src of oldPaths){
 if(active.has(src))continue;
 const target=path.resolve(root,src);
 if(!/^assets\/cards\/[a-z0-9-]+\.[a-f0-9]{16}\.webp$/.test(src)||path.dirname(target)!==path.resolve(cards))throw Error('Unsafe generated asset path: '+src);
 await fs.unlink(target).catch(error=>{if(error.code!=='ENOENT')throw error;});
}
await fs.writeFile(file,'const WORD_PHOTOS = '+JSON.stringify(photos,null,2)+';\n');
console.log(JSON.stringify({images:Object.keys(photos).length,sourceBytes,previous480Bytes:previousBytes,bySize:totals,generatedFiles:active.size,qualities}));
