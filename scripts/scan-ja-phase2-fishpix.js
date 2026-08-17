#!/usr/bin/env node
'use strict';

/**
 * Phase 2: check every candidate left unlocalized after the BISMaL pass against
 * the National Museum of Nature and Science FishPix database.
 *
 * FishPix stores the author citation in its scientific-name field, so its
 * "exact" option cannot find a bare candidate binomial.  We therefore request
 * a partial match, then accept a row only when the displayed scientific name is
 * exactly the candidate followed by an optional parenthesized author citation.
 * All exact rows must also agree on one Japanese name.  Every other candidate
 * receives a terminal, auditable status rather than being silently omitted.
 *
 * Usage: node scripts/scan-ja-phase2-fishpix.js [--concurrency 12]
 *        [--resume /tmp/aqua-ja-phase2.json]
 */
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const {execFile}=require('child_process');
const {promisify}=require('util');
const curl=promisify(execFile);

const ROOT=path.resolve(__dirname,'..');
const args=process.argv.slice(2);
function option(name,fallback){const i=args.indexOf(name);return i<0?fallback:args[i+1]}
const concurrency=Math.max(1,Number(option('--concurrency','12'))||12);
const resume=path.resolve(option('--resume',path.join(ROOT,'data','ja-phase2-status.json')));
const endpoint='https://fishpix.kahaku.go.jp/fishimage/search';
const japanese=/[\u3040-\u30ff\u3400-\u9fff]/u;
const scientific=/^[A-Z][a-z-]+ [a-z][a-z-]+(?: [a-z][a-z-]+)?$/;
const context={window:{}};vm.createContext(context);
for(const file of fs.readdirSync(path.join(ROOT,'data')).filter(f=>/^species-.*\.js$/.test(f)).sort())
  vm.runInContext(fs.readFileSync(path.join(ROOT,'data',file),'utf8'),context,{filename:file});
vm.runInContext(fs.readFileSync(path.join(ROOT,'data','ja-names.js'),'utf8'),context,{filename:'ja-names.js'});
const candidates=context.window.AQUA_SPECIES;
const oldNames=context.window.AQUA_JA_NAMES;
const oldSources=JSON.parse(fs.readFileSync(path.join(ROOT,'data','ja-sources.json'),'utf8'));
// FishPix aliases from an earlier Phase 2 run are outputs, not a reason to
// shrink the fixed input set when the command is rerun.
const baseNames=Object.fromEntries(Object.entries(oldNames).filter(([key])=>!String(oldSources[key]||'').startsWith(endpoint)));
if(candidates.length!==6000)throw new Error(`Expected 6000 candidates, got ${candidates.length}`);
const targets=candidates.filter(name=>!japanese.test(name)&&!Object.hasOwn(baseNames,name));
if(targets.length!==4875)throw new Error(`Expected 4875 Phase 2 targets, got ${targets.length}`);
let results=fs.existsSync(resume)?JSON.parse(fs.readFileSync(resume,'utf8')):{};
// A changed pool/alias map must never inherit a stale terminal result.
for(const key of Object.keys(results))if(!targets.includes(key))delete results[key];
const decode=s=>s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#(?:39|x27);/gi,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function parseRows(html,candidate){
  const spans=[...html.matchAll(/<span\s+class="(result|resultHelvetica)"[^>]*>([\s\S]*?)<\/span>/gi)]
    .map(match=>({kind:match[1].toLowerCase(),text:decode(match[2])}));
  const rows=[];
  for(let i=0;i<spans.length-1;i++)if(spans[i].kind==='result'&&spans[i+1].kind==='resulthelvetica'){
    const scientificName=spans[i+1].text;
    if(scientificName===candidate||scientificName.startsWith(`${candidate} (`))rows.push({alias:spans[i].text,scientificName});
  }
  return rows;
}
async function check(candidate){
  if(!scientific.test(candidate))return {status:'not-species-scientific-name'};
  let last;
  for(let attempt=0;attempt<5;attempt++)try{
    const {stdout}=await curl('curl',['-fsS','--max-time','45','--retry','2','--get','--data-urlencode',`SPECIES=${candidate}`,'--data','SPECIES_OPT=1','-A','AQUA-MOTIF-GACHA/2.0 (Japanese-name source audit)',endpoint],{encoding:'buffer',maxBuffer:8*1024*1024});
    const html=new TextDecoder('shift_jis').decode(stdout);
    const rows=parseRows(html,candidate);
    if(!rows.length)return {status:'no-exact-record'};
    const aliases=[...new Set(rows.map(row=>row.alias).filter(alias=>japanese.test(alias)))];
    if(!aliases.length)return {status:'no-japanese-name'};
    if(aliases.length!==1)return {status:'conflicting-japanese-names',aliases};
    // FishPix occasionally labels an aquarium hybrid photo with both parent
    // names even though one parent's scientific name occupies the species
    // field.  That label is not a Japanese name for the candidate taxon.
    if(/[×xX]/u.test(aliases[0]))return {status:'non-taxon-japanese-label',alias:aliases[0]};
    const url=`${endpoint}?SPECIES=${encodeURIComponent(candidate)}&SPECIES_OPT=1`;
    return {status:'verified',alias:aliases[0],url,matching_records:rows.length};
  }catch(error){last=error;await pause(500*2**attempt)}
  return {status:'error',error:String(last)};
}
let completed=targets.filter(x=>Object.hasOwn(results,x)&&results[x].status!=='error').length;
let dirty=0;
function save(){fs.writeFileSync(resume,JSON.stringify(Object.fromEntries(targets.filter(x=>results[x]).map(x=>[x,results[x]])),null,2)+'\n');dirty=0}
async function worker(queue){while(queue.length){
  const candidate=queue.shift();
  if(Object.hasOwn(results,candidate)&&results[candidate].status!=='error')continue;
  results[candidate]=await check(candidate);completed++;dirty++;
  if(dirty>=20)save();
  if(completed%100===0)process.stderr.write(`phase2 ${completed}/${targets.length}\n`);
}}
(async()=>{
  const queue=targets.filter(x=>!results[x]||results[x].status==='error');
  await Promise.all(Array.from({length:concurrency},()=>worker(queue)));
  save();
  const missing=targets.filter(x=>!results[x]);
  const errors=targets.filter(x=>results[x]?.status==='error');
  if(missing.length||errors.length)throw new Error(`Incomplete Phase 2 scan: ${missing.length} missing, ${errors.length} errors; rerun with --resume ${resume}`);
  const names={...baseNames};
  const sources=Object.fromEntries(Object.entries(oldSources).filter(([key])=>Object.hasOwn(baseNames,key)));
  for(const candidate of targets)if(results[candidate].status==='verified'){
    names[candidate]=results[candidate].alias;sources[candidate]=results[candidate].url;
  }
  const orderedNames=Object.fromEntries(candidates.filter(x=>names[x]).map(x=>[x,names[x]]));
  const orderedSources=Object.fromEntries(candidates.filter(x=>sources[x]).map(x=>[x,sources[x]]));
  fs.writeFileSync(path.join(ROOT,'data','ja-names.js'),'window.AQUA_JA_NAMES=window.AQUA_JA_NAMES||{};\nObject.assign(window.AQUA_JA_NAMES,'+JSON.stringify(orderedNames,null,2)+');\n');
  fs.writeFileSync(path.join(ROOT,'data','ja-sources.json'),JSON.stringify(orderedSources,null,2)+'\n');
  const counts={};for(const value of Object.values(results))counts[value.status]=(counts[value.status]||0)+1;
  console.log(JSON.stringify({targets:targets.length,added:targets.filter(x=>results[x].status==='verified').length,status_counts:counts},null,2));
})().catch(error=>{console.error(error);process.exitCode=1});
