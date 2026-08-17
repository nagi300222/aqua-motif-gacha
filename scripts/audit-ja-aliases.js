#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..'),data=path.join(root,'data'),context={window:{}};vm.createContext(context);
for(const file of fs.readdirSync(data).filter(f=>/^species-.*\.js$/.test(f)).sort())vm.runInContext(fs.readFileSync(path.join(data,file),'utf8'),context,{filename:file});
const candidates=context.window.AQUA_SPECIES,before=JSON.stringify(candidates),normalize=x=>x.normalize('NFKC').trim().toLocaleLowerCase('en-US'),jp=/[ぁ-んァ-ヶ一-龠]/u;
assert.equal(candidates.length,6000,'candidate total');assert.equal(new Set(candidates.map(normalize)).size,6000,'normalized candidate duplicates');
const aliasCode=fs.readFileSync(path.join(data,'ja-names.js'),'utf8');vm.runInContext(aliasCode,context,{filename:'ja-names.js'});assert.equal(JSON.stringify(candidates),before,'candidate data changed while loading aliases');
const aliases=context.window.AQUA_JA_NAMES,sources=JSON.parse(fs.readFileSync(path.join(data,'ja-sources.json'))),pool=new Set(candidates),entries=Object.entries(aliases);
assert.equal(entries.length,565,'alias total');assert.equal(Object.keys(sources).length,entries.length,'source coverage');
const sourcePatterns=[/^https:\/\/www\.godac\.jamstec\.go\.jp\/bismal\/j\/view\/\d+$/, /^https:\/\/fishpix\.kahaku\.go\.jp\/fishimage\/search\?SPECIES=.+&SPECIES_OPT=1$/];
for(const [key,value] of entries){assert(pool.has(key),`candidate missing: ${key}`);assert(value&&jp.test(value),`empty/non-Japanese alias: ${key}`);assert(sourcePatterns.some(pattern=>pattern.test(sources[key])),`invalid source: ${key}`)}
const literalKeys=[...aliasCode.matchAll(/^\s*"([^"]+)"\s*:/gm)].map(x=>x[1]);assert.equal(literalKeys.length,new Set(literalKeys).size,'duplicate literal keys');
for(const [key,value] of Object.entries({'Arothron meleagris':'ミゾレフグ','Arothron stellatus':'モヨウフグ','Euprymna berryi':'ニヨリミミイカ','Gymnothorax kidako':'ウツボ','Turritopsis dohrnii':'チチュウカイベニクラゲ'}))assert.equal(aliases[key],value,`known regression: ${key}`);
assert(!aliases['Gymnothorax favagineus']);assert(!aliases['Carassius auratus']);
const phase2=JSON.parse(fs.readFileSync(path.join(data,'ja-phase2-status.json'))),phase2Counts={};
for(const result of Object.values(phase2))phase2Counts[result.status]=(phase2Counts[result.status]||0)+1;
assert.equal(Object.keys(phase2).length,4875,'Phase 2 final statuses');assert(!phase2Counts.error,'Phase 2 network errors');
assert.equal(phase2Counts.verified,44,'Phase 2 verified count');
const builtin=candidates.filter(x=>jp.test(x)).length,localized=candidates.filter(x=>jp.test(x)||aliases[x]).length;assert.deepEqual({builtin,localized,unlocalized:6000-localized},{builtin:604,localized:1169,unlocalized:4831});
console.log(JSON.stringify({candidates:6000,normalized_duplicates:0,builtin,aliases:entries.length,localized,unlocalized:6000-localized,source_coverage:`${Object.keys(sources).length}/${entries.length}`,phase2_statuses:Object.keys(phase2).length,phase2_counts:phase2Counts,outside_candidate_keys:0,empty_values:0,duplicate_keys:0,known_regressions:0}));
