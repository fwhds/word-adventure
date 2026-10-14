import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8',windowsHide:true}).split('\0').filter(Boolean);
const binary=new Set(['.jpg','.jpeg','.png','.webp','.mp3','.wav','.ogg']);
const secret=/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9_-]{24,}|AKIA[A-Z0-9]{16}|xox[baprs]-[A-Za-z0-9-]{20,})/;
const errors=[];let total=0,textFiles=0,max={size:0,file:''};
for(const file of [...new Set(files)]){
 if(/(^|\/)(data|node_modules|\.tool-runtime|\.cloudflare|\.wrangler)(\/|$)|(^|\/)\.env(?:\.|$)|\.sqlite(?:-|$)|\.log$|\/qa\//.test(file)){errors.push('Private/generated path: '+file);continue;}
 const bytes=fs.readFileSync(path.join(root,file));total+=bytes.length;
 if(bytes.length>max.size)max={size:bytes.length,file};
 if(bytes.length>20*1024*1024)errors.push('Unexpected large file: '+file);
 if(binary.has(path.extname(file).toLowerCase()))continue;
 textFiles++;let text;
 try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{errors.push('Invalid UTF-8: '+file);continue;}
 if(secret.test(text))errors.push('Possible secret (value suppressed): '+file);
 if(text.includes('\0'))errors.push('Unexpected binary content: '+file);
}
if(errors.length){for(const e of errors)console.error(e);process.exitCode=1;}
else console.log(`PASS: ${files.length} publishable files (${textFiles} UTF-8 text), ${(total/1024/1024).toFixed(1)} MiB total; largest ${(max.size/1024/1024).toFixed(2)} MiB (${max.file}); no credential patterns or private runtime files detected.`);
