import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../dist/',import.meta.url),context=vm.createContext({});
for(const file of ['vocab.js','photos.js','audio.js','synth-audio.js','neural-audio.js']){const url=new URL(file,root);if(fs.existsSync(url))vm.runInContext(fs.readFileSync(url,'utf8'),context);}
const data=vm.runInContext('({words:WORDS,photos:WORD_PHOTOS,audio:WORD_AUDIO,synth:WORD_SYNTH_AUDIO,neural:typeof WORD_NEURAL_AUDIO!=="undefined"?WORD_NEURAL_AUDIO:{}})',context);
assert.equal(data.words.length,257);assert.ok(Object.keys(data.photos).length>=148);
assert.equal(Object.keys(data.synth).length,257);
for(const w of data.words){
 const speech=data.synth[w.id];assert.ok(speech,w.id+' needs unified audio');assert.equal(speech.voice,'Microsoft Zira Desktop');assert.equal(speech.accent,'us');
 const wav=fs.readFileSync(new URL(speech.src,root));assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.toString('ascii',8,12),'WAVE');assert.ok(wav.length>1000);
}
for(const [id,p]of Object.entries(data.photos)){assert.ok(data.words.some(w=>w.id===id));assert.ok(fs.statSync(new URL(p.src,root)).size>300);if(p.kind==='generated'){assert.equal(p.source,'imagegen');assert.match(p.credit,/AI-generated/);assert.equal(p.license,undefined,'generated assets cannot inherit photographic licenses');}else{assert.match(p.source,/^https:\/\/commons.wikimedia.org/);assert.ok(p.credit&&p.license);}if(p.crop){const c=p.crop;assert.ok([c.x,c.y,c.width,c.height,p.width,p.height].every(Number.isFinite),id);assert.ok(c.x>=0&&c.y>=0&&c.width>0&&c.height>0,id);assert.ok(c.x+c.width<=p.width&&c.y+c.height<=p.height,id+' crop must stay within original photo');}}
const body=data.words.filter(w=>w.category==='body');assert.equal(body.length,25);
const bodySources=new Set();
function webpDimensions(bytes){
 assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
 for(let offset=12;offset+8<=bytes.length;){const type=bytes.toString('ascii',offset,offset+4),length=bytes.readUInt32LE(offset+4),start=offset+8;assert.ok(start+length<=bytes.length);
  if(type==='VP8X')return [bytes.readUIntLE(start+4,3)+1,bytes.readUIntLE(start+7,3)+1];
  if(type==='VP8 '){assert.equal(bytes.subarray(start+3,start+6).toString('hex'),'9d012a');return [bytes.readUInt16LE(start+6)&0x3fff,bytes.readUInt16LE(start+8)&0x3fff];}
  if(type==='VP8L'){assert.equal(bytes[start],0x2f);const bits=bytes.readUInt32LE(start+1);return [(bits&0x3fff)+1,((bits>>>14)&0x3fff)+1];}
  offset=start+length+(length%2);
 }
 throw Error('Missing WebP dimension header');
}
for(const w of body){const p=data.photos[w.id];assert.equal(p.kind,'generated',w.id);assert.equal(p.crop,undefined,'use dedicated images instead of enlarging small crops');assert.equal(p.markers,undefined);assert.equal(p.caption,undefined,'body pictures cannot disclose answers');assert.equal(p.presentation,'unlabelled-closeup');const dimensions=webpDimensions(fs.readFileSync(new URL(p.src,root)));assert.deepEqual(dimensions,[p.width,p.height]);assert.ok(dimensions.every(n=>n>=1024),w.id+' must retain high source resolution');bodySources.add(p.src);}
assert.equal(bodySources.size,25,'each body word needs its own dedicated image');
let originalBytes=0,thumbnailBytes=0;
for(const p of Object.values(data.photos)){
 assert.match(p.thumbnail,/^assets\/cards\/[a-z0-9-]+\.[a-f0-9]{16}\.webp$/);
 const card=fs.readFileSync(new URL(p.thumbnail,root)),dims=webpDimensions(card);
 assert.ok(dims.every(n=>n>0&&n<=480),'card copies are bounded and never upscale originals');
 assert.notEqual(p.thumbnail,p.src);originalBytes+=fs.statSync(new URL(p.src,root)).size;thumbnailBytes+=card.length;
}
assert.ok(thumbnailBytes<originalBytes*.3,'card thumbnails must reduce total transfer bytes by at least 70%');
let recordings=0;
for(const [id,list]of Object.entries(data.audio))for(const p of Object.values(list)){assert.ok(data.words.some(w=>w.id===id));assert.ok(fs.statSync(new URL(p.src,root)).size>300);assert.ok(p.source&&p.credit&&p.license);recordings++;}
let neuralClips=0;
for(const [id,list]of Object.entries(data.neural))for(const [accent,p]of Object.entries(list)){
 assert.ok(data.words.some(w=>w.id===id));assert.ok(['uk','us'].includes(accent));assert.ok(p.voice&&p.kind);
 for(const src of [p.src,p.slowSrc].filter(Boolean)){const bytes=fs.readFileSync(new URL(src,root));assert.ok(bytes.length>1000);assert.ok(bytes.toString('ascii',0,3)==='ID3'||(bytes[0]===255&&(bytes[1]&224)===224),src+' must contain MP3 audio');neuralClips++;}
}
console.log(`PASS: 257 WAV recordings, ${Object.keys(data.photos).length-25} photo entries, 25 high-resolution generated body images, ${recordings} archived human recordings, ${neuralClips} neural audio files.`);
