import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const project=fileURLToPath(new URL('../',import.meta.url));
const ZERO='00000000-0000-0000-0000-000000000000';
const uuid=value=>typeof value==='string'&&value!==ZERO&&/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value);

export async function deployCloudflare({root=project,run,dbOnly=false,log=console.log}={}){
 const configPath=path.join(root,'wrangler.jsonc');
 // This repository keeps its .jsonc config as strict JSON; no extra parser dependency.
 const config=JSON.parse(await fs.readFile(configPath,'utf8'));
 const binding=config.d1_databases?.find(d=>d.binding==='DB');
 if(!binding||!binding.database_name)throw Error('缺少 DB 绑定或 database_name。 / Missing DB binding or database_name.');
 if(!run)throw Error('Missing Wrangler runner');
 const listed=async()=>{
  const rows=JSON.parse(await run(['d1','list','--json','--config',configPath],{capture:true}));
  if(!Array.isArray(rows))throw Error('D1 列表格式不正确，已停止部署。 / Unexpected D1 list format.');
  const matches=rows.filter(d=>d.name===binding.database_name);
  if(matches.length>1)throw Error('同名 D1 有多个结果，请明确配置 database_id。 / Ambiguous D1 name; configure its ID.');
  return matches[0];
 };
 if(!binding.database_id||binding.database_id===ZERO){
  let database=await listed();
  if(!database){
   log(`创建 D1 / Creating D1: ${binding.database_name}`);
   await run(['d1','create',binding.database_name,'--config',configPath,'--update-config=false']);
   database=await listed();
  }
  const id=database?.uuid??database?.id;
  if(!uuid(id))throw Error('未取得真实 D1 ID，已停止部署。请在控制台检查 D1 和构建权限。 / No valid D1 ID; check D1 and build permissions.');
  binding.database_id=id;
 }else if(!uuid(binding.database_id))throw Error('database_id 格式不正确，已停止部署。 / Invalid database_id.');
 // Preserve the source template and account-specific IDs supplied by the Dashboard.
 // The resolved config is local to this build, and excluded from Git.
 const absolute=p=>path.resolve(root,p).replaceAll('\\','/');
 config.main=absolute(config.main);
 config.assets.directory=absolute(config.assets.directory);
 for(const d of config.d1_databases)if(d.migrations_dir)d.migrations_dir=absolute(d.migrations_dir);
 delete config.$schema;
 const resolvedPath=path.join(root,'.cloudflare','deploy.json');
 await fs.mkdir(path.dirname(resolvedPath),{recursive:true});
 await fs.writeFile(resolvedPath,JSON.stringify(config,null,2)+'\n');
 log(`D1 已确认 / D1 resolved: ${binding.database_name}; applying migrations`);
 await run(['d1','migrations','apply','DB','--remote','--config',resolvedPath]);
 if(!dbOnly)await run(['deploy','--config',resolvedPath]);
 return {databaseId:binding.database_id,configPath:resolvedPath};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 if(args.some(a=>a!=='--db-only'))throw Error('Unsupported deployment option');
 const wrangler=path.join(project,'node_modules','wrangler','bin','wrangler.js');
 const run=(args,{capture=false}={})=>{
  const result=spawnSync(process.execPath,[wrangler,...args],{cwd:project,env:{...process.env,CI:'true'},encoding:'utf8',stdio:capture?['ignore','pipe','inherit']:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)throw Error('Cloudflare 操作失败，未继续发布。请查看上方错误及 D1 构建权限。 / Cloudflare step failed; check the error above and D1 build permissions.');
  return result.stdout||'';
 };
 try{await deployCloudflare({run,dbOnly:args.includes('--db-only')});}
 catch(error){console.error(error.message);process.exitCode=1;}
}
