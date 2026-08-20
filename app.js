(function(){
'use strict';
const CATEGORIES={
  aqua:{
    key:'aqua',
    title:'🐙 AQUA MOTIF GACHA',
    sub:'水生生物モチーフを10個、重複なしで即抽選。',
    drawLabel:'10匹ひく',
    names:Array.isArray(window.AQUA_SPECIES)?window.AQUA_SPECIES:[],
    ja:window.AQUA_JA_NAMES&&typeof window.AQUA_JA_NAMES==='object'?window.AQUA_JA_NAMES:{},
    lastKey:'aqua-last',
    prevKey:'aqua-prev'
  },
  flower:{
    key:'flower',
    title:'🌸 FLOWER MOTIF GACHA',
    sub:'花モチーフを10個、重複なしで即抽選。',
    drawLabel:'10種ひく',
    names:Array.isArray(window.FLOWER_SPECIES)?window.FLOWER_SPECIES:[],
    ja:window.FLOWER_JA_NAMES&&typeof window.FLOWER_JA_NAMES==='object'?window.FLOWER_JA_NAMES:{},
    lastKey:'flower-last',
    prevKey:'flower-prev'
  }
};
const $=id=>document.getElementById(id);
const list=$('results'), count=$('count'), jaCount=$('ja-count'), drawBtn=$('draw'), copyBtn=$('copy'), prev=$('previous'), jaOnly=$('ja-only');
const title=$('title'), sub=$('sub'), tabs=[$('tab-aqua'),$('tab-flower')].filter(Boolean);
let category=CATEGORIES.aqua;
let current=[];
function hasJapanese(s){return /[ぁ-んァ-ヶ一-龠]/.test(String(s||''));}
function isLocalized(name){return hasJapanese(name)||Boolean(category.ja[name]);}
function activePool(){return jaOnly&&jaOnly.checked?category.names.filter(isLocalized):category.names;}
function displayParts(name){
  const ja=category.ja[name];
  if(ja&&ja!==name)return{primary:ja,secondary:name};
  return{primary:name,secondary:''};
}
function displayText(name){const p=displayParts(name);return p.secondary?`${p.primary}（${p.secondary}）`:p.primary;}
function readList(key){try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v:[]}catch(e){return[]}}
function writeList(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch(e){}}
function safeLoad(){return readList(category.lastKey);}
function safeSave(v){writeList(category.lastKey,v);}
function loadJaOnly(){try{return localStorage.getItem('aqua-ja-only')==='1'}catch(e){return false}}
function saveJaOnly(value){try{localStorage.setItem('aqua-ja-only',value?'1':'0')}catch(e){}}
function loadCategory(){try{const v=localStorage.getItem('gacha-category');return CATEGORIES[v]?CATEGORIES[v]:CATEGORIES.aqua}catch(e){return CATEGORIES.aqua}}
function saveCategory(value){try{localStorage.setItem('gacha-category',value)}catch(e){}}
function localizedCount(){return category.names.filter(isLocalized).length;}
function updateCounts(){
  const total=category.names.length;
  const pool=activePool();
  count.textContent=jaOnly&&jaOnly.checked?`${pool.length.toLocaleString('ja-JP')} / ${total.toLocaleString('ja-JP')}`:total.toLocaleString('ja-JP');
  if(jaCount)jaCount.textContent=`${localizedCount().toLocaleString('ja-JP')} / ${total.toLocaleString('ja-JP')}`;
}
function pick10(){
  const pool=activePool();
  if(!pool.length) return [];
  // A pool smaller than 10 still draws, it just draws everything it has, so a
  // narrow filter degrades gracefully instead of showing a load error.
  const want=Math.min(10,pool.length);
  const idx=Array.from({length:pool.length},(_,i)=>i);
  for(let i=0;i<want;i++){
    const j=i+Math.floor(Math.random()*(idx.length-i));
    [idx[i],idx[j]]=[idx[j],idx[i]];
  }
  return idx.slice(0,want).map(i=>pool[i]);
}
function render(items){
  current=items;
  list.innerHTML='';
  items.forEach((name,i)=>{
    const li=document.createElement('li');
    li.className='result';
    const num=document.createElement('span'); num.className='num'; num.textContent=String(i+1).padStart(2,'0');
    const wrap=document.createElement('span'); wrap.className='name-wrap';
    const parts=displayParts(name);
    const txt=document.createElement('span'); txt.className='name'; txt.textContent=parts.primary;
    wrap.appendChild(txt);
    if(parts.secondary){const sub=document.createElement('span');sub.className='original-name';sub.textContent=parts.secondary;wrap.appendChild(sub);}
    li.append(num,wrap); list.appendChild(li);
  });
}
function renderPrev(){
 const p=safeLoad();
 prev.textContent=p.length?'前回: '+p.map(displayText).join(' / '):'前回結果なし';
}
function draw(){
 const next=pick10(); if(!next.length){list.textContent='抽選できる候補がありません';return;}
 const old=current.length?current:safeLoad(); if(old.length) writeList(category.prevKey,old);
 render(next); safeSave(next); renderPrev();
}
function showCategory(){
 if(title)title.textContent=category.title;
 if(sub)sub.textContent=category.sub;
 if(drawBtn)drawBtn.textContent=category.drawLabel;
 tabs.forEach(tab=>tab.setAttribute('aria-selected',tab.getAttribute('data-category')===category.key?'true':'false'));
 updateCounts();
 renderPrev();
 // Keep this category's own last result when it is still valid for the current
 // filter; otherwise the category starts with a fresh draw of its own pool.
 const pool=activePool();
 const last=safeLoad();
 const allowed=new Set(pool);
 const want=Math.min(10,pool.length);
 current=[];
 if(want&&last.length===want&&last.every(name=>allowed.has(name)))render(last);
 else draw();
}
function switchCategory(key){
 if(!CATEGORIES[key]||CATEGORIES[key]===category)return;
 category=CATEGORIES[key];
 saveCategory(category.key);
 showCategory();
}
async function copy(){
 const text=current.map((n,i)=>`${i+1}. ${displayText(n)}`).join('\n');
 if(!text)return;
 try{await navigator.clipboard.writeText(text);copyBtn.textContent='コピー済み';setTimeout(()=>copyBtn.textContent='10件コピー',1200)}
 catch(e){const t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();}
}
if(jaOnly)jaOnly.checked=loadJaOnly();
category=loadCategory();
drawBtn.addEventListener('click',draw);copyBtn.addEventListener('click',copy);
tabs.forEach(tab=>tab.addEventListener('click',()=>switchCategory(tab.getAttribute('data-category'))));
if(jaOnly)jaOnly.addEventListener('change',()=>{saveJaOnly(jaOnly.checked);updateCounts();draw();});
showCategory();
})();
