import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import worker from '../cloudflare/worker.mjs';

// Contract tests use the real Worker handler and schema with a D1-shaped SQLite
// adapter. This does not claim to emulate workerd CPU limits or edge hosting.
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'word-cf-contract-'));
const dbPath=path.join(dir,'test.sqlite');let sqlite=new DatabaseSync(dbPath);
class Statement {
 constructor(sql,params=[]){this.sql=sql;this.params=params;}
 bind(...params){return new Statement(this.sql,params);}
 async first(){return sqlite.prepare(this.sql).get(...this.params)||null;}
 async all(){return {results:sqlite.prepare(this.sql).all(...this.params),success:true};}
 execute(){const r=sqlite.prepare(this.sql).run(...this.params);return {success:true,meta:{changes:r.changes}};}
 async run(){return this.execute();}
}
const db={prepare:sql=>new Statement(sql),async batch(statements){
 sqlite.exec('BEGIN');try{const r=statements.map(s=>s.execute());sqlite.exec('COMMIT');return r;}
 catch(e){sqlite.exec('ROLLBACK');throw e;}
}};
const initialMigration=await fs.readFile(new URL('../cloudflare/migrations/0001_initial.sql',import.meta.url),'utf8');
assert.equal(initialMigration,await fs.readFile(new URL('../cloudflare/schema.sql',import.meta.url),'utf8'),'initial migration must match the manual initialization snapshot');
sqlite.exec(initialMigration);
const env={DB:db,ASSETS:{fetch:async()=>new Response('asset',{headers:{'Content-Type':'text/plain'}})}};
async function request(route,{method='GET',data,cookie,csrf,origin,ip='127.0.0.1',raw}={}){
 const headers={'CF-Connecting-IP':ip};if(data!==undefined||raw!==undefined)headers['Content-Type']='application/json';
 if(cookie)headers.Cookie=cookie;if(csrf)headers['X-CSRF-Token']=csrf;if(origin)headers.Origin=origin;
 const r=await worker.fetch(new Request('https://learning.example'+route,{method,headers,body:raw??(data===undefined?undefined:JSON.stringify(data))}),env);
 return {status:r.status,body:await r.json(),cookie:r.headers.get('Set-Cookie')};
}
async function register(username,ip){
 const r=await request('/api/auth/register',{method:'POST',ip,data:{username,password:'TemporaryTestOnly-8731',childName:'测试孩子'}});
 assert.equal(r.status,200,JSON.stringify(r.body));return {cookie:r.cookie.split(';')[0],csrf:r.body.csrf,rawCookie:r.cookie};
}
try{
 assert.equal((await request('/api/health')).body.storage,'D1');
 sqlite.exec('ALTER TABLE progress RENAME TO progress_offline');assert.equal((await request('/api/health')).status,503);sqlite.exec('ALTER TABLE progress_offline RENAME TO progress');
 assert.equal((await worker.fetch(new Request('https://learning.example/api/health'),{})).status,503);
 assert.equal((await request('/api/profiles')).status,401);
 const a=await register('cf_family_a');assert.match(a.rawCookie,/HttpOnly/);assert.match(a.rawCookie,/SameSite=Strict/);assert.match(a.rawCookie,/Secure/);
 assert.equal((await request('/api/auth/register',{method:'POST',data:{username:'cf_family_a',password:'TemporaryTestOnly-8731',childName:'重复'}})).status,409);
 assert.equal((await request('/api/auth/login',{method:'POST',data:{username:'cf_family_a',password:'wrong-password'}})).status,401);
 const first=(await request('/api/profiles',{cookie:a.cookie})).body.profiles[0].id;
 const second=await request('/api/profiles',{method:'POST',cookie:a.cookie,csrf:a.csrf,data:{name:'二号孩子',avatar:'🐼'}});assert.equal(second.status,201);
 assert.equal((await request('/api/profiles',{method:'POST',cookie:a.cookie,data:{name:'无校验'}})).status,403);
 assert.equal((await request('/api/profiles',{method:'POST',cookie:a.cookie,csrf:a.csrf,origin:'https://unrelated.example',data:{name:'跨站'}})).status,403);
 const loaded=await request(`/api/profiles/${first}/progress`,{cookie:a.cookie});assert.equal(loaded.body.data.rate,1);
 const progress={...loaded.body.data,stars:20,rounds:1,sound:false,audioSource:'human',words:{panda:{reasons:['pronunciation'],streak:{pronunciation:1},lastRound:{pronunciation:'round-one'},seen:true,hits:1},invalid_word:{reasons:['meaning']}}};
 const save=()=>request(`/api/profiles/${first}/progress`,{method:'PUT',cookie:a.cookie,csrf:a.csrf,data:{data:progress,revision:0}});
 const races=await Promise.all([save(),save()]);assert.deepEqual(races.map(r=>r.status).sort(),[200,409]);
 sqlite.exec(initialMigration); // Reapplying idempotent initialization must preserve accounts/progress.
 const restored=(await request(`/api/profiles/${first}/progress`,{cookie:a.cookie})).body;
 assert.equal(restored.revision,1);assert.equal(restored.data.sound,false);assert.equal(restored.data.audioSource,'zira');assert.deepEqual(restored.data.words.panda.reasons,['pronunciation']);assert.equal(restored.data.words.invalid_word,undefined);
 assert.equal((await request(`/api/profiles/${second.body.id}/progress`,{cookie:a.cookie})).body.data.stars,0);
 const b=await register('cf_family_b','127.0.0.2');
 assert.equal((await request(`/api/profiles/${first}/progress`,{cookie:b.cookie})).status,404);
 assert.equal((await request(`/api/profiles/${first}/progress`,{method:'PUT',cookie:b.cookie,csrf:b.csrf,data:{data:progress,revision:1}})).status,404);
 assert.equal((await request(`/api/profiles/${second.body.id}`,{method:'PATCH',cookie:a.cookie,csrf:a.csrf,data:{name:'改名孩子',archived:true}})).status,200);
 assert.equal((await request(`/api/profiles/${second.body.id}/progress`,{method:'PUT',cookie:a.cookie,csrf:a.csrf,data:{data:progress,revision:0}})).status,409);
 assert.equal((await request(`/api/profiles/${second.body.id}`,{method:'PATCH',cookie:a.cookie,csrf:a.csrf,data:{archived:false}})).status,200);
 const creations=await Promise.all(Array.from({length:25},(_,i)=>request('/api/profiles',{method:'POST',cookie:a.cookie,csrf:a.csrf,data:{name:'孩子'+i}})));
 assert.equal(creations.filter(r=>r.status===201).length,18);assert.equal((await request('/api/profiles',{cookie:a.cookie})).body.profiles.length,20);
 assert.equal((await request(`/api/profiles/${first}/progress`,{method:'PUT',cookie:a.cookie,csrf:a.csrf,raw:' '.repeat(512001)})).status,413);
 assert.equal((await request(`/api/profiles/${first}/progress`,{method:'PUT',cookie:a.cookie,csrf:a.csrf,raw:'{bad json'})).status,400);
 const u=sqlite.prepare('SELECT * FROM users WHERE username=?').get('cf_family_a');assert.match(u.password_hash,/^pbkdf2-sha256\$100000\$[a-f0-9]{64}$/);assert.equal(u.salt.length,32);
 assert.notEqual(sqlite.prepare('SELECT token_hash FROM sessions WHERE user_id=?').get(u.id).token_hash,a.cookie.split('=')[1]);
 assert.equal((await request('/api/auth/logout',{method:'POST',cookie:a.cookie,csrf:a.csrf,data:{}})).status,200);
 assert.equal((await request('/api/profiles',{cookie:a.cookie})).status,401);
 sqlite.close();sqlite=new DatabaseSync(dbPath);
 const login=await request('/api/auth/login',{method:'POST',data:{username:'cf_family_a',password:'TemporaryTestOnly-8731'}});assert.equal(login.status,200);
 assert.equal((await request(`/api/profiles/${first}/progress`,{cookie:login.cookie.split(';')[0]})).body.data.stars,20);
 for(let i=0;i<20;i++)assert.equal((await request('/api/auth/login',{method:'POST',ip:'127.0.0.3',data:{username:'missing',password:'x'}})).status,401);
 assert.equal((await request('/api/auth/login',{method:'POST',ip:'127.0.0.3',data:{username:'missing',password:'x'}})).status,429);
 const asset=await worker.fetch(new Request('https://learning.example/'),env);assert.equal(await asset.text(),'asset');
 assert.equal((await worker.fetch(new Request('https://learning.example/',{method:'POST'}),env)).status,405);
 console.log('PASS: Worker/D1 contract: auth, Secure cookies, CSRF/origin, atomic saves, family isolation, profile cap, archive/restore, persistence, validation and rate limits. Edge runtime/CPU verification remains a deployment check.');
}finally{sqlite.close();}
