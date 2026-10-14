import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const project=path.resolve(fileURLToPath(new URL('../',import.meta.url))),dist=path.join(project,'dist'),assets=path.join(dist,'assets');
const review=path.join(project,'.asset-review','unused-assets',new Date().toISOString().replace(/[:.]/g,'-'));
const context=vm.createContext({});
for(const file of ['photos.js','audio.js','synth-audio.js','neural-audio.js'])vm.runInContext(await fs.readFile(path.join(dist,file),'utf8'),context);
const maps=vm.runInContext('[WORD_PHOTOS,WORD_AUDIO,WORD_SYNTH_AUDIO,WORD_NEURAL_AUDIO]',context),used=new Set();
function collect(value){if(!value||typeof value!=='object')return;for(const [k,v]of Object.entries(value)){if((k==='src'||k==='slowSrc')&&typeof v==='string')used.add(path.resolve(dist,v));else collect(v);}}
for(const map of maps)collect(map);
let count=0;
async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){
 const source=path.resolve(dir,entry.name);
 if(!source.startsWith(assets+path.sep))throw Error('Invalid asset boundary');
 if(entry.isSymbolicLink())throw Error('Unexpected symbolic link in assets');
 if(entry.isDirectory()){if(!['qa','candidates'].includes(entry.name))await walk(source);continue;}
 if(!/\.(jpe?g|png|webp|mp3|wav|ogg)$/i.test(entry.name)||used.has(source))continue;
 const target=path.resolve(review,path.relative(assets,source));
 if(!target.startsWith(review+path.sep)||!review.startsWith(project+path.sep))throw Error('Invalid review boundary');
 await fs.mkdir(path.dirname(target),{recursive:true});await fs.rename(source,target);count++;
}}
await walk(assets);console.log(`Archived ${count} unused media files inside ignored .asset-review; referenced assets remain in dist.`);
