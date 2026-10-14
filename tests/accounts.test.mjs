import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
const project=fileURLToPath(new URL('../',import.meta.url));
const testDir=await fs.mkdtemp(path.join(os.tmpdir(),'word-adventure-test-'));
const port=4185,base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['server.mjs'],{cwd:project,env:{...process.env,PORT:String(port),WORD_DATA_DIR:testDir},stdio:['ignore','pipe','pipe'],windowsHide:true});
let logs='';server.stderr.on('data',b=>logs+=b);server.stdout.on('data',b=>logs+=b);
async function request(route,{method='GET',data,cookie,csrf,origin}={}){const headers={};if(data!==undefined)headers['Content-Type']='application/json';if(cookie)headers.Cookie=cookie;if(csrf)headers['X-CSRF-Token']=csrf;if(origin)headers.Origin=origin;const res=await fetch(base+route,{method,headers,body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(5000)});return {status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie')};}
async function register(username){const r=await request('/api/auth/register',{method:'POST',data:{username,password:'TemporaryTestOnly-8731',childName:'测试孩子'}});assert.equal(r.status,200);return {cookie:r.cookie.split(';')[0],csrf:r.body.csrf,rawCookie:r.cookie};}
try{
 await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Server did not start: '+logs)),8000);server.stdout.on('data',b=>{if(b.toString().includes('Local:')){clearTimeout(timeout);resolve();}});server.on('exit',code=>{clearTimeout(timeout);reject(Error('Server exited: '+code+' '+logs));});});
 assert.equal((await request('/api/profiles')).status,401);
 const a=await register('test_family_a');assert.match(a.rawCookie,/HttpOnly/);assert.match(a.rawCookie,/SameSite=Strict/);
 const duplicate=await request('/api/auth/register',{method:'POST',data:{username:'test_family_a',password:'TemporaryTestOnly-8731',childName:'重复'}});assert.equal(duplicate.status,409);
 assert.equal((await request('/api/auth/login',{method:'POST',data:{username:'test_family_a',password:'wrong-password'}})).status,401);
 let list=await request('/api/profiles',{cookie:a.cookie});assert.equal(list.status,200);assert.equal(list.body.profiles.length,1);const first=list.body.profiles[0].id;
 const second=await request('/api/profiles',{method:'POST',cookie:a.cookie,csrf:a.csrf,data:{name:'另一个孩子',avatar:'🐼'}});assert.equal(second.status,201);
 assert.equal((await request('/api/profiles',{method:'POST',cookie:a.cookie,data:{name:'不能绕过校验'}})).status,403);
 assert.equal((await request('/api/profiles',{method:'POST',cookie:a.cookie,csrf:a.csrf,origin:'https://unrelated.example',data:{name:'不能跨站创建'}})).status,403);
 const p=await request(`/api/profiles/${first}/progress`,{cookie:a.cookie});assert.equal(p.body.revision,0);
 const progress={...p.body.data,stars:9,rounds:2,sound:false,audioSource:'human',words:{panda:{reasons:['meaning'],streak:{meaning:1},lastRound:{meaning:'test-round'},seen:true,hits:1,mastered:true},cat:{reasons:[],hits:0,mastered:true},dog:{reasons:[],hits:3},apple:{reasons:[],hits:5,mastered:false}}};
 let result=await request(`/api/profiles/${first}/progress`,{method:'PUT',cookie:a.cookie,csrf:a.csrf,data:{revision:0,data:progress}});assert.equal(result.status,200);assert.equal(result.body.revision,1);
 assert.equal((await request(`/api/profiles/${first}/progress`,{method:'PUT',cookie:a.cookie,csrf:a.csrf,data:{revision:0,data:progress}})).status,409);
 const loaded=await request(`/api/profiles/${first}/progress`,{cookie:a.cookie});assert.equal(loaded.body.data.stars,9);assert.equal(loaded.body.data.sound,false);assert.equal(loaded.body.data.audioSource,'zira');assert.deepEqual(loaded.body.data.words.panda.reasons,['meaning']);
 assert.equal((await request(`/api/profiles/${second.body.id}/progress`,{cookie:a.cookie})).body.data.stars,0);
 assert.equal(loaded.body.data.words.cat.mastered,true);assert.equal(loaded.body.data.words.panda.mastered,false);
 assert.equal(loaded.body.data.words.dog.mastered,true);assert.equal(loaded.body.data.words.apple.mastered,false);
 const b=await register('test_family_b');assert.equal((await request(`/api/profiles/${first}/progress`,{cookie:b.cookie})).status,404);assert.equal((await request(`/api/profiles/${first}/progress`,{method:'PUT',cookie:b.cookie,csrf:b.csrf,data:{revision:1,data:progress}})).status,404);
 const races=await Promise.all([1,2].map(()=>request(`/api/profiles/${first}/progress`,{method:'PUT',cookie:a.cookie,csrf:a.csrf,data:{revision:1,data:progress}})));assert.deepEqual(races.map(r=>r.status).sort(),[200,409]);
 const renamed=await request(`/api/profiles/${second.body.id}`,{method:'PATCH',cookie:a.cookie,csrf:a.csrf,data:{name:'修改昵称',archived:true}});assert.equal(renamed.status,200);assert.equal((await request(`/api/profiles/${second.body.id}/progress`,{method:'PUT',cookie:a.cookie,csrf:a.csrf,data:{revision:0,data:progress}})).status,409);
 assert.equal((await request(`/api/profiles/${second.body.id}`,{method:'PATCH',cookie:a.cookie,csrf:a.csrf,data:{archived:false}})).status,200);
 const db=new DatabaseSync(path.join(testDir,'learning.sqlite'));const row=db.prepare('SELECT salt,password_hash FROM users WHERE username=?').get('test_family_a');assert.notEqual(row.password_hash,'TemporaryTestOnly-8731');assert.equal(row.password_hash.length,128);assert.equal(row.salt.length,32);db.close();
 assert.equal((await fetch(base+'/data/learning.sqlite')).status,404);
 assert.equal((await request('/api/auth/logout',{method:'POST',cookie:a.cookie,csrf:a.csrf,data:{}})).status,200);assert.equal((await request('/api/profiles',{cookie:a.cookie})).status,401);
 const login=await request('/api/auth/login',{method:'POST',data:{username:'test_family_a',password:'TemporaryTestOnly-8731'}});assert.equal(login.status,200);const cookie=login.cookie.split(';')[0];assert.equal((await request(`/api/profiles/${first}/progress`,{cookie})).body.data.stars,9);
 console.log('PASS: registration, login, profile isolation, server persistence, sound preference, CSRF, cross-account access, revision conflicts, archive/restore, password hashing and logout.');
}finally{server.kill('SIGTERM');await new Promise(resolve=>server.on('exit',resolve));}
