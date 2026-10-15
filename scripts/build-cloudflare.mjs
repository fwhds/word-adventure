import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';

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
// Only idempotent initial DDL is used by the Worker's missing-table fallback.
// Versioned deployment migrations remain the primary upgrade mechanism.
const initialSQL=await fs.readFile(path.join(project,'cloudflare','schema.sql'),'utf8');
const initialStatements=initialSQL.replace(/^\s*--[^\n]*$/gm,'').split(';').map(sql=>sql.trim()).filter(Boolean).filter(sql=>!/^PRAGMA foreign_keys=ON$/i.test(sql));
if(!initialStatements.length||initialStatements.some(sql=>!/^CREATE (TABLE|INDEX) IF NOT EXISTS\b/i.test(sql)))throw Error('Runtime initialization must contain only idempotent initial DDL');
await fs.writeFile(path.join(out,'initial-schema.mjs'),'export const INITIAL_SCHEMA = '+JSON.stringify(initialStatements)+';\n');
const scripts=[
 "'use strict';",
 'const GROUPS = '+vm.runInContext('JSON.stringify(GROUPS)',context)+';\nconst WORDS = '+JSON.stringify(data.words)+';',
 'const WORD_PHOTOS = '+JSON.stringify(data.photos)+';',
 'const WORD_SYNTH_AUDIO = '+JSON.stringify(data.synth)+';',
 await fs.readFile(path.join(dist,'app.js'),'utf8'),
 await fs.readFile(path.join(dist,'accounts.js'),'utf8')
].join('\n;\n');
new vm.Script(scripts); // Catch accidental global declaration collisions before deployment.
const styles=await fs.readFile(path.join(dist,'style.css'),'utf8');
const hashed=(name,content,extension)=>`assets/runtime/${name}.${createHash('sha256').update(content).digest('hex').slice(0,16)}.${extension}`;
const scriptPath=hashed('app',scripts,'js'),stylePath=hashed('style',styles,'css');
let html=await fs.readFile(path.join(dist,'index.html'),'utf8');
html=html.replace('href="style.css"',`href="${stylePath}"`).replace(/<script(?: defer)? src="(?:vocab|photos|synth-audio|app|accounts)\.js"><\/script>/g,'');
html=html.replace('</body>',`<script defer src="${scriptPath}"></script>\n</body>`);
const generatedFiles=new Map([['index.html',html],[scriptPath,scripts],[stylePath,styles]]);
const files=new Set(['index.html',scriptPath,stylePath,'_headers']);
for(const p of Object.values(data.photos)){files.add(p.src);if(p.thumbnail)files.add(p.thumbnail);for(const v of p.variants||[])files.add(v.src);}
for(const p of Object.values(data.synth))files.add(p.src);
// License/credits pages are bundled; rejected candidates, QA sheets and metadata are excluded.
for(const file of ['PHOTO_CREDITS.md','AUDIO_CREDITS.md','AI_IMAGE_PROMPTS.md'])await fs.copyFile(path.join(project,file),path.join(assets,file));
let bytes=0;
for(const file of files){
 const source=path.resolve(dist,file),target=path.resolve(assets,file);
 if(!source.startsWith(dist+path.sep)||!target.startsWith(assets+path.sep))throw Error('Invalid asset path: '+file);
 const generated=generatedFiles.get(file),size=generated===undefined?(await fs.stat(source)).size:Buffer.byteLength(generated);
 if(size>25*1024*1024)throw Error('Asset exceeds Cloudflare limit: '+file);
 await fs.mkdir(path.dirname(target),{recursive:true});
 if(generated===undefined)await fs.copyFile(source,target);else await fs.writeFile(target,generated);
 bytes+=size;
}
if(files.size+3>20000)throw Error('Too many static assets');
const generated=Object.values(data.photos).filter(p=>p.kind==='generated').length;
console.log(`Cloudflare build: ${data.words.length} words, ${Object.keys(data.photos).length-generated} photo entries, ${generated} AI image entries, ${Object.keys(data.synth).length} unified Zira recordings; ${files.size+3} files / ${(bytes/1024/1024).toFixed(1)} MiB.`);
console.log(`Initial runtime: 1 deferred script (${(Buffer.byteLength(scripts)/1024).toFixed(1)} KiB raw, ${(gzipSync(scripts).length/1024).toFixed(1)} KiB gzip estimate), content-hashed CSS and card images.`);
