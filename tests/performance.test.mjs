import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import vm from 'node:vm';
const assets=new URL('../.cloudflare/assets/',import.meta.url);
const html=await fs.readFile(new URL('index.html',assets),'utf8');
const scripts=[...html.matchAll(/<script([^>]*)src="([^"]+)"/g)];
assert.equal(scripts.length,1,'production HTML loads one runtime instead of five serialized scripts');
assert.match(scripts[0][1],/\bdefer\b/);
const script=scripts[0][2],style=html.match(/rel="stylesheet" href="([^"]+)"/)[1];
for(const file of [script,style]){
 const contents=await fs.readFile(new URL(file,assets));
 const hash=createHash('sha256').update(contents).digest('hex').slice(0,16);
 assert.ok(file.includes('.'+hash+'.'),'cache keys must change when content changes');
}
const runtime=await fs.readFile(new URL(script,assets),'utf8');new vm.Script(runtime);
assert.ok(gzipSync(runtime).length<65000,'compressed initial runtime has a bounded size');
assert.ok(runtime.indexOf('const WORDS')<runtime.indexOf('function render()'));
const headers=await fs.readFile(new URL('_headers',assets),'utf8');
assert.match(headers,/\/assets\/cards\/\*\s+Cache-Control: public, max-age=31536000, immutable/);
assert.match(headers,/\/assets\/runtime\/\*\s+Cache-Control: public, max-age=31536000, immutable/);
const globalRule=headers.split(/(?=^\/)/m).find(rule=>rule.startsWith('/*\n'));
assert.doesNotMatch(globalRule,/Cache-Control:/,'broad cache rules must not conflict with fingerprinted asset rules');
assert.doesNotMatch(html,/<script[^>]+src="(?:vocab|photos|synth-audio|app|accounts)\.js"/);
console.log('PASS: production uses one deferred, content-hashed runtime; versioned CSS/cards have nonconflicting long cache rules, and compressed startup size remains bounded.');
