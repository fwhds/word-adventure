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
for(const [id,p]of Object.entries(data.photos)){assert.ok(data.words.some(w=>w.id===id));assert.ok(fs.statSync(new URL(p.src,root)).size>300);assert.match(p.source,/^https:\/\/commons.wikimedia.org/);assert.ok(p.credit&&p.license);if(p.markers?.length){assert.ok(p.width>0&&p.height>0);for(const m of p.markers)assert.ok(m.x>=0&&m.x<=100&&m.y>=0&&m.y<=100);}}
let recordings=0;
for(const [id,list]of Object.entries(data.audio))for(const p of Object.values(list)){assert.ok(data.words.some(w=>w.id===id));assert.ok(fs.statSync(new URL(p.src,root)).size>300);assert.ok(p.source&&p.credit&&p.license);recordings++;}
let neuralClips=0;
for(const [id,list]of Object.entries(data.neural))for(const [accent,p]of Object.entries(list)){
 assert.ok(data.words.some(w=>w.id===id));assert.ok(['uk','us'].includes(accent));assert.ok(p.voice&&p.kind);
 for(const src of [p.src,p.slowSrc].filter(Boolean)){const bytes=fs.readFileSync(new URL(src,root));assert.ok(bytes.length>1000);assert.ok(bytes.toString('ascii',0,3)==='ID3'||(bytes[0]===255&&(bytes[1]&224)===224),src+' must contain MP3 audio');neuralClips++;}
}
console.log(`PASS: 257 WAV fallbacks, ${Object.keys(data.photos).length} credited photos, ${recordings} human recordings, ${neuralClips} neural audio files.`);
