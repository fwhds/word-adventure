import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

// Original pictures and provenance are retained. Cards use uncropped WebP copies.
const require=createRequire(import.meta.url);
const sharp=require(process.env.WORD_SHARP_MODULE||'sharp');
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const file=path.join(root,'photos.js'),context=vm.createContext({});
vm.runInContext(await fs.readFile(file,'utf8'),context);
const photos=vm.runInContext('WORD_PHOTOS',context);
await fs.mkdir(path.join(root,'assets/cards'),{recursive:true});
let sourceBytes=0,cardBytes=0;
for(const [id,p]of Object.entries(photos)){
 const source=await fs.readFile(path.join(root,p.src));sourceBytes+=source.length;
 const card=await sharp(source).rotate().resize({width:480,height:480,fit:'inside',withoutEnlargement:true}).webp({quality:82,effort:5}).toBuffer();
 const hash=createHash('sha256').update(card).digest('hex').slice(0,16);
 p.thumbnail=`assets/cards/${id}.${hash}.webp`;
 await fs.writeFile(path.join(root,p.thumbnail),card);cardBytes+=card.length;
}
await fs.writeFile(file,'const WORD_PHOTOS = '+JSON.stringify(photos,null,2)+';\n');
console.log(JSON.stringify({images:Object.keys(photos).length,sourceBytes,cardBytes,reduction:((1-cardBytes/sourceBytes)*100).toFixed(1)+'%'}));
