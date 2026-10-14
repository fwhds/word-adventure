import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
const project=path.dirname(fileURLToPath(import.meta.url));
const root=path.join(project,'dist');
const port=Number(process.env.PORT||4173);
const dataDir=path.resolve(process.env.WORD_DATA_DIR||path.join(project,'data'));
await fs.mkdir(dataDir,{recursive:true});
const db=new DatabaseSync(path.join(dataDir,'learning.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,salt TEXT NOT NULL,password_hash TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,csrf TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS profiles(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,avatar TEXT NOT NULL,archived INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS progress(profile_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL);`);
const sandbox={};vm.createContext(sandbox);vm.runInContext(await fs.readFile(path.join(root,'vocab.js'),'utf8')+'; globalThis.wordIds=WORDS.map(w=>w.id);',sandbox);
const wordIds=new Set(sandbox.wordIds),scrypt=promisify(crypto.scrypt);
const reasons=['meaning','listening','speaking','pronunciation'],avatars=['🦉','🐼','🦊','🐰','🐱','🐶','🐯','🐸'];
const now=()=>new Date().toISOString();
const blank=()=>({version:1,words:{},stars:0,rounds:0,accent:'en-US',rate:1,sound:true,audioSource:'zira'});
const json=(res,status,data,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data));};
const fail=(status,message)=>Object.assign(new Error(message),{status});
const tokenHash=t=>crypto.createHash('sha256').update(t).digest('hex');
const rates=new Map();
function rateLimit(req){const key=req.socket.remoteAddress,time=Date.now();let slot=rates.get(key);if(!slot||time-slot.start>60000){slot={start:time,count:0};rates.set(key,slot);}if(++slot.count>20)throw fail(429,'尝试过于频繁，请稍后再试。');if(rates.size>1000)for(const [k,v]of rates)if(time-v.start>60000)rates.delete(k);}
async function body(req){if(!req.headers['content-type']?.startsWith('application/json'))throw fail(415,'请使用 JSON 请求。');let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>512000)throw fail(413,'记录文件过大。');chunks.push(c);}try{const b=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!b||typeof b!=='object'||Array.isArray(b))throw Error();return b;}catch{throw fail(400,'请求格式不正确。');}}
function sameOrigin(req){const origin=req.headers.origin;if(origin){try{if(new URL(origin).host!==req.headers.host)throw Error();}catch{throw fail(403,'不允许来自其他网站的请求。');}}if(req.headers['sec-fetch-site']==='cross-site')throw fail(403,'不允许跨站请求。');}
function session(req){const cookie=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('word_session='));if(!cookie)return null;const token=cookie.slice(13);if(!/^[a-f0-9]{64}$/.test(token))return null;return db.prepare('SELECT s.*,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=? AND expires>?').get(tokenHash(token),Date.now());}
function requireSession(req){const s=session(req);if(!s)throw fail(401,'请先登录家长账号。');if(!['GET','HEAD'].includes(req.method)&&req.headers['x-csrf-token']!==s.csrf)throw fail(403,'登录状态校验失败，请刷新页面。');return s;}
function sessionCookie(token,maxAge=7*86400){return `word_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${process.env.COOKIE_SECURE==='1'?'; Secure':''}`;}
function createSession(res,user){db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());const token=crypto.randomBytes(32).toString('hex'),csrf=crypto.randomBytes(24).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(tokenHash(token),user.id,csrf,Date.now()+7*86400000);json(res,200,{user:{id:user.id,username:user.username},csrf},{'Set-Cookie':sessionCookie(token)});}
function profileFor(s,id){const p=db.prepare('SELECT * FROM profiles WHERE id=? AND user_id=?').get(id,s.user_id);if(!p)throw fail(404,'没有找到这个孩子档案。');return p;}
function validName(name){if(typeof name!=='string'||!name.trim()||name.trim().length>24)throw fail(400,'孩子昵称需要 1—24 个字。');return name.trim();}
function validProgress(data){if(!data||data.version!==1||!data.words||typeof data.words!=='object'||Array.isArray(data.words))throw fail(400,'学习记录格式不正确。');const clean=blank();for(const k of ['stars','rounds']){if(!Number.isSafeInteger(data[k])||data[k]<0||data[k]>10000000)throw fail(400,'学习记录数值不正确。');clean[k]=data[k];}clean.accent='en-US';clean.rate=[.65,.8,1].includes(data.rate)?data.rate:1;clean.sound=data.sound!==false;clean.audioSource='zira';for(const [id,w]of Object.entries(data.words)){if(!wordIds.has(id)||!w||typeof w!=='object')continue;const v={reasons:Array.isArray(w.reasons)?[...new Set(w.reasons.filter(r=>reasons.includes(r)))]:[],streak:{},lastRound:{},seen:!!w.seen,hits:Number.isFinite(w.hits)?Math.min(10000000,Math.max(0,Math.floor(w.hits))):0};for(const r of reasons){v.streak[r]=Number.isFinite(w.streak?.[r])?Math.min(3,Math.max(0,Math.floor(w.streak[r]))):0;v.lastRound[r]=typeof w.lastRound?.[r]==='string'?w.lastRound[r].slice(0,100):'';}clean.words[id]=v;}return clean;}
async function api(req,res,url){sameOrigin(req);const method=req.method,p=url.pathname;
 if(p==='/api/auth/register'&&method==='POST'){rateLimit(req);const b=await body(req),username=String(b.username||'').trim().toLowerCase();if(!/^[a-z0-9_.-]{3,32}$/.test(username))throw fail(400,'账号需为 3—32 位英文字母、数字、点、横线或下划线。');if(typeof b.password!=='string'||b.password.length<8||b.password.length>128)throw fail(400,'密码需要 8—128 个字符。');const name=validName(b.childName),salt=crypto.randomBytes(16).toString('hex'),hash=(await scrypt(b.password,salt,64,{N:32768,maxmem:64*1024*1024})).toString('hex'),user={id:crypto.randomUUID(),username},id=crypto.randomUUID();try{db.exec('BEGIN');db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(user.id,username,salt,hash,now());db.prepare('INSERT INTO profiles(id,user_id,name,avatar,created_at) VALUES(?,?,?,?,?)').run(id,user.id,name,'🦉',now());db.prepare('INSERT INTO progress VALUES(?,?,0,?)').run(id,JSON.stringify(blank()),now());db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');if(e.code?.includes('CONSTRAINT')||String(e.message).includes('UNIQUE'))throw fail(409,'这个账号名已被使用。');throw e;}createSession(res,user);return;}
 if(p==='/api/auth/login'&&method==='POST'){rateLimit(req);const b=await body(req),username=String(b.username||'').trim().toLowerCase();if(typeof b.password!=='string'||b.password.length>128)throw fail(400,'账号或密码不正确。');const u=db.prepare('SELECT * FROM users WHERE username=?').get(username),hash=await scrypt(b.password,u?.salt||'00000000000000000000000000000000',64,{N:32768,maxmem:64*1024*1024});if(!u||!crypto.timingSafeEqual(Buffer.from(u.password_hash,'hex'),hash))throw fail(401,'账号或密码不正确。');createSession(res,u);return;}
 if(p==='/api/auth/me'&&method==='GET'){const s=session(req);json(res,200,s?{user:{id:s.user_id,username:s.username},csrf:s.csrf}:{user:null});return;}
 const s=requireSession(req);
 if(p==='/api/auth/logout'&&method==='POST'){db.prepare('DELETE FROM sessions WHERE token_hash=?').run(s.token_hash);json(res,200,{ok:true},{'Set-Cookie':sessionCookie('',0)});return;}
 if(p==='/api/profiles'&&method==='GET'){const list=db.prepare('SELECT p.id,p.name,p.avatar,p.archived,p.created_at,g.data,g.revision,g.updated_at FROM profiles p LEFT JOIN progress g ON g.profile_id=p.id WHERE p.user_id=? ORDER BY p.created_at,p.id').all(s.user_id).map(p=>{const d=JSON.parse(p.data||'{}');return {id:p.id,name:p.name,avatar:p.avatar,archived:!!p.archived,createdAt:p.created_at,updatedAt:p.updated_at,stats:{stars:d.stars||0,rounds:d.rounds||0,weak:Object.values(d.words||{}).filter(w=>w.reasons?.length).length}};});json(res,200,{profiles:list});return;}
 if(p==='/api/profiles'&&method==='POST'){const b=await body(req),name=validName(b.name),avatar=avatars.includes(b.avatar)?b.avatar:'🦉',count=db.prepare('SELECT COUNT(*) n FROM profiles WHERE user_id=?').get(s.user_id).n;if(count>=20)throw fail(400,'一个家长账号最多创建 20 个孩子档案。');const id=crypto.randomUUID();db.exec('BEGIN');try{db.prepare('INSERT INTO profiles(id,user_id,name,avatar,created_at) VALUES(?,?,?,?,?)').run(id,s.user_id,name,avatar,now());db.prepare('INSERT INTO progress VALUES(?,?,0,?)').run(id,JSON.stringify(blank()),now());db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}json(res,201,{id,name,avatar});return;}
 const match=p.match(/^\/api\/profiles\/([a-f0-9-]{36})(\/progress)?$/);
 if(match){const id=match[1],profile=profileFor(s,id);
  if(match[2]&&method==='GET'){const row=db.prepare('SELECT * FROM progress WHERE profile_id=?').get(id);json(res,200,{data:JSON.parse(row.data),revision:row.revision,updatedAt:row.updated_at});return;}
  if(match[2]&&method==='PUT'){if(profile.archived)throw fail(409,'档案已归档，请先恢复。');const b=await body(req);if(!Number.isSafeInteger(b.revision)||b.revision<0)throw fail(400,'版本号不正确。');const data=validProgress(b.data),updatedAt=now(),changed=db.prepare('UPDATE progress SET data=?,revision=revision+1,updated_at=? WHERE profile_id=? AND revision=?').run(JSON.stringify(data),updatedAt,id,b.revision);if(!changed.changes)throw fail(409,'另一台设备更新了记录。请导出当前记录，再重新载入服务器进度。');json(res,200,{revision:b.revision+1,updatedAt});return;}
  if(!match[2]&&method==='PATCH'){const b=await body(req),name=b.name===undefined?profile.name:validName(b.name),avatar=b.avatar===undefined?profile.avatar:avatars.includes(b.avatar)?b.avatar:profile.avatar,archived=b.archived===undefined?profile.archived:b.archived?1:0;db.prepare('UPDATE profiles SET name=?,avatar=?,archived=? WHERE id=? AND user_id=?').run(name,avatar,archived,id,s.user_id);json(res,200,{ok:true});return;}
 }
 throw fail(404,'接口不存在。');
}
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.ogg':'audio/ogg','.mp3':'audio/mpeg','.wav':'audio/wav','.json':'application/json; charset=utf-8'};
const server=http.createServer(async(req,res)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
 try{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/')){await api(req,res,url);return;}if(!['GET','HEAD'].includes(req.method))throw fail(405,'Method not allowed');const pathname=decodeURIComponent(url.pathname),filename=pathname==='/'?'index.html':pathname.replace(/^\/+/, ''),target=path.resolve(root,filename);if(!target.startsWith(root+path.sep))throw fail(403,'Forbidden');const data=await fs.readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:data);}catch(e){if(!res.headersSent)json(res,e.status||(['ENOENT','EISDIR'].includes(e.code)?404:500),{error:e.status?e.message:e.code==='ENOENT'?'没有找到文件。':'服务暂时不可用。'});else res.end();if(!e.status&&!['ENOENT','EISDIR'].includes(e.code))console.error('Request failed:',e.code||e.name);}
});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`Port ${port} is in use. Set PORT to another value.`:e.message);process.exit(1);});
server.listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}\nServing: ${root}\nAccount storage: ${dataDir}`));
process.on('SIGTERM',()=>server.close(()=>{db.close();process.exit(0);}));
