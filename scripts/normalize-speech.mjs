import fs from 'node:fs';import vm from 'node:vm';
const file=new URL('../dist/synth-audio.js',import.meta.url),ctx=vm.createContext({});vm.runInContext(fs.readFileSync(file,'utf8')+';this.items=WORD_SYNTH_AUDIO;',ctx);
for(const v of Object.values(ctx.items))v.kind='Local system synthesis';
fs.writeFileSync(file,'const WORD_SYNTH_AUDIO = '+JSON.stringify(ctx.items,null,2)+';\n');
