import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Browser APIs are substituted here to check the actual answer handler without
// depending on a microphone, installed voices, or the device speaker volume.
const elements=new Map(),timers=new Map(),spoken=[],tones=[],clips=[];let serial=0;
function element(selector){if(!elements.has(selector))elements.set(selector,{textContent:'',innerHTML:'',style:{},disabled:false,open:selector==='#practice-dialog',classList:{toggle(){},add(){}},addEventListener(){}});return elements.get(selector);}
class AudioContext {
 currentTime=0;state='running';destination={};
 createOscillator(){const tone={frequency:{value:0},connect(){},start(){tones.push(tone.frequency.value);},stop(){}};return tone;}
 createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};}
}
const speech={getVoices:()=>[{lang:'en-GB'}],addEventListener(){},cancel(){},speak:u=>spoken.push(u.text)};
class Audio{constructor(src){this.src=src;clips.push(this);}play(){spoken.push(this.src.split('/').at(-1).replace(/\.wav$/,''));return Promise.resolve();}pause(){this.paused=true;}}
const context=vm.createContext({console,Audio,document:{querySelector:element,querySelectorAll:()=>[],addEventListener(){}},localStorage:{getItem:()=>null,setItem(){}},window:{speechSynthesis:speech,AudioContext,addEventListener(){},scrollTo(){}},speechSynthesis:speech,setTimeout:(fn,delay)=>{const id=++serial;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id),clearInterval(){},crypto:{randomUUID:()=>String(++serial)},navigator:{},URL,Blob});
vm.runInContext(fs.readFileSync(new URL('../dist/vocab.js',import.meta.url),'utf8'),context);
vm.runInContext(fs.readFileSync(new URL('../dist/synth-audio.js',import.meta.url),'utf8'),context);
vm.runInContext(fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8'),context);
const run=source=>vm.runInContext(source,context);
function setup(){timers.clear();spoken.length=0;tones.length=0;run("state=fresh();page='practice';quiz={mode:'mixed',words:[WORDS.find(w=>w.id==='panda')],index:0,correct:0,answered:false,round:'audio-test',reason:'meaning'};");}
function playPending(){for(const [id,task]of [...timers]){timers.delete(id);task.fn();}}

setup();run("answer('panda')");
assert.equal(spoken.length,0,'word waits until the success notes finish');
assert.equal([...timers.values()][0].delay,480);
playPending();assert.deepEqual(spoken,['panda']);assert.equal(tones.length,3);
run("answer('panda')");playPending();assert.deepEqual(spoken,['panda'],'repeated clicks cannot replay an answered question');
assert.match(element('#quiz-feedback').innerHTML,/data-speak="panda"/);

setup();run("answer('cat')");playPending();assert.deepEqual(spoken,[]);assert.equal(tones.length,2);
assert.equal(run("state.words.panda.reasons.includes('meaning')"),true);
assert.match(element('#quiz-feedback').innerHTML,/听正确读音/);

setup();run("state.sound=false;answer('panda')");playPending();assert.deepEqual(spoken,['panda']);assert.equal(tones.length,0,'muting effects does not mute vocabulary speech');
setup();run("answer('panda');cleanupRecording()");playPending();assert.deepEqual(spoken,[],'closing or advancing cancels an old pending word');
setup();run("answer('panda');page='home'");playPending();assert.deepEqual(spoken,[]);
setup();run("quiz.reason='pronunciation';answer(null,'yes')");playPending();assert.deepEqual(spoken,['panda'],'parent-confirmed pronunciation answers also read the word');
setup();run("mark(WORDS.find(w=>w.id==='panda'),'pronunciation')");
assert.equal(run('questionSet(WORDS,true).length'),20);
assert.equal(run('questionSet(WORDS,true)[0].id'),'panda','weak words come before unfamiliar words');
assert.equal(run("questionSet(WORDS.filter(w=>w.category==='weather'),true).length"),20,'small categories repeat to complete 20 questions');
assert.equal(run("questionSet([WORDS[0]],true).length"),20,'a single weak word can be reviewed in a 20-question round');
assert.equal(run("wordCard(WORDS[0]).includes('data-speak=\"panda\"')"),true);
assert.equal(run("home().includes('每轮 20 题')"),true);
assert.equal(run("pronunciationPage().includes('开始 20 题发音测试')"),true);
setup();run("startQuiz('mixed');for(let i=0;i<20;i++){answer(quiz.words[quiz.index].id);next();}");
assert.equal(run('state.rounds'),1);assert.equal(run('state.stars'),20);
assert.match(element('#practice-content').innerHTML,/这一轮完成 20 题，答对 20 题/);
context.WORD_AUDIO={panda:{us:{src:'assets/audio/panda-us.mp3'}}};
setup();run("answer('panda')");playPending();assert.equal(clips.at(-1).src,'assets/audio/synthesized/panda.wav');assert.deepEqual(spoken,['panda']);
run('next()');assert.equal(clips.at(-1).paused,true,'advancing stops cached audio');
run("speak('carrot',true)");assert.equal(clips.at(-1).src,'assets/audio/synthesized/carrot.wav');assert.equal(clips.at(-1).playbackRate,.75);
context.WORD_NEURAL_AUDIO={panda:{uk:{src:'assets/audio/neural/panda-uk.mp3',slowSrc:'assets/audio/neural/panda-uk-slow.mp3',slowRate:.75,accent:'uk',voice:'British test voice'},us:{src:'assets/audio/neural/panda-us.mp3',slowSrc:'assets/audio/neural/panda-us-slow.mp3',slowRate:.75,accent:'us',voice:'American test voice'}}};
setup();run("speak('panda')");assert.equal(clips.at(-1).src,'assets/audio/synthesized/panda.wav');assert.equal(clips.at(-1).playbackRate,1);
run("speak('panda',true)");assert.equal(clips.at(-1).playbackRate,.75);assert.equal(clips.at(-1).preservesPitch,true);
run("state.accent='en-GB';state.audioSource='human';speak('panda')");assert.equal(clips.at(-1).src,'assets/audio/synthesized/panda.wav','old preferences cannot reintroduce mixed voices');
const firstClip=clips.at(-1),failureCount=clips.length;firstClip.onerror();assert.equal(clips.length,failureCount,'playback failure must not silently switch voices');assert.match(element('#toast').textContent,/点击重试/);
run("speak('panda')");
run('stopSpeech()');const before=clips.length;clips.at(-1).onerror();assert.equal(clips.length,before,'late errors cannot restart speech after leaving');
context.WORD_PHOTOS={nose:{src:'assets/photos/body.jpg',width:600,height:800,crop:{x:150,y:300,width:180,height:120},caption:'鼻子',markers:[{x:25,y:75}]}};
const closeup=run("photo(WORDS.find(w=>w.id==='nose'))");
assert.match(closeup,/viewBox="0 0 180 120"/);assert.match(closeup,/viewBox="150 300 180 120"/);
assert.match(closeup,/aria-label="鼻子局部实拍照片"/);assert.match(closeup,/<image class="photo-source"/);
assert.doesNotMatch(closeup,/<circle|photo-marker|photo-caption/,'body pictures never reveal labels or retain legacy markers');
assert.match(run("photoCredit(WORDS.find(w=>w.id==='nose'))"),/局部裁切展示/);
context.WORD_PHOTOS.nose={src:'assets/body-ai/nose.webp',kind:'generated',width:1254,height:1254,presentation:'unlabelled-closeup'};
const generatedPhoto=run("photo(WORDS.find(w=>w.id==='nose'))");
assert.match(generatedPhoto,/alt="鼻子高清写实图片（AI生成）"/);
assert.doesNotMatch(generatedPhoto,/实拍|photo-caption|photo-marker|<svg/);
assert.match(run("photoCredit(WORDS.find(w=>w.id==='nose'))"),/AI 生成图片/);
assert.doesNotMatch(run("photoCredit(WORDS.find(w=>w.id==='nose'))"),/CC BY|实拍/);
assert.equal(run("validateState({version:1,words:{},stars:0,rounds:0,audioSource:'human',accent:'en-GB'}).audioSource"),'zira');
assert.equal(run("validateState({version:1,words:{},stars:0,rounds:0,accent:'en-GB'}).accent"),'en-US');
assert.equal(run("WORDS.every(w=>audioChoices(w).length===1&&audioChoices(w)[0].voice==='Microsoft Zira Desktop')"),true);
// Mastery must survive imports and prevent targets from reappearing in any mode.
setup();run("const panda=WORDS.find(w=>w.id==='panda');mark(panda,'pronunciation');state.stars=12;setMastered(panda,true)");
assert.equal(run('isMastered(panda)'),true);assert.equal(run('weakWords().length'),0);assert.equal(run('learned()'),1);
assert.equal(run('state.stars'),12,'manual mastery must not award stars');
assert.match(run('wordCard(panda)'),/word-card mastered/);assert.match(run('wordCard(panda)'),/aria-pressed="true"/);
assert.match(run('wordPage(panda)'),/mastered-picture/);
run('state=validateState(JSON.parse(JSON.stringify(state)))');assert.equal(run('isMastered(panda)'),true);
run('setMastered(panda,false)');assert.equal(run('isMastered(panda)'),false);
assert.equal(run('questionSet([panda]).length'),20);
run("success(panda,'meaning','round1');success(panda,'meaning','round1')");assert.equal(run('entry(panda).hits'),1);
run("success(panda,'meaning','round2');success(panda,'meaning','round3')");assert.equal(run('isMastered(panda)'),true);
assert.equal(run('questionSet([panda]).length'),0);
run("mark(panda,'meaning')");assert.equal(run('isMastered(panda)'),false);assert.equal(run('weakWords()[0].id'),'panda');
run("state=validateState({version:1,words:{panda:{hits:3,reasons:[]},cat:{hits:5,reasons:[],mastered:false},dog:{hits:4,reasons:['meaning'],mastered:true}}})");
assert.equal(run('isMastered(panda)'),true,'old familiar words become mastered');
assert.equal(run("isMastered(WORDS.find(w=>w.id==='cat'))"),false,'explicit unmark survives validation');
assert.equal(run("isMastered(WORDS.find(w=>w.id==='dog'))"),false,'weak reason overrides inconsistent mastery');
run("state=fresh();for(const w of WORDS)setMastered(w,true);quiz=null;startQuiz('mixed')");
assert.equal(run('quiz'),null);assert.match(element('#toast').textContent,/全部掌握/);
assert.equal(run('questionSet(WORDS,true).length'),0);
run("setMastered(panda,false);for(const mode of ['mixed','weak','category','speaking','pronunciation']){if(mode==='weak')mark(panda,'meaning');category='all';pronunciationCategory='all';startQuiz(mode);if(quiz.words.some(w=>isMastered(w)))throw Error('Mastered target in '+mode);}");
assert.equal(run('quiz.words.length'),20);
setup();run("const cat=WORDS.find(w=>w.id==='cat');entry(panda).hits=2;quiz.pool=[panda,cat];quiz.words=Array.from({length:20},(_,i)=>i%2?cat:panda);answer('panda');next()");
assert.equal(run('quiz.words.length'),20);assert.equal(run('quiz.words.slice(quiz.index).some(w=>w.id===panda.id)'),false,'mid-round mastery removes queued repeats and refills from pending words');
setup();run("entry(panda).hits=2;quiz.pool=[panda];quiz.words=Array(20).fill(panda);answer('panda');next()");
assert.equal(run('state.rounds'),1);assert.equal(run('state.stars'),1);
assert.match(element('#practice-content').innerHTML,/这一轮完成 1 题，答对 1 题/,'all mastered ends the round without padding known words');
setup();run("page='library';category='all';query='';libraryPage=0");
assert.equal((run('library()').match(/<article class="word-card /g)||[]).length,20);
run('libraryPage=1');assert.doesNotMatch(run('library()'),/data-speak="panda"/,'second library page does not render the first page');
run("query='panda';libraryPage=0");assert.equal((run('library()').match(/<article class="word-card /g)||[]).length,1);
context.WORD_PHOTOS.panda={src:'assets/photos/panda.jpg',thumbnail:'assets/cards/panda.test.webp'};
assert.match(run('photo(panda,true)'),/src="assets\/cards\/panda.test.webp"/);
assert.match(run('photo(panda)'),/src="assets\/photos\/panda.jpg"/,'detail view retains the source image');
setup();run('quizRender()');assert.match(element('#practice-content').innerHTML,/src="assets\/cards\/panda.test.webp"/,'practice targets also use lightweight card images');
console.log('PASS: 20-question learning, weak-first sets, answer cues, automatic unified Zira speech for 257 words, speed/pitch, failure/cancellation, legacy-setting migration and unlabelled body closeups.');
console.log('PASS: manual/automatic mastery, green-card status, undo, import compatibility, weak-word revival, all practice modes exclude mastered targets, mid-round replacement and early completion.');
