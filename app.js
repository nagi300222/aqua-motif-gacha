(function(){
'use strict';
const names=Array.isArray(window.AQUA_SPECIES)?window.AQUA_SPECIES:[];
const $=id=>document.getElementById(id);
const list=$('results'), count=$('count'), drawBtn=$('draw'), copyBtn=$('copy'), prev=$('previous');
let current=[];
function safeLoad(){try{return JSON.parse(localStorage.getItem('aqua-last')||'[]')}catch(e){return[]}}
function safeSave(v){try{localStorage.setItem('aqua-last',JSON.stringify(v))}catch(e){}}
function pick10(){
  if(names.length<10) return [];
  const idx=Array.from({length:names.length},(_,i)=>i);
  for(let i=0;i<10;i++){
    const j=i+Math.floor(Math.random()*(idx.length-i));
    [idx[i],idx[j]]=[idx[j],idx[i]];
  }
  return idx.slice(0,10).map(i=>names[i]);
}
function render(items){
  current=items;
  list.innerHTML='';
  items.forEach((name,i)=>{
    const li=document.createElement('li');
    li.className='result';
    const num=document.createElement('span'); num.className='num'; num.textContent=String(i+1).padStart(2,'0');
    const txt=document.createElement('span'); txt.className='name'; txt.textContent=name;
    li.append(num,txt); list.appendChild(li);
  });
}
function renderPrev(){
 const p=safeLoad();
 prev.textContent=p.length?'前回: '+p.join(' / '):'前回結果なし';
}
function draw(){
 const next=pick10(); if(next.length!==10){list.textContent='候補データの読み込みに失敗しました';return;}
 const old=current.length?current:safeLoad(); if(old.length) try{localStorage.setItem('aqua-prev',JSON.stringify(old))}catch(e){}
 render(next); safeSave(next); renderPrev();
}
async function copy(){
 const text=current.map((n,i)=>`${i+1}. ${n}`).join('\n');
 if(!text)return;
 try{await navigator.clipboard.writeText(text);copyBtn.textContent='コピー済み';setTimeout(()=>copyBtn.textContent='10件コピー',1200)}
 catch(e){const t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();}
}
count.textContent=names.length.toLocaleString('ja-JP');
drawBtn.addEventListener('click',draw);copyBtn.addEventListener('click',copy);
renderPrev();
const last=safeLoad(); last.length===10?render(last):draw();
})();
