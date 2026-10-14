import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {deployCloudflare} from '../scripts/deploy-cloudflare.mjs';

const template=JSON.parse(await fs.readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
assert.equal(template.d1_databases[0].database_id,undefined,'source cannot carry a fake database ID');
const id='11111111-2222-4333-8444-555555555555';
async function scenario({databaseId,lists=[[{name:'word-adventure',uuid:id}]],failAt,dbOnly=false}={}){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'word-deploy-'));
 const config=structuredClone(template);if(databaseId!==undefined)config.d1_databases[0].database_id=databaseId;
 const original=JSON.stringify(config);await fs.writeFile(path.join(root,'wrangler.jsonc'),original);
 const calls=[];let listIndex=0;
 try{
  const result=await deployCloudflare({root,dbOnly,log(){},run:async(args)=>{
   calls.push(args);if(args.includes(failAt))throw Error('Simulated Cloudflare failure');
   if(args[0]==='d1'&&args[1]==='list')return JSON.stringify(lists[Math.min(listIndex++,lists.length-1)]);
   if(args[1]==='migrations'||args[0]==='deploy'){
    const c=JSON.parse(await fs.readFile(args.at(-1),'utf8'));assert.equal(c.d1_databases[0].database_id,id);
    assert.ok(path.isAbsolute(c.main));assert.ok(path.isAbsolute(c.assets.directory));assert.ok(path.isAbsolute(c.d1_databases[0].migrations_dir));
   }
   return '';
  }});
  assert.equal(result.databaseId,id);assert.equal(await fs.readFile(path.join(root,'wrangler.jsonc'),'utf8'),original,'source config must stay unchanged');
  return calls;
 }catch(error){error.calls=calls;throw error;}
 finally{await fs.rm(root,{recursive:true,force:true});}
}
let calls=await scenario();assert.deepEqual(calls.map(a=>a.slice(0,3)),[['d1','list','--json'],['d1','migrations','apply'],['deploy','--config',calls[2][2]]]);
calls=await scenario({databaseId:'00000000-0000-0000-0000-000000000000'});assert.equal(calls[0][1],'list');
calls=await scenario({databaseId:id});assert.equal(calls.length,2);assert.equal(calls[0][1],'migrations','real configured ID skips account-wide listing');
calls=await scenario({lists:[[],[{name:'word-adventure',uuid:id}]]});assert.equal(calls[1][1],'create');assert.ok(calls[1].includes('--update-config=false'));assert.equal(calls[3][1],'migrations');
calls=await scenario({lists:[[{name:'another-app',uuid:id}],[{name:'word-adventure',uuid:id}]]});assert.equal(calls[1][1],'create','never reuse an unrelated database');
calls=await scenario({dbOnly:true});assert.ok(!calls.some(a=>a[0]==='deploy'));
await assert.rejects(scenario({databaseId:'invalid'}),/Invalid database_id/);
await assert.rejects(scenario({lists:[[{name:'word-adventure',uuid:'00000000-0000-0000-0000-000000000000'}]]}),/No valid D1 ID/);
await assert.rejects(scenario({lists:[[{name:'word-adventure',uuid:id},{name:'word-adventure',uuid:id}]]}),/Ambiguous D1/);
await assert.rejects(scenario({failAt:'list'}),e=>!e.calls.some(a=>a[0]==='deploy'||a[1]==='create'));
await assert.rejects(scenario({failAt:'migrations'}),e=>!e.calls.some(a=>a[0]==='deploy'));
console.log('PASS: existing/created D1, configured ID, legacy placeholder recovery, name isolation, config paths, migration-before-deploy and failure stops. Cloudflare account operations are mocked.');
