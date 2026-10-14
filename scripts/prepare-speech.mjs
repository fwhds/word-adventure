import fs from 'node:fs';
import vm from 'node:vm';
const context=vm.createContext({});vm.runInContext(fs.readFileSync(new URL('../dist/vocab.js',import.meta.url),'utf8')+';this.items=WORDS.map(w=>({id:w.id,en:w.en}));',context);
fs.writeFileSync(new URL('./speech-words.json',import.meta.url),JSON.stringify(context.items,null,2));
