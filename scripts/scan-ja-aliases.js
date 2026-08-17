#!/usr/bin/env node
'use strict';

/**
 * Scan every AQUA_SPECIES candidate against BISMaL's exact-name search.
 *
 * A result is accepted only when BISMaL resolves to one taxon page and that
 * page's title consists of the candidate string itself followed by a Japanese
 * name. Search-result pages, fuzzy matches, and records with a different
 * scientific name are ignored. Existing aliases are retained only when their
 * recorded page passes the same check.
 *
 * Usage: node scripts/scan-ja-aliases.js [--concurrency 8] [--resume FILE]
 */
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const {execFile}=require('child_process');
const {promisify}=require('util');
const execFileAsync=promisify(execFile);

const ROOT=path.resolve(__dirname,'..');
const args=process.argv.slice(2);
function option(name,fallback){const i=args.indexOf(name);return i<0?fallback:args[i+1]}
const concurrency=Math.max(1,Number(option('--concurrency','8'))||8);
const resumeOption=option('--resume',null);
const resume=path.resolve(resumeOption||path.join(process.env.TMPDIR||'/tmp',`aqua-ja-scan-${process.pid}.json`));
const endpoint='https://www.godac.jamstec.go.jp/bismal/j/search';
const japanese=/[\u3040-\u30ff\u3400-\u9fff]/u;
const context={window:{}};vm.createContext(context);
for(const file of fs.readdirSync(path.join(ROOT,'data')).filter(f=>/^species-.*\.js$/.test(f)).sort())
  vm.runInContext(fs.readFileSync(path.join(ROOT,'data',file),'utf8'),context,{filename:file});
const candidates=context.window.AQUA_SPECIES;
if(!Array.isArray(candidates)||candidates.length!==6000)throw new Error(`Expected 6000 candidates, got ${candidates?.length}`);
const normalized=candidates.map(x=>x.normalize('NFKC').trim().toLocaleLowerCase('en-US'));
if(new Set(normalized).size!==candidates.length)throw new Error('Candidate pool contains normalized duplicates');
let cache={};
if(fs.existsSync(resume))cache=JSON.parse(fs.readFileSync(resume,'utf8'));
const decode=s=>s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fetchPage(candidate){
  // curl honors the HTTPS proxy configuration used in CI and returns the
  // effective URL after redirects. No search-engine or fuzzy-search output is
  // consumed here: only BISMaL's own exact-name endpoint and taxon pages.
  let last;
  for(let attempt=0;attempt<4;attempt++){
    try{
      const marker='\n__AQUA_EFFECTIVE_URL__';
      const {stdout}=await execFileAsync('curl',['-LsS','--max-time','30','--retry','2','--get','--data-urlencode',`keyword=${candidate}`,'-A','AQUA-MOTIF-GACHA/1.0 (Japanese-name source audit)','-w',`${marker}%{url_effective}`,endpoint],{maxBuffer:4*1024*1024});
      const split=stdout.lastIndexOf(marker);
      if(split<0)throw new Error('curl output did not contain effective URL');
      const body=stdout.slice(0,split),effectiveUrl=stdout.slice(split+marker.length).trim();
      const match=body.match(/<title[^>]*>\s*([\s\S]*?)\s*- Biological Information System for Marine Life\s*<\/title>/i);
      if(!match||!/\/bismal\/j\/view\/\d+$/.test(new URL(effectiveUrl).pathname))return {status:'no-exact-record'};
      const title=decode(match[1].replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim());
      const jpIndex=title.search(japanese);
      if(jpIndex<0)return {status:'no-japanese-name',url:effectiveUrl};
      const recordName=title.slice(0,jpIndex).trim();
      const alias=title.slice(jpIndex).trim();
      if(recordName!==candidate)return {status:'name-mismatch',recordName,url:effectiveUrl};
      if(!alias||!japanese.test(alias))return {status:'no-japanese-name',url:effectiveUrl};
      return {status:'verified',alias,url:effectiveUrl.replace(':443','')};
    }catch(error){last=error;await pause(400*2**attempt)}
  }
  return {status:'error',error:String(last)};
}
let completed=Object.keys(cache).length,dirty=0;
async function worker(queue){
  while(queue.length){
    const candidate=queue.shift();
    if(Object.hasOwn(cache,candidate))continue;
    // A Japanese candidate is already localized by definition, but remains an
    // explicit scanned result so the report accounts for all 6,000 entries.
    cache[candidate]=japanese.test(candidate)?{status:'builtin-japanese'}:await fetchPage(candidate);
    completed++;dirty++;
    if(dirty>=25){fs.writeFileSync(resume,JSON.stringify(cache,null,2)+'\n');dirty=0}
    if(completed%100===0)process.stderr.write(`scanned ${completed}/${candidates.length}\n`);
  }
}
(async()=>{
  const queue=[...candidates];
  await Promise.all(Array.from({length:concurrency},()=>worker(queue)));
  fs.writeFileSync(resume,JSON.stringify(cache,null,2)+'\n');
  const missing=candidates.filter(x=>!Object.hasOwn(cache,x));
  if(missing.length)throw new Error(`Incomplete scan: ${missing.length} candidates missing`);
  const errors=candidates.filter(x=>cache[x].status==='error');
  if(errors.length)throw new Error(`Incomplete scan: ${errors.length} requests failed; rerun with --resume ${resume}`);
  const verified=Object.fromEntries(candidates.filter(x=>cache[x].status==='verified').map(x=>[x,cache[x]]));
  const names=Object.fromEntries(Object.entries(verified).map(([k,v])=>[k,v.alias]));
  const sources=Object.fromEntries(Object.entries(verified).map(([k,v])=>[k,v.url]));
  const js='window.AQUA_JA_NAMES=window.AQUA_JA_NAMES||{};\nObject.assign(window.AQUA_JA_NAMES,'+JSON.stringify(names,null,2)+');\n';
  fs.writeFileSync(path.join(ROOT,'data','ja-names.js'),js);
  fs.writeFileSync(path.join(ROOT,'data','ja-sources.json'),JSON.stringify(sources,null,2)+'\n');
  const counts={};for(const value of Object.values(cache))counts[value.status]=(counts[value.status]||0)+1;
  console.log(JSON.stringify({candidate_total:candidates.length,verified_aliases:Object.keys(verified).length,status_counts:counts,cache:resume},null,2));
  if(!resumeOption)fs.rmSync(resume,{force:true});
})().catch(error=>{console.error(error);process.exitCode=1});
