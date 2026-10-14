'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY = 'word-adventure-v1';
const REASONS = {meaning:'不认识',listening:'听不懂',speaking:'说不出',pronunciation:'发音再练'};
const fresh = () => ({version:1,words:{},stars:0,rounds:0,accent:'en-US',rate:1,sound:true,audioSource:'zira'});
let state = fresh();
function validateState(data) {
 if (!data || data.version !== 1 || !data.words || typeof data.words !== 'object' || Array.isArray(data.words)) throw Error('记录格式不正确');
 const clean=fresh();
 clean.stars=Number.isFinite(data.stars)?Math.max(0,Math.floor(data.stars)):0;
 clean.rounds=Number.isFinite(data.rounds)?Math.max(0,Math.floor(data.rounds)):0;
 clean.accent='en-US';
 clean.rate=[.65,.8,1].includes(data.rate)?data.rate:1;
 clean.audioSource='zira';
 clean.sound=data.sound!==false;
 for(const w of WORDS){const old=data.words[w.id];if(!old||typeof old!=='object')continue;
  clean.words[w.id]={reasons:Array.isArray(old.reasons)?[...new Set(old.reasons.filter(r=>Object.hasOwn(REASONS,r)))]:[],streak:{},lastRound:{},seen:!!old.seen,hits:Number.isFinite(old.hits)?Math.max(0,Math.floor(old.hits)):0};
  const saved=clean.words[w.id];saved.mastered=!saved.reasons.length&&(typeof old.mastered==='boolean'?old.mastered:saved.hits>=3);
  for(const r of Object.keys(REASONS)){clean.words[w.id].streak[r]=Number.isFinite(old.streak?.[r])?Math.min(3,Math.max(0,old.streak[r])):0;clean.words[w.id].lastRound[r]=typeof old.lastRound?.[r]==='string'?old.lastRound[r]:'';}
 }
 return clean;
}
try{const raw=localStorage.getItem(KEY);if(raw)state=validateState(JSON.parse(raw));}catch{}
let selectedWord=null,practiceCategory='mixed',pronunciationCategory='all',libraryPage=0;
const CARD_PAGE_SIZE=20;
const ROUND_SIZE=20;
let page='home',category='all',weakFilter='all',query='',quiz=null,recorder=null,stream=null,recordTimer=null,recordTimeout=null,recordingWord=null,audioURL=null;
function toast(msg){$('#toast').textContent=msg;$('#toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').style.display='none',3800);}
function save(){try{const key=window.AccountManager?.storageKey()||KEY;localStorage.setItem(key,JSON.stringify(state));}catch{toast('浏览器未能保存记录，可在家长设置中导出备份。');}$('#star-total').textContent=state.stars;$('#weak-nav').textContent=weakWords().length;window.AccountManager?.queueSave();}
let soundContext=null,answerReadTimer=null,wordAudio=null;
function feedbackSound(correct,preview=false){if(!state.sound&&!preview)return;try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;soundContext ||= new Audio();if(soundContext.state==='suspended')soundContext.resume();const start=soundContext.currentTime;const notes=correct?[[523.25,0,.12],[659.25,.11,.12],[783.99,.22,.2]]:[[392,0,.16],[329.63,.16,.22]];for(const [frequency,delay,duration]of notes){const oscillator=soundContext.createOscillator(),gain=soundContext.createGain();oscillator.type='sine';oscillator.frequency.value=frequency;gain.gain.setValueAtTime(.0001,start+delay);gain.gain.exponentialRampToValueAtTime(.13,start+delay+.015);gain.gain.exponentialRampToValueAtTime(.0001,start+delay+duration);oscillator.connect(gain);gain.connect(soundContext.destination);oscillator.start(start+delay);oscillator.stop(start+delay+duration+.03);}}catch{}}
function photo(w,small=false,priority=false){
 const p=typeof WORD_PHOTOS!=='undefined'?WORD_PHOTOS[w.id]:null;
 if(!p)return `<span class="picture-fallback">${w.icon}${w.category!=='numbers'?'<small>暂缺实拍照片</small>':''}</span>`;
 const label=p.kind==='generated'?`${w.zh}高清写实图片（AI生成）`:`${w.zh}${p.crop?'局部':''}实拍照片`;
 // The nested viewport crops the original photograph without stretching it.
 // No arrows, circles or answer labels are drawn onto body-part pictures.
 const crop=p.crop,source=small&&p.thumbnail?p.thumbnail:p.src,eager=!small||priority;
 const img=crop?`<svg class="real-photo photo-closeup ${small?'small-photo':''}" viewBox="0 0 ${crop.width} ${crop.height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(label)}"><svg width="${crop.width}" height="${crop.height}" viewBox="${crop.x} ${crop.y} ${crop.width} ${crop.height}" overflow="hidden"><image class="photo-source" href="${esc(p.src)}" width="${p.width}" height="${p.height}"/></svg></svg>`:`<img class="real-photo ${small?'small-photo':''}" src="${esc(source)}" alt="${esc(label)}" loading="${eager?'eager':'lazy'}" fetchpriority="${eager?'high':'auto'}" decoding="async">`;
 const caption=w.category==='body'?'':p.caption;
 return `<span class="photo-scene">${img}${caption?`<span class="photo-caption">${esc(caption)}</span>`:''}</span><span class="image-fallback" hidden>${w.icon}<small>照片暂时不可用</small></span>`;
}
function photoCredit(w){const p=typeof WORD_PHOTOS!=='undefined'?WORD_PHOTOS[w.id]:null;if(!p)return w.category==='numbers'?'数字用数量符号呈现。':'暂缺合适的实拍照片，当前用图标辅助。';if(p.kind==='generated')return 'AI 生成图片 · 高清写实特写';return `${p.crop?'局部裁切展示 · ':''}照片：${esc(p.credit)} · ${esc(p.license)} · <a href="${esc(p.source)}" target="_blank" rel="noopener noreferrer">查看来源</a>`;}
function audioChoices(w){
 const recording=typeof WORD_SYNTH_AUDIO!=='undefined'?WORD_SYNTH_AUDIO[w?.id]:null;
 return recording?[{...recording,type:'zira'}]:[];
}
function audioCredit(w){return audioChoices(w).length?'统一示范：Microsoft Zira Desktop · 美式英语 · 完整词条合成录音':'示范录音暂缺，请重试。';}
document.addEventListener('error',e=>{if(e.target.matches?.('img.real-photo,image.photo-source')){const scene=e.target.closest?.('.photo-scene')||e.target;scene.hidden=true;const fallback=scene.nextElementSibling;if(fallback)fallback.hidden=false;}},true);
function entry(w){return state.words[w.id] ||= {reasons:[],streak:{},lastRound:{},seen:false,hits:0,mastered:false};}
function isMastered(w){const s=state.words[w.id];return !!s&&!s.reasons.length&&(typeof s.mastered==='boolean'?s.mastered:s.hits>=3);}
function weakWords(){return WORDS.filter(w=>!isMastered(w)&&state.words[w.id]?.reasons.length);}
function learned(){return WORDS.filter(isMastered).length;}
function setMastered(w,value){const s=entry(w);s.mastered=value;s.seen=true;s.reasons=[];s.streak={};s.lastRound={};if(!value)s.hits=0;save();}
function masteryButton(w){const done=isMastered(w);return `<button class="mastery-toggle ${done?'is-mastered':''}" data-mastery="${w.id}" aria-pressed="${done}" aria-label="${done?'取消掌握':'标记已掌握'} ${esc(w.en)}">${done?'✓ 已掌握 · 重新练习':'我已掌握'}</button>`;}
function mark(w,reason){const s=entry(w);s.seen=true;s.mastered=false;if(!s.reasons.includes(reason))s.reasons.push(reason);s.streak[reason]=0;save();}
function success(w,reason,round){const s=entry(w);s.seen=true;if(s.lastRound[reason]===round)return;s.lastRound[reason]=round;s.hits++;if(s.reasons.includes(reason)){s.streak[reason]=(s.streak[reason]||0)+1;if(s.streak[reason]>=3)s.reasons=s.reasons.filter(r=>r!==reason);}if(s.hits>=3&&!s.reasons.length)s.mastered=true;save();}
function stopSpeech(){clearTimeout(answerReadTimer);answerReadTimer=null;if(wordAudio){wordAudio.pause();wordAudio=null;}if(window.speechSynthesis)speechSynthesis.cancel();}
function speak(word,slow=false){
 stopSpeech();const w=WORDS.find(w=>w.en===word),recording=audioChoices(w)[0];
 if(!recording){toast('这个词的示范录音暂时不可用，请刷新后重试。');return;}
 const audio=new Audio(recording.src);wordAudio=audio;audio.playbackRate=slow?.75:state.rate;audio.preservesPitch=true;
 audio.onended=()=>{if(wordAudio===audio)wordAudio=null;};
 const failed=()=>{if(wordAudio!==audio)return;wordAudio=null;audio.pause();toast('示范录音暂时无法播放，请点击重试。');};
 audio.onerror=failed;audio.play().catch(failed);
}
function shuffle(arr){return [...arr].sort(()=>Math.random()-.5);}
function group(id){return GROUPS.find(g=>g[0]===id);}
function animalArt(){return `<svg class="hero-art" viewBox="0 0 420 300" role="img" aria-label="猫头鹰和狐狸在树林里一起学习"><ellipse cx="210" cy="262" rx="181" ry="24" fill="#e1d8ee"/><path d="M76 268 Q190 180 318 266" fill="none" stroke="#fbf8ff" stroke-width="27"/><path d="M50 212v-92m-9 40 10 13 20-25" stroke="#b7c599" stroke-width="8" stroke-linecap="round"/><ellipse cx="54" cy="100" rx="43" ry="52" fill="#c6d3af"/><ellipse cx="86" cy="127" rx="25" ry="35" fill="#d4dfbc"/><path d="M353 227v-117" stroke="#b7c599" stroke-width="8"/><ellipse cx="350" cy="96" rx="39" ry="55" fill="#c7d6ad"/><circle cx="364" cy="125" r="31" fill="#d3dfbb"/><path d="M140 132 117 85 169 111 204 94 220 134" fill="#8872c3"/><ellipse cx="170" cy="175" rx="70" ry="76" fill="#9d85cf"/><ellipse cx="167" cy="195" rx="48" ry="43" fill="#cec0e8"/><circle cx="142" cy="149" r="26" fill="#fff9e8"/><circle cx="192" cy="149" r="26" fill="#fff9e8"/><circle cx="149" cy="151" r="9" fill="#494058"/><circle cx="185" cy="151" r="9" fill="#494058"/><circle cx="152" cy="148" r="3" fill="white"/><circle cx="188" cy="148" r="3" fill="white"/><path d="m161 170 10 15 10-15" fill="#e8b165"/><path d="M106 163q-26 40 12 53m103-57q29 40-4 54" fill="#8b73c2"/><path d="M137 245v9m53-9v9" stroke="#b09769" stroke-width="7" stroke-linecap="round"/><path d="M296 211q38-57 64-9-1 45-54 40" fill="#df9767"/><path d="M341 184q27 24 9 40-8-16-24-17" fill="#fff2d9"/><ellipse cx="279" cy="220" rx="39" ry="34" fill="#e4a377"/><path d="m242 165-8-43 39 21 31-21 13 43" fill="#df9767"/><path d="M239 163q37-35 76 0l-13 43h-55Z" fill="#e9ae81"/><path d="m244 169 31 12 34-12-15 32h-35Z" fill="#fff3df"/><path d="m268 184 8 8 8-8" fill="#514250"/><circle cx="254" cy="165" r="4" fill="#514250"/><circle cx="299" cy="165" r="4" fill="#514250"/><path d="M205 220h71v35h-71Z" fill="#87a9a0"/><path d="M238 220v35" stroke="#dcece1" stroke-width="3"/><path d="M64 46h21m-10-10v20" stroke="#ddc88a" stroke-width="4" stroke-linecap="round"/><path d="M311 51h15m-8-8v16" stroke="#ddc88a" stroke-width="3" stroke-linecap="round"/><circle cx="245" cy="45" r="5" fill="#c1afe0"/><path d="M29 259q4-26 19-21m-9 29q4-23 13-23m303 16q4-21 13-18" fill="none" stroke="#a5b58c" stroke-width="5" stroke-linecap="round"/></svg>`;}
function categoryCards(){return GROUPS.map(g=>{const list=WORDS.filter(w=>w.category===g[0]),done=list.filter(isMastered).length;return `<button class="category-card" data-category="${g[0]}"><span class="arrow">↗</span><div class="category-icon" style="background:${g[3]}">${g[2]}</div><h3>${g[1]}</h3><p>${list.length} 个词 · 已掌握 ${done} 个</p><div class="mini-progress"><i style="width:${done/list.length*100}%"></i></div></button>`;}).join('');}
function home(){return `<section class="hero"><div><span class="eyebrow">YOUR NEXT LITTLE ADVENTURE</span><h1>把单词，变成<br>你的好朋友。</h1><p>看一看，听一听，再大胆说出来。<br>从一小步开始，发现英语的乐趣。</p><button class="primary" data-start="mixed">开始一轮练习 <span>→</span></button><p class="small-note">每轮 20 题 · 从基础词开始 · 答完立即反馈</p></div>${animalArt()}</section><section class="practice-picker"><div><h2>按类别练习</h2><p>选一个喜欢的类别，开始 20 题小闯关。</p></div><div class="toolbar"><select id="practice-category" aria-label="练习类别"><option value="mixed">基础混合词</option>${GROUPS.map(g=>`<option value="${g[0]}" ${practiceCategory===g[0]?'selected':''}>${g[1]}</option>`).join('')}</select><button class="primary" id="start-selected-category">开始分类练习 →</button></div></section><section class="stats"><div class="stat"><span class="stat-icon">🌱</span><div><strong>${learned()}</strong><p>已经掌握的单词</p></div></div><div class="stat"><span class="stat-icon">♡</span><div><strong>${weakWords().length}</strong><p>等待复练的单词</p></div></div><div class="stat"><span class="stat-icon">⚑</span><div><strong>${state.rounds}</strong><p>完成的练习轮次</p></div></div></section><div class="section-head"><div><h2>选一个喜欢的世界</h2><p>两页词汇，八个小小探险地图</p></div><button class="text-btn" data-go="library">全部 ${WORDS.length} 个词 →</button></div><section class="category-grid">${categoryCards()}</section><section class="weak-banner"><span>🌻</span><div><h3>${weakWords().length?'这些单词，值得再见一次':'不会的单词，也有自己的小花园'}</h3><p>答错或标记后自动收集，换种方式再练。</p></div><button class="secondary" data-go="weak">去薄弱词页 →</button></section><div class="section-head"><div><h2>大胆开口说</h2><p>先听示范，再录音回听，让家长帮你发现进步</p></div><button class="secondary" data-start="speaking">跟读练习 🎙</button></div>`;}
function wordCard(w,index=4){const s=state.words[w.id];return `<article class="word-card ${isMastered(w)?'mastered':''}"><button class="word-picture photo-play" data-speak="${w.id}" aria-label="播放 ${esc(w.en)}，${w.zh}" style="background:${group(w.category)[3]}">${photo(w,true,index<4)}<span class="play-corner" aria-hidden="true">🔊</span></button><div class="word-en">${esc(w.en)}</div><div class="word-zh">${w.zh}</div>${s?.reasons.length?`<span class="tag">${s.reasons.map(r=>REASONS[r]).join(' · ')}</span>`:isMastered(w)?'<span class="tag good">✓ 已掌握</span>':''}${masteryButton(w)}<button class="card-tools" data-word="${w.id}" aria-label="跟读与标记 ${esc(w.en)}">跟读 / 标记 →</button></article>`;}
function library(){
 const filtered=WORDS.filter(w=>(category==='all'||w.category===category)&&(w.en.toLowerCase().includes(query.toLowerCase())||w.zh.includes(query)||w.aliases.some(a=>a.includes(query.toLowerCase()))));
 const totalPages=Math.max(1,Math.ceil(filtered.length/CARD_PAGE_SIZE));libraryPage=Math.min(libraryPage,totalPages-1);const shown=filtered.slice(libraryPage*CARD_PAGE_SIZE,(libraryPage+1)*CARD_PAGE_SIZE);
 const note=category==='body'?'本类使用 AI 生成的高清写实图片；点击图片直接听英文。':'图片帮助辨认；点击图片直接听英文。';
 return `<div class="page-heading"><span class="eyebrow">EXPLORE YOUR WORDS</span><h1>${category==='all'?'分类词库':group(category)[1]}</h1><p>点击图片直接听英文，点击“跟读 / 标记”进入学习页。</p></div><div class="toolbar"><input id="search" aria-label="搜索单词" placeholder="搜索英文或中文…" value="${esc(query)}"><select id="category-select" aria-label="选择词汇类别"><option value="all">全部类别 · ${WORDS.length} 个词</option>${GROUPS.map(g=>`<option value="${g[0]}" ${g[0]===category?'selected':''}>${g[1]}</option>`).join('')}</select><button class="primary" data-start="category">练习这一类</button></div><p class="muted small" style="margin-bottom:16px">找到 ${filtered.length} 个词，已掌握 ${filtered.filter(isMastered).length} 个；已掌握词不再出题。${note}</p><div class="word-grid">${shown.map(wordCard).join('')||'<p class="muted">没有找到这个词，试试其他关键词。</p>'}</div>${totalPages>1?`<div class="library-pagination" aria-label="词库分页"><button class="secondary" data-library-page="${libraryPage-1}" ${libraryPage===0?'disabled':''}>← 上一页</button><span>第 ${libraryPage+1} / ${totalPages} 页 · 每页 20 词</span><button class="secondary" data-library-page="${libraryPage+1}" ${libraryPage===totalPages-1?'disabled':''}>下一页 →</button></div>`:''}`;
}
function weakPage(){const list=weakWords().filter(w=>weakFilter==='all'||state.words[w.id].reasons.includes(weakFilter));return `<div class="page-heading"><span class="eyebrow">A LITTLE MORE PRACTICE</span><h1>我的薄弱词 <span style="color:#a396ba">${weakWords().length}</span></h1><p>不会没有关系。找到原因，换一种方式，再练一次。</p></div><div class="toolbar"><button class="filter-chip ${weakFilter==='all'?'selected':''}" data-filter="all">全部</button>${Object.entries(REASONS).map(([id,title])=>`<button class="filter-chip ${weakFilter===id?'selected':''}" data-filter="${id}">${title} ${weakWords().filter(w=>state.words[w.id].reasons.includes(id)).length}</button>`).join('')}<button class="primary" data-start="weak" ${list.length?'':'disabled'}>优先复练 →</button></div><div class="info-box">同一薄弱项在 3 个不同练习轮次中答对，才会自动移出。发音与表达由家长确认，不用识别文字假装发音评分。</div>${list.length?`<div class="word-grid">${list.map(wordCard).join('')}</div>`:`<div class="empty-state"><div class="big-icon">🌱</div><h2>${weakWords().length?'这一类没有薄弱词':'你的小花园，还在等第一颗种子'}</h2><p>练习中答错的词会自动来到这里。<br>也可以进入词卡学习页，标记“听不懂”或“发音再练”。</p><button class="primary" data-start="mixed">先练一小轮 →</button></div>`}`;}

function pronunciationPage(){const list=WORDS.filter(w=>pronunciationCategory==='all'||w.category===pronunciationCategory),pending=list.filter(w=>!isMastered(w)),weak=pending.filter(w=>state.words[w.id]?.reasons.length).length;return `<div class="page-heading"><span class="eyebrow">SAY YOUR WORDS</span><h1>分类测发音</h1><p>先复练薄弱词，再练习同类新词。每轮 20 题，听示范后自己说。</p></div><section class="account-panel pronunciation-panel"><div class="toolbar"><select id="pronunciation-category" aria-label="发音测试类别"><option value="all">全部类别</option>${GROUPS.map(g=>`<option value="${g[0]}" ${g[0]===pronunciationCategory?'selected':''}>${g[1]}</option>`).join('')}</select><button class="primary" data-start="pronunciation">开始 20 题发音测试 →</button></div><p class="muted">当前类别共 ${list.length} 个词，${list.length-pending.length} 个已掌握，${pending.length} 个待练；其中 ${weak} 个薄弱词优先。</p><div class="info-box">免费 AI 音频评测尚未接通，本版由家长听录音并确认“读得不错”或“需要再练”。需要再练的词会记为“发音再练”；不会生成自动发音分数。<br>已掌握词不再出题。不足 20 个待练词时轮换复练；剩余词全部掌握则提前完成。同一词在同一轮中重复答对只计一次掌握进度。</div></section>`;}
function questionSet(pool,priority=false){pool=pool.filter(w=>!isMastered(w));const weak=priority?shuffle(pool.filter(w=>state.words[w.id]?.reasons.length)):[],other=shuffle(priority?pool.filter(w=>!state.words[w.id]?.reasons.length):pool);const ordered=[...weak,...other],result=[];if(!ordered.length)return result;while(result.length<ROUND_SIZE){result.push(...ordered.slice(0,ROUND_SIZE-result.length));}return result;}
function render(){save();document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));$('#content').innerHTML=page==='home'?home():page==='weak'?weakPage():page==='pronunciation'?pronunciationPage():page==='word'?wordPage(selectedWord):page==='practice'?'<section class="practice-inline" id="practice-content"></section>':page==='account'?(window.AccountManager?.pageHTML()||'<p class="muted">正在加载账号…</p>'):library();}
function go(next){cleanupRecording();releaseAudio();stopSpeech();page=next;render();window.scrollTo({top:0,behavior:'smooth'});}
function detail(w){selectedWord=w;go('word');}
function wordPage(w){const s=entry(w);s.seen=true;save();return `<div class="modal-top"><span class="muted">${group(w.category)[1]} · 单词小卡片</span><button class="secondary" data-go="library">← 返回词库</button></div><button class="detail-picture photo-play ${isMastered(w)?'mastered-picture':''}" data-speak="${w.id}" aria-label="播放 ${esc(w.en)}" style="background:${group(w.category)[3]}">${photo(w)}<span class="play-corner" aria-hidden="true">🔊</span></button><div class="detail-title"><h2>${esc(w.en)}</h2><p>${w.zh}</p>${w.aliases.length?`<span class="muted small">也可以说：${w.aliases.map(esc).join(' / ')}</span>`:''}</div><p class="photo-credit">${photoCredit(w)}<br>${audioCredit(w)}</p><div class="button-row"><button class="sound-button" data-speak="${w.id}">🔊 听示范</button><button class="sound-button" data-slow="${w.id}">🐢 慢速听</button><button class="secondary" data-record="${w.id}" id="record-btn">🎙 录下我的声音</button></div><div class="rec-status" id="rec-status">短录音只用于本地回听，最多 15 秒</div><div id="audio-holder"></div><div class="button-row">${masteryButton(w)}</div><div class="reason-label">这个单词哪里需要再练？</div><div class="reason-buttons">${Object.entries(REASONS).map(([r,title])=>`<button data-mark="${w.id}" data-reason="${r}">${title}${s.reasons.includes(r)?' ✓':''}</button>`).join('')}</div><div class="info-box">${s.reasons.length?'已收进薄弱词页：'+s.reasons.map(r=>REASONS[r]+'（'+(s.streak[r]||0)+'/3 轮）').join('、'):'听完后试着自己说一遍。家长可帮忙标记，稍后到薄弱词页复练。'}<br>此版未接入 AI 评测，没有发音分数。</div>`;}
function cleanupRecording(){clearTimeout(answerReadTimer);answerReadTimer=null;clearInterval(recordTimer);clearTimeout(recordTimeout);recordTimer=null;recordTimeout=null;if(recorder&&recorder.state==='recording'){recorder.stop();}stream?.getTracks().forEach(t=>t.stop());stream=null;recordingWord=null;}
function releaseAudio(){if(audioURL){URL.revokeObjectURL(audioURL);audioURL=null;}}
async function record(w){
 if(recorder?.state==='recording'){recorder.stop();return;}
 if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){toast('当前环境不能录音，请在本机浏览器通过 localhost 打开。');return;}
 try{
  const recStream=await navigator.mediaDevices.getUserMedia({audio:true});
  const activeHolder=$('#rec-status');if(!activeHolder){recStream.getTracks().forEach(t=>t.stop());return;}
  stream=recStream;recordingWord=w.id;releaseAudio();const holderAtStart=$('#audio-holder');const chunks=[];const current=new MediaRecorder(stream);recorder=current;current.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  current.onstop=()=>{clearInterval(recordTimer);clearTimeout(recordTimeout);recStream.getTracks().forEach(t=>t.stop());if(stream===recStream)stream=null;const holder=$('#audio-holder');if(!holder||holder!==holderAtStart||!['word','practice'].includes(page)){return;}if(!chunks.length){toast('没有录到声音，请检查麦克风后重试。');return;}releaseAudio();audioURL=URL.createObjectURL(new Blob(chunks,{type:current.mimeType}));holder.innerHTML='<audio controls aria-label="回听我的录音"></audio>';holder.querySelector('audio').src=audioURL;const btn=$('#record-btn');if(btn){btn.textContent='🎙 再录一次';btn.classList.remove('recording');btn.disabled=false;}if($('#rec-status'))$('#rec-status').textContent='录好了！听听示范，再回听自己的声音。';recordingWord=null;};
  current.onerror=()=>{cleanupRecording();toast('录音中断，请再试一次。');};current.start();const start=Date.now();const btn=$('#record-btn');btn.textContent='■ 停止录音';btn.classList.add('recording');recordTimer=setInterval(()=>{if($('#rec-status'))$('#rec-status').textContent=`正在录音 ${Math.floor((Date.now()-start)/1000)} 秒 / 15 秒`;},250);recordTimeout=setTimeout(()=>{if(current.state==='recording')current.stop();},15000);
 }catch(e){cleanupRecording();toast(e.name==='NotAllowedError'?'麦克风权限未开启。允许访问后可录音；听示范和练习仍可使用。':'无法访问麦克风，请检查设备后重试。');}
}
function startQuiz(mode){
 cleanupRecording();releaseAudio();stopSpeech();
 let pool=mode==='weak'?weakWords().filter(w=>weakFilter==='all'||entry(w).reasons.includes(weakFilter)):mode==='category'?WORDS.filter(w=>category==='all'||w.category===category):mode==='pronunciation'?WORDS.filter(w=>pronunciationCategory==='all'||w.category===pronunciationCategory):mode==='speaking'?WORDS.filter(w=>['animals','food','school'].includes(w.category)):WORDS.filter(w=>['panda','elephant','tiger','cat','dog','apple','banana','pencil','sunny','one','rabbit','carrot','hand','basketball','schoolbag','fish'].includes(w.en));
 pool=pool.filter(w=>!isMastered(w));
 if(mode==='mixed'&&!pool.length)pool=WORDS.filter(w=>!isMastered(w));
 if(!pool.length){toast(mode==='weak'?'没有需要复练的薄弱词，可以从首页选择类别继续学习。':'这一类已全部掌握，暂时没有待练词。可到词库取消掌握后重新练习。');return;}
 quiz={mode,pool,words:questionSet(pool,['weak','speaking','pronunciation'].includes(mode)),index:0,correct:0,answered:false,round:crypto.randomUUID()};page='practice';render();quizRender();window.scrollTo({top:0,behavior:'smooth'});
}
function quizReason(w){if(['speaking','pronunciation'].includes(quiz.mode))return'pronunciation';if(quiz.mode==='weak'){const reasons=entry(w).reasons;return weakFilter!=='all'?weakFilter:reasons[0]||'meaning';}return quiz.index%2?'listening':'meaning';}
function quizRender(){
 const w=quiz.words[quiz.index];quiz.reason=quizReason(w);quiz.answered=false;
 const manual=['speaking','pronunciation'].includes(quiz.reason);const listening=quiz.reason==='listening';
 const options=shuffle([w,...shuffle(WORDS.filter(o=>o.category===w.category&&o.id!==w.id&&o.zh!==w.zh)).filter((o,i,a)=>a.findIndex(v=>v.zh===o.zh)===i).slice(0,3)]);
 $('#practice-content').innerHTML=`<div class="modal-top"><span class="muted">${quiz.mode==='weak'?'薄弱词复练':quiz.mode==='pronunciation'?'分类测发音':manual?'大胆开口说':'单词小闯关'} · ${quiz.index+1} / ${quiz.words.length}</span><button class="secondary" data-go="home">← 退出练习</button></div><div class="practice-bar"><i style="width:${quiz.index/quiz.words.length*100}%"></i></div><div class="practice-question"><h2>${manual?'听一听，再自己说一遍':listening?'听到的是哪个单词？':'这个单词用英语怎么说？'}</h2><p>${manual?'录音回听后，请家长确认练习结果':listening?'点击喇叭听声音，再选对应的词':'看图片和中文，选择英文'}</p></div>${listening?`<div class="quiz-image"><button class="sound-button" data-speak="${w.id}" style="font-size:45px" aria-label="播放题目声音">🔊</button></div>`:`<button class="quiz-image photo-play" data-speak="${w.id}" aria-label="播放 ${esc(w.en)}" style="background:${group(w.category)[3]}">${photo(w,true,true)}<span class="play-corner" aria-hidden="true">🔊</span></button><p style="text-align:center;margin-bottom:20px;font-size:18px">${w.zh}${manual?`<br><strong style="display:inline-block;margin-top:9px">${esc(w.en)}</strong>`:''}</p>`}${manual?`<div class="button-row"><button class="sound-button" data-speak="${w.id}">🔊 听示范</button><button class="sound-button" data-slow="${w.id}">🐢 慢速听</button><button class="secondary" data-record="${w.id}" id="record-btn">🎙 录下声音</button></div><div id="rec-status" class="rec-status">录音保留在本地，关闭练习后释放</div><div id="audio-holder"></div><div class="answers"><button class="answer" data-manual="no">还需要再练 🌱</button><button class="answer" data-manual="yes">家长确认：读得不错 ⭐</button></div>`:`<div class="answers">${options.map(o=>`<button class="answer" data-answer="${o.id}">${listening?`<span class="answer-photo">${photo(o,true,true)}</span>${o.zh}`:esc(o.en)}</button>`).join('')}</div>`}<div id="quiz-feedback" aria-live="polite"></div><div class="quiz-footer"><span class="small">${manual?'家长确认，不是自动发音评分':'答错的词会自动进入薄弱词页'}</span><button class="primary" id="quiz-next" disabled>继续 →</button></div>`;
 if(listening)speak(w.en);
}
function answer(id,manual=null){if(!quiz||quiz.answered)return;cleanupRecording();quiz.answered=true;const w=quiz.words[quiz.index];const correct=manual!==null?manual==='yes':id===w.id;feedbackSound(correct);if(correct){quiz.correct++;success(w,quiz.reason,quiz.round);const currentQuiz=quiz,index=quiz.index;answerReadTimer=setTimeout(()=>{if(quiz===currentQuiz&&quiz.index===index&&page==='practice')speak(w.en);},state.sound?480:0);}else mark(w,quiz.reason);
 document.querySelectorAll('#practice-content .answer').forEach(b=>{b.disabled=true;if(b.dataset.answer===w.id||correct&&b.dataset.manual==='yes')b.classList.add('correct');if(!correct&&(b.dataset.answer===id||b.dataset.manual==='no'))b.classList.add('wrong');});$('#quiz-feedback').innerHTML=`<div class="feedback ${correct?'':'needs'}">${correct?'⭐ 很棒，向前迈了一小步！':'🌱 没关系，这个词已收进薄弱词页。'}<br><strong>${esc(w.en)}</strong> — ${w.zh}${correct&&entry(w).reasons.includes(quiz.reason)?` · 这一项已答对 ${entry(w).streak[quiz.reason]}/3 轮`:''}${manual!==null?'<br>本次结果由家长确认。':''}<br><button class="sound-button" data-speak="${w.id}">🔊 ${correct?'再听一遍':'听正确读音'}</button></div>`;$('#quiz-next').disabled=false;
}
function next(){cleanupRecording();releaseAudio();stopSpeech();if(!quiz?.answered)return;quiz.index++;const pending=quiz.words.slice(quiz.index).filter(w=>!isMastered(w));quiz.words=quiz.words.slice(0,quiz.index).concat(pending);const available=(quiz.pool||[]).filter(w=>!isMastered(w));if(available.length&&quiz.words.length<ROUND_SIZE)quiz.words.push(...questionSet(available,true).slice(0,ROUND_SIZE-quiz.words.length));if(quiz.index<quiz.words.length){quizRender();return;}state.rounds++;state.stars+=quiz.correct;save();$('#practice-content').innerHTML=`<div class="modal-top"><span class="muted">这一小轮，完成啦</span><button class="secondary" data-go="home">← 返回首页</button></div><div class="result"><div class="big-icon">🌟</div><h2>又向前走了一小步！</h2><p>这一轮完成 ${quiz.words.length} 题，答对 ${quiz.correct} 题。<br>获得 ${quiz.correct} 颗星星，薄弱词已更新。</p><div class="button-row"><button class="primary" id="result-weak">看看薄弱词 →</button><button class="secondary" id="result-again">再来一轮</button></div></div>`;}
document.addEventListener('click',e=>{
 const b=e.target.closest('button,a');if(!b)return;
 if(b.dataset.page){category='all';query='';libraryPage=0;go(b.dataset.page);}
 else if(b.matches('.brand')){e.preventDefault();go('home');}
 else if(b.dataset.go)go(b.dataset.go);
 else if(b.dataset.category){category=b.dataset.category;query='';libraryPage=0;go('library');}
 else if(b.dataset.libraryPage!==undefined){libraryPage=Number(b.dataset.libraryPage);render();window.scrollTo({top:0,behavior:'smooth'});}
 else if(b.dataset.word){cleanupRecording();releaseAudio();detail(WORDS.find(w=>w.id===b.dataset.word));}
 else if(b.dataset.close)$('#'+b.dataset.close).close();
 else if(b.dataset.speak)speak(WORDS.find(w=>w.id===b.dataset.speak).en);
 else if(b.dataset.slow)speak(WORDS.find(w=>w.id===b.dataset.slow).en,true);
 else if(b.dataset.record)record(WORDS.find(w=>w.id===b.dataset.record));
 else if(b.dataset.mark){mark(WORDS.find(w=>w.id===b.dataset.mark),b.dataset.reason);b.textContent=REASONS[b.dataset.reason]+' ✓';toast('已收进薄弱词页，下次可以优先练习。');render();}
 else if(b.dataset.mastery){const w=WORDS.find(w=>w.id===b.dataset.mastery),done=!isMastered(w);setMastered(w,done);render();toast(done?'已标记掌握，不再出题；可随时取消。':'已取消掌握，重新加入练习。');}
 else if(b.dataset.start)startQuiz(b.dataset.start);
 else if(b.dataset.filter){weakFilter=b.dataset.filter;render();}
 else if(b.dataset.answer)answer(b.dataset.answer);
 else if(b.dataset.manual)answer(null,b.dataset.manual);
 else if(b.id==='quiz-next')next();
 else if(b.id==='result-weak')go('weak');
 else if(b.id==='result-again')startQuiz(quiz.mode);
 else if(b.id==='settings-btn'||b.id==='settings-mobile'){$('#rate').value=String(state.rate);$('#sound-enabled').checked=state.sound;$('#settings-dialog').showModal();}
 else if(b.id==='export-btn'){const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='单词大闯关-学习记录.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 else if(b.id==='sound-test-correct')feedbackSound(true,true);
 else if(b.id==='sound-test-wrong')feedbackSound(false,true);
 else if(b.id==='start-selected-category'){if(practiceCategory==='mixed')startQuiz('mixed');else{category=practiceCategory;startQuiz('category');}}
});
document.addEventListener('change',async e=>{
 if(e.target.id==='pronunciation-category'){pronunciationCategory=e.target.value;render();}
 if(e.target.id==='practice-category'){practiceCategory=e.target.value;}
 if(e.target.id==='category-select'){category=e.target.value;libraryPage=0;render();}
 if(e.target.id==='rate'){state.rate=Number(e.target.value);save();}
 if(e.target.id==='sound-enabled'){state.sound=e.target.checked;save();}
 if(e.target.id==='import-input'){const file=e.target.files[0];if(!file)return;if(file.size>1000000){toast('记录文件太大，请选择本程序导出的 JSON 文件。');return;}try{state=validateState(JSON.parse(await file.text()));save();render();toast('学习记录已导入。');}catch{toast('无法导入，请选择本程序导出的有效学习记录。');}e.target.value='';}
});
document.addEventListener('input',e=>{if(e.target.id==='search'){query=e.target.value;libraryPage=0;const pos=e.target.selectionStart;render();$('#search').focus();$('#search').setSelectionRange(pos,pos);}});
window.addEventListener('pagehide',()=>{cleanupRecording();releaseAudio();stopSpeech();});
render();
