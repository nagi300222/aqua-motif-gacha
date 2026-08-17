(function(){
'use strict';
const names=Array.isArray(window.AQUA_SPECIES)?window.AQUA_SPECIES:[];
const jaMap=window.AQUA_JA_NAMES&&typeof window.AQUA_JA_NAMES==='object'?window.AQUA_JA_NAMES:{};
const $=id=>document.getElementById(id);
const list=$('results'), count=$('count'), jaCount=$('ja-count'), drawBtn=$('draw'), copyBtn=$('copy'), prev=$('previous'), jaOnly=$('ja-only');
let current=[];
function hasJapanese(s){return /[ぁ-んァ-ヶ一-龠]/.test(String(s||''));}
function isLocalized(name){return hasJapanese(name)||Boolean(jaMap[name]);}
function activePool(){return jaOnly&&jaOnly.checked?names.filter(isLocalized):names;}
function displayParts(name){
  const ja=jaMap[name];
  if(ja&&ja!==name)return{primary:ja,secondary:name};
  return{primary:name,secondary:''};
}
function displayText(name){const p=displayParts(name);return p.secondary?`${p.primary}（${p.secondary}）`:p.primary;}
function safeLoad(){try{return JSON.parse(localStorage.getItem('aqua-last')||'[]')}catch(e){return[]}}
function safeSave(v){try{localStorage.setItem('aqua-last',JSON.stringify(v))}catch(e){}}
function loadJaOnly(){try{return localStorage.getItem('aqua-ja-only')==='1'}catch(e){return false}}
function saveJaOnly(value){try{localStorage.setItem('aqua-ja-only',value?'1':'0')}catch(e){}}
function updateCounts(){
  const pool=activePool();
  count.textContent=jaOnly&&jaOnly.checked?`${pool.length.toLocaleString('ja-JP')} / ${names.length.toLocaleString('ja-JP')}`:names.length.toLocaleString('ja-JP');
}
function pick10(){
  const pool=activePool();
  if(pool.length<10) return [];
  const idx=Array.from({length:pool.length},(_,i)=>i);
  for(let i=0;i<10;i++){
    const j=i+Math.floor(Math.random()*(idx.length-i));
    [idx[i],idx[j]]=[idx[j],idx[i]];
  }
  return idx.slice(0,10).map(i=>pool[i]);
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
 const next=pick10(); if(next.length!==10){list.textContent='候補データの読み込みに失敗しました';return;}
 const old=current.length?current:safeLoad(); if(old.length) try{localStorage.setItem('aqua-prev',JSON.stringify(old))}catch(e){}
 render(next); safeSave(next); renderPrev();
}
async function copy(){
 const text=current.map((n,i)=>`${i+1}. ${displayText(n)}`).join('\n');
 if(!text)return;
 try{await navigator.clipboard.writeText(text);copyBtn.textContent='コピー済み';setTimeout(()=>copyBtn.textContent='10件コピー',1200)}
 catch(e){const t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();}
}
const localizedCount=names.filter(isLocalized).length;
if(jaOnly)jaOnly.checked=loadJaOnly();
updateCounts();
if(jaCount)jaCount.textContent=`${localizedCount.toLocaleString('ja-JP')} / ${names.length.toLocaleString('ja-JP')}`;
drawBtn.addEventListener('click',draw);copyBtn.addEventListener('click',copy);
if(jaOnly)jaOnly.addEventListener('change',()=>{saveJaOnly(jaOnly.checked);updateCounts();draw();});
renderPrev();
const last=safeLoad();
const allowed=new Set(activePool());
last.length===10&&last.every(name=>allowed.has(name))?render(last):draw();
})();
