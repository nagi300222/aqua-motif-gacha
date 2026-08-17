#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..'),data=path.join(root,'data'),context={window:{}};vm.createContext(context);
for(const file of fs.readdirSync(data).filter(f=>/^species-.*\.js$/.test(f)).sort())vm.runInContext(fs.readFileSync(path.join(data,file),'utf8'),context,{filename:file});
const candidates=context.window.AQUA_SPECIES,before=JSON.stringify(candidates),normalize=x=>x.normalize('NFKC').trim().toLocaleLowerCase('en-US'),jp=/[ぁ-んァ-ヶ一-龠]/u;
assert.equal(candidates.length,6000,'candidate total');assert.equal(new Set(candidates.map(normalize)).size,6000,'normalized candidate duplicates');
const aliasCode=fs.readFileSync(path.join(data,'ja-names.js'),'utf8');vm.runInContext(aliasCode,context,{filename:'ja-names.js'});assert.equal(JSON.stringify(candidates),before,'candidate data changed while loading aliases');
const aliases=context.window.AQUA_JA_NAMES,sources=JSON.parse(fs.readFileSync(path.join(data,'ja-sources.json'))),pool=new Set(candidates),entries=Object.entries(aliases);
assert.equal(entries.length,521,'alias total');assert.equal(Object.keys(sources).length,entries.length,'source coverage');
for(const [key,value] of entries){assert(pool.has(key),`candidate missing: ${key}`);assert(value&&jp.test(value),`empty/non-Japanese alias: ${key}`);assert(/^https:\/\/www\.godac\.jamstec\.go\.jp\/bismal\/j\/view\/\d+$/.test(sources[key]),`invalid source: ${key}`)}
const literalKeys=[...aliasCode.matchAll(/^\s*"([^"]+)"\s*:/gm)].map(x=>x[1]);assert.equal(literalKeys.length,new Set(literalKeys).size,'duplicate literal keys');
for(const [key,value] of Object.entries({'Arothron meleagris':'ミゾレフグ','Arothron stellatus':'モヨウフグ','Euprymna berryi':'ニヨリミミイカ','Gymnothorax kidako':'ウツボ','Turritopsis dohrnii':'チチュウカイベニクラゲ'}))assert.equal(aliases[key],value,`known regression: ${key}`);
assert(!aliases['Gymnothorax favagineus']);assert(!aliases['Carassius auratus']);
const builtin=candidates.filter(x=>jp.test(x)).length,localized=candidates.filter(x=>jp.test(x)||aliases[x]).length;assert.deepEqual({builtin,localized,unlocalized:6000-localized},{builtin:604,localized:1125,unlocalized:4875});
console.log(JSON.stringify({candidates:6000,normalized_duplicates:0,builtin,aliases:entries.length,localized,unlocalized:6000-localized,source_coverage:`${Object.keys(sources).length}/${entries.length}`,outside_candidate_keys:0,empty_values:0,duplicate_keys:0,known_regressions:0}));
