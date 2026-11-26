(function(root){
 'use strict';
const seoStopWords=new Set("هذا هذه ذلك تلك هنا هناك التي الذي إلى الى على عن من في مع او أو ان أن إن هو هي هم هل ما كما لكل لك عند بعد قبل ثم حتى بين عبر عند فقط بعض كل يمكنك يمكن اكثر أكثر جدا جدآ بدون ضمن اذا إذا على أيضا كذلك الآن جديد الموقع التطبيق صفحة المقال المدونة جميع بشكل حيث كان تكون تم مثل ولا قد غير".split(" ").map(seoWord));
function seoWord(word){
 return word.toLocaleLowerCase().normalize("NFKC").replace(/[ـ\p{M}]/gu,"")
  .replace(/[أإآٱ]/g,"ا").replace(/ى/g,"ي");
}
function seoText(value){
 return typeof value==="string"?value.replace(/(?:https?:\/\/|www\.)\S+|[\w.+-]+@[\w.-]+/gi," "):"";
}
function collectSeoPhrases(documents){
 const entries=new Map();
 documents.forEach(({title,fields},index)=>{
  const scores=new Map();
  fields.forEach(([field,weight])=>{
   const sentences=seoText(field).slice(0,12000).split(/[.!?؟،,;؛:\n|]+/);
   sentences.forEach(sentence=>{
    const words=sentence.match(/\p{L}[\p{L}\p{M}\p{N}]*/gu)||[];
    const normalized=words.map(seoWord);
    normalized.forEach((word,start)=>{
     if(word.length<2||seoStopWords.has(word))return;
     for(let length=1;length<=3&&start+length<=words.length;length++){
      const last=normalized[start+length-1];
      if(last.length<2||seoStopWords.has(last))continue;
      const key=normalized.slice(start,start+length).join(" ");
      const label=words.slice(start,start+length).join(" ");
      const score=weight*(length===1?1:length===2?1.45:1.25);
      if(score>(scores.get(key)?.score||0))scores.set(key,{label,score});
     }
    });
   });
  });
  scores.forEach(({label,score},key)=>{
   const entry=entries.get(key)||{label,best:0,score:0,sources:new Map()};
   if(score>entry.best){entry.label=label;entry.best=score}
   entry.score+=score;
   entry.sources.set(index,title);
   entries.set(key,entry);
  });
 });
 return [...entries.values()].sort((a,b)=>(b.score+b.sources.size*2)-(a.score+a.sources.size*2)||
  a.label.localeCompare(b.label,"ar")).slice(0,40);
}
function seoDescription(preferred, content){
 const first=seoText(preferred).replace(/\s+/g," ").trim();
 const parts=seoText(content).split(/[\n.!؟!?]+/).map(part=>part.replace(/\s+/g," ").trim()).filter(Boolean);
 const phrases=collectSeoPhrases([{title:"",fields:[[preferred,4],[content,2]]}]);
 const scored=parts.map((part,index)=>{
  const text=seoWord(part);
  const score=phrases.slice(0,10).reduce((total,phrase,rank)=>total+(text.includes(seoWord(phrase.label))?10-rank:0),0);
  return {part,index,score};
 }).sort((a,b)=>b.score-a.score||a.index-b.index);
 const normalized=seoWord(first);
 const best=scored.find(({part})=>!normalized.includes(seoWord(part))&&part.length>=12)?.part||"";
 const summary=first&&first.length<90&&best?first.replace(/[.،؛]+$/,"")+" — "+best:first||best||parts[0]||"";
 if(summary.length<=160)return summary;
 const shortened=summary.slice(0,157);
 const boundary=shortened.lastIndexOf(" ");
 return (boundary>110?shortened.slice(0,boundary):shortened)+"…";
}
 function appDescription(app,render){
  const contents=app.x3||app.h1?[]:["desc","feat"].map(field=>{
   const rich=app[field+"Rich"];
   return typeof rich==="string"?render(rich,true):app[field];
  });
  return seoDescription(app.sub,contents.filter(Boolean).join("\n"));
 }
 const seo={collectSeoPhrases,seoDescription,appDescription};
 if(typeof module==="object"&&module.exports)module.exports=seo;
 else root.siteSeo=seo;
})(globalThis);
