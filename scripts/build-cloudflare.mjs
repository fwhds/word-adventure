import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const project=fileURLToPath(new URL('../',import.meta.url));
const dist=path.join(project,'dist'),out=path.join(project,'.cloudflare'),assets=path.join(out,'assets');
// Delete only the generated assets directory after checking its resolved boundary.
if(path.resolve(assets)!==path.join(path.resolve(project),'.cloudflare','assets'))throw Error('Invalid output path');
await fs.rm(assets,{recursive:true,force:true});
await fs.mkdir(assets,{recursive:true});
const context=vm.createContext({});
for(const file of ['vocab.js','photos.js','audio.js','synth-audio.js','neural-audio.js']){
 try{vm.runInContext(await fs.readFile(path.join(dist,file),'utf8'),context);}catch(e){if(e.code!=='ENOENT')throw e;}
}
const data=vm.runInContext('({words:WORDS,photos:WORD_PHOTOS,human:WORD_AUDIO,synth:WORD_SYNTH_AUDIO,neural:typeof WORD_NEURAL_AUDIO!=="undefined"?WORD_NEURAL_AUDIO:{}})',context);
await fs.writeFile(path.join(out,'word-ids.mjs'),'export const WORD_IDS = '+JSON.stringify(data.words.map(w=>w.id))+';\n');
const files=new Set(['index.html','style.css','vocab.js','photos.js','synth-audio.js','app.js','accounts.js','_headers']);
for(const p of Object.values(data.photos))files.add(p.src);
for(const p of Object.values(data.synth))files.add(p.src);
// License/credits pages are bundled; rejected candidates, QA sheets and metadata are excluded.
for(const file of ['PHOTO_CREDITS.md','AUDIO_CREDITS.md'])await fs.copyFile(path.join(project,file),path.join(assets,file));
let bytes=0;
for(const file of files){
 const source=path.resolve(dist,file),target=path.resolve(assets,file);
 if(!source.startsWith(dist+path.sep)||!target.startsWith(assets+path.sep))throw Error('Invalid asset path: '+file);
 const stat=await fs.stat(source);if(stat.size>25*1024*1024)throw Error('Asset exceeds Cloudflare limit: '+file);
 await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(source,target);bytes+=stat.size;
}
if(files.size+2>20000)throw Error('Too many static assets');
console.log(`Cloudflare build: ${data.words.length} words, ${Object.keys(data.photos).length} photographs, ${Object.keys(data.synth).length} unified Zira recordings; ${files.size+2} files / ${(bytes/1024/1024).toFixed(1)} MiB.`);
