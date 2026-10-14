import {WORD_IDS} from '../.cloudflare/word-ids.mjs';

const wordIds=new Set(WORD_IDS);
const reasons=['meaning','listening','speaking','pronunciation'];
const avatars=['🦉','🐼','🦊','🐰','🐱','🐶','🐯','🐸'];
const encoder=new TextEncoder();
const SESSION_MS=7*86400000,MAX_BODY=512000,ITERATIONS=100000;
const now=()=>new Date().toISOString();
const fail=(status,message)=>Object.assign(new Error(message),{status});
const blank=()=>({version:1,words:{},stars:0,rounds:0,accent:'en-US',rate:1,sound:true,audioSource:'zira'});
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const randomHex=size=>hex(crypto.getRandomValues(new Uint8Array(size)));
const digest=async text=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(text)));

function json(status,data,headers={}){
 return new Response(JSON.stringify(data),{status,headers:{
  'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'same-origin',...headers
 }});
}

function sameOrigin(request){
 const origin=request.headers.get('Origin');
 if(origin&&origin!==new URL(request.url).origin)throw fail(403,'不允许来自其他网站的请求。');
 if(request.headers.get('Sec-Fetch-Site')==='cross-site')throw fail(403,'不允许跨站请求。');
}

async function body(request){
 if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))throw fail(415,'请使用 JSON 请求。');
 if(Number(request.headers.get('Content-Length'))>MAX_BODY)throw fail(413,'记录文件过大。');
 const reader=request.body?.getReader();if(!reader)throw fail(400,'请求格式不正确。');
 const chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
  if(size>MAX_BODY){await reader.cancel();throw fail(413,'记录文件过大。');}chunks.push(value);
 }}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}
 try{const b=JSON.parse(new TextDecoder().decode(bytes));if(!b||typeof b!=='object'||Array.isArray(b))throw Error();return b;}
 catch{throw fail(400,'请求格式不正确。');}
}

async function passwordHash(password,salt){
 const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
 const hash=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations:ITERATIONS},key,256);
 return 'pbkdf2-sha256$'+ITERATIONS+'$'+hex(hash);
}
function equal(a,b){let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0;}

async function rateLimit(request,db){
 const ip=request.headers.get('CF-Connecting-IP')||'local-preview';
 const key=await digest('word-auth:'+ip),time=Date.now();
 const r=await db.prepare(`INSERT INTO auth_limits(key,attempts,expires) VALUES(?,1,?)
 ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires<=? THEN 1 ELSE attempts+1 END,
 expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END RETURNING attempts`).bind(key,time+60000,time,time).first();
 if(r.attempts>20)throw fail(429,'尝试过于频繁，请稍后再试。');
}

async function session(request,db){
 const token=request.headers.get('Cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('word_session='))?.slice(13);
 if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
 return db.prepare('SELECT s.*,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=? AND expires>?').bind(await digest(token),Date.now()).first();
}
async function requireSession(request,db){
 const s=await session(request,db);if(!s)throw fail(401,'请先登录家长账号。');
 if(!['GET','HEAD'].includes(request.method)&&request.headers.get('X-CSRF-Token')!==s.csrf)throw fail(403,'登录状态校验失败，请刷新页面。');
 return s;
}
function cookie(request,token,maxAge=7*86400){
 return `word_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(request.url).protocol==='https:'?'; Secure':''}`;
}
async function createSession(request,db,user){
 const token=randomHex(32),csrf=randomHex(24),time=Date.now();
 await db.batch([
  db.prepare('DELETE FROM sessions WHERE expires<=?').bind(time),
  db.prepare('DELETE FROM auth_limits WHERE expires<=?').bind(time-86400000),
  db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').bind(await digest(token),user.id,csrf,time+SESSION_MS)
 ]);
 return json(200,{user:{id:user.id,username:user.username},csrf},{'Set-Cookie':cookie(request,token)});
}
async function profileFor(s,id,db){
 const p=await db.prepare('SELECT * FROM profiles WHERE id=? AND user_id=?').bind(id,s.user_id).first();
 if(!p)throw fail(404,'没有找到这个孩子档案。');return p;
}
function validName(name){
 if(typeof name!=='string'||!name.trim()||name.trim().length>24)throw fail(400,'孩子昵称需要 1—24 个字。');return name.trim();
}
function validProgress(data){
 if(!data||data.version!==1||!data.words||typeof data.words!=='object'||Array.isArray(data.words))throw fail(400,'学习记录格式不正确。');
 const clean=blank();
 for(const k of ['stars','rounds']){if(!Number.isSafeInteger(data[k])||data[k]<0||data[k]>10000000)throw fail(400,'学习记录数值不正确。');clean[k]=data[k];}
 clean.accent='en-US';
 clean.rate=[.65,.8,1].includes(data.rate)?data.rate:1;clean.sound=data.sound!==false;
 clean.audioSource='zira';
 for(const [id,w]of Object.entries(data.words)){
  if(!wordIds.has(id)||!w||typeof w!=='object'||Array.isArray(w))continue;
  const v={reasons:Array.isArray(w.reasons)?[...new Set(w.reasons.filter(r=>reasons.includes(r)))]:[],streak:{},lastRound:{},seen:!!w.seen,hits:Number.isFinite(w.hits)?Math.min(10000000,Math.max(0,Math.floor(w.hits))):0};
  for(const r of reasons){v.streak[r]=Number.isFinite(w.streak?.[r])?Math.min(3,Math.max(0,Math.floor(w.streak[r]))):0;v.lastRound[r]=typeof w.lastRound?.[r]==='string'?w.lastRound[r].slice(0,100):'';}
  clean.words[id]=v;
 }return clean;
}

async function api(request,env){
 sameOrigin(request);const db=env.DB,method=request.method,p=new URL(request.url).pathname;
 if(!db)throw fail(503,'Cloudflare 数据库尚未绑定，请按部署说明配置 DB。');
 if(p==='/api/health'&&method==='GET'){
  try{for(const table of ['users','sessions','profiles','progress','auth_limits'])await db.prepare(`SELECT 1 FROM ${table} LIMIT 1`).first();}
  catch{throw fail(503,'D1 尚未初始化，请在数据库 Console 执行 schema.sql。');}
  return json(200,{ok:true,storage:'D1'});
 }
 if(p==='/api/auth/register'&&method==='POST'){
  await rateLimit(request,db);const b=await body(request),username=String(b.username||'').trim().toLowerCase();
  if(!/^[a-z0-9_.-]{3,32}$/.test(username))throw fail(400,'账号需为 3—32 位英文字母、数字、点、横线或下划线。');
  if(typeof b.password!=='string'||b.password.length<8||b.password.length>128)throw fail(400,'密码需要 8—128 个字符。');
  const name=validName(b.childName),salt=randomHex(16),hash=await passwordHash(b.password,salt),user={id:crypto.randomUUID(),username},id=crypto.randomUUID(),time=now();
  try{await db.batch([
   db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').bind(user.id,username,salt,hash,time),
   db.prepare('INSERT INTO profiles(id,user_id,name,avatar,created_at) VALUES(?,?,?,?,?)').bind(id,user.id,name,'🦉',time),
   db.prepare('INSERT INTO progress VALUES(?,?,0,?)').bind(id,JSON.stringify(blank()),time)
  ]);}catch(e){if(String(e.message).includes('UNIQUE constraint failed: users.username'))throw fail(409,'这个账号名已被使用。');throw e;}
  return createSession(request,db,user);
 }
 if(p==='/api/auth/login'&&method==='POST'){
  await rateLimit(request,db);const b=await body(request),username=String(b.username||'').trim().toLowerCase();
  if(typeof b.password!=='string'||b.password.length>128)throw fail(400,'账号或密码不正确。');
  const u=await db.prepare('SELECT * FROM users WHERE username=?').bind(username).first();
  const hash=await passwordHash(b.password,u?.salt||'00000000000000000000000000000000');
  if(!u||!equal(u.password_hash,hash))throw fail(401,'账号或密码不正确。');
  return createSession(request,db,u);
 }
 if(p==='/api/auth/me'&&method==='GET'){
  const s=await session(request,db);return json(200,s?{user:{id:s.user_id,username:s.username},csrf:s.csrf}:{user:null});
 }
 const s=await requireSession(request,db);
 if(p==='/api/auth/logout'&&method==='POST'){
  await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(s.token_hash).run();return json(200,{ok:true},{'Set-Cookie':cookie(request,'',0)});
 }
 if(p==='/api/profiles'&&method==='GET'){
  const {results}=await db.prepare('SELECT p.id,p.name,p.avatar,p.archived,p.created_at,g.data,g.revision,g.updated_at FROM profiles p LEFT JOIN progress g ON g.profile_id=p.id WHERE p.user_id=? ORDER BY p.created_at,p.id').bind(s.user_id).all();
  return json(200,{profiles:results.map(p=>{const d=JSON.parse(p.data||'{}');return {id:p.id,name:p.name,avatar:p.avatar,archived:!!p.archived,createdAt:p.created_at,updatedAt:p.updated_at,stats:{stars:d.stars||0,rounds:d.rounds||0,weak:Object.values(d.words||{}).filter(w=>w.reasons?.length).length}};})});
 }
 if(p==='/api/profiles'&&method==='POST'){
  const b=await body(request),name=validName(b.name),avatar=avatars.includes(b.avatar)?b.avatar:'🦉',id=crypto.randomUUID(),time=now();
  // The count check is part of the insert, so simultaneous requests cannot exceed the limit.
  const result=await db.batch([
   db.prepare('INSERT INTO profiles(id,user_id,name,avatar,created_at) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM profiles WHERE user_id=?)<20').bind(id,s.user_id,name,avatar,time,s.user_id),
   db.prepare('INSERT INTO progress SELECT ?,?,0,? WHERE EXISTS(SELECT 1 FROM profiles WHERE id=?)').bind(id,JSON.stringify(blank()),time,id)
  ]);
  if(!result[0].meta.changes)throw fail(400,'一个家长账号最多创建 20 个孩子档案。');
  return json(201,{id,name,avatar});
 }
 const match=p.match(/^\/api\/profiles\/([a-f0-9-]{36})(\/progress)?$/);
 if(match){
  const id=match[1],profile=await profileFor(s,id,db);
  if(match[2]&&method==='GET'){
   const row=await db.prepare('SELECT * FROM progress WHERE profile_id=?').bind(id).first();
   return json(200,{data:JSON.parse(row.data),revision:row.revision,updatedAt:row.updated_at});
  }
  if(match[2]&&method==='PUT'){
   if(profile.archived)throw fail(409,'档案已归档，请先恢复。');
   const b=await body(request);if(!Number.isSafeInteger(b.revision)||b.revision<0)throw fail(400,'版本号不正确。');
   const data=validProgress(b.data),updatedAt=now();
   const changed=await db.prepare('UPDATE progress SET data=?,revision=revision+1,updated_at=? WHERE profile_id=? AND revision=? AND EXISTS(SELECT 1 FROM profiles WHERE id=? AND user_id=? AND archived=0)').bind(JSON.stringify(data),updatedAt,id,b.revision,id,s.user_id).run();
   if(!changed.meta.changes)throw fail(409,'另一台设备更新了记录或档案已归档。请导出当前记录，再重新载入服务器进度。');
   return json(200,{revision:b.revision+1,updatedAt});
  }
  if(!match[2]&&method==='PATCH'){
   const b=await body(request),name=b.name===undefined?profile.name:validName(b.name),avatar=b.avatar===undefined?profile.avatar:avatars.includes(b.avatar)?b.avatar:profile.avatar,archived=b.archived===undefined?profile.archived:b.archived?1:0;
   await db.prepare('UPDATE profiles SET name=?,avatar=?,archived=? WHERE id=? AND user_id=?').bind(name,avatar,archived,id,s.user_id).run();return json(200,{ok:true});
  }
 }
 throw fail(404,'接口不存在。');
}

export default {
 async fetch(request,env){
  try{
   const url=new URL(request.url);
   if(url.pathname.startsWith('/api/'))return await api(request,env);
   if(!['GET','HEAD'].includes(request.method))throw fail(405,'Method not allowed');
   return env.ASSETS.fetch(request);
  }catch(e){
   if(!e.status)console.error('Word Adventure Worker request failed');
   return json(e.status||500,{error:e.status?e.message:'服务暂时不可用，请检查 Worker 的数据库配置。'});
  }
 }
};
