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
      const previous=scores.get(key);
      scores.set(key,{label:!previous||score>previous.score?label:previous.label,
       score:Math.max(score,previous?.score||0),count:(previous?.count||0)+1});
     }
    });
   });
  });
  scores.forEach(({label,score,count},key)=>{
   const entry=entries.get(key)||{key,label,best:0,score:0,count:0,sources:new Map()};
   if(score>entry.best){entry.label=label;entry.best=score}
   entry.score+=score+Math.min(count-1,8)*.85;
   entry.count+=count;
   entry.sources.set(index,title);
   entries.set(key,entry);
  });
 });
 return [...entries.values()].sort((a,b)=>(b.score+b.sources.size*2)-(a.score+a.sources.size*2)||
  a.label.localeCompare(b.label,"ar")).slice(0,40);
}
function seoLine(value){
 return typeof value==="string"?value.replace(/\s+/g," ").trim():"";
}
function includesSeoPhrase(text,phrase){
 const words=value=>seoWord(value).replace(/[^\p{L}\p{N}]+/gu," ").trim();
 const term=words(phrase);
 return Boolean(term)&&(" "+words(text)+" ").includes(" "+term+" ");
}
function seoDescription(preferred, content, target="", supporting=[], excluded=[]){
 const first=seoText(preferred).replace(/\s+/g," ").trim();
 const parts=seoText(content).split(/[\n.!؟!?]+/).map(part=>part.replace(/\s+/g," ").trim()).filter(Boolean);
 const phrases=collectSeoPhrases([{title:"",fields:[[preferred,4],[content,2]]}]);
 const scored=parts.map((part,index)=>{
  const text=seoWord(part);
  const score=(includesSeoPhrase(part,target)?500:0)-excluded.reduce((total,phrase)=>total+(includesSeoPhrase(part,phrase)?80:0),0)+supporting.reduce((total,phrase)=>total+(includesSeoPhrase(part,phrase)?25:0),0)+phrases.slice(0,10).reduce((total,phrase,rank)=>total+(text.includes(seoWord(phrase.label))?10-rank:0),0);
  return {part,index,score};
 }).sort((a,b)=>b.score-a.score||a.index-b.index);
 const normalized=seoWord(first);
 const best=scored.find(({part})=>!normalized.includes(seoWord(part))&&part.length>=12)?.part||"";
 const targeted=seoLine(target)&&best&&includesSeoPhrase(best,target)&&!includesSeoPhrase(first,target);
 const summary=targeted&&first.length>=90?best:first&&first.length<90&&best?first.replace(/[.،؛]+$/,"")+" — "+best:first||best||parts[0]||"";
 if(summary.length<=160)return summary;
 const shortened=summary.slice(0,157);
 const boundary=shortened.lastIndexOf(" ");
 return (boundary>110?shortened.slice(0,boundary):shortened)+"…";
}
 function appDescription(app,render,preferences){
  const contents=app.x3||app.h1?[]:["desc","feat"].map(field=>{
   const rich=app[field+"Rich"];
   return typeof rich==="string"?render(rich,true):app[field];
  });
  return seoLine(app.seoSummary)||seoDescription(app.sub,contents.filter(Boolean).join("\n"),seoLine(app.seoTarget),preferences.supporting||[],excludedTerms(preferences));
 }
 function siteMetadata(data,app,render){
  const brand=seoLine(data.s.name)||"واجهة التطبيقات";
  const item=app||data.s;
  const name=app?seoLine(app.name)||brand:brand;
  const target=seoLine(item.seoTarget).slice(0,100);
  const preferred=target&&!includesSeoPhrase(name,target)?name+" – "+target:name;
  const title=seoLine(item.seoTitle)||(app&&name!==brand?preferred+" | "+brand:preferred);
  const key=app?"app:"+app.slug:"home";
  const preferences=data.s.seoPreferences?.[key]||{};
  const description=app?appDescription(app,render,preferences):seoLine(item.seoSummary)||seoDescription("",
   data.a.filter(app=>!app.hd).map(app=>app.sub).filter(Boolean).join("\n"),target,preferences.supporting||[],excludedTerms(preferences));
  return {title,description};
 }
 function excludedTerms(preferences){
  return Object.entries(preferences.terms||{}).filter(([,term])=>term.excluded)
   .flatMap(([key,term])=>[key,term.text].filter(Boolean));
 }
 function pageMetadata(page,settings,render){
  const selected=settings.seoPreferences?.[page.kind+":"+page.slug]||{};
  const name=seoLine(page.title);
  const target=seoLine(selected.target);
  const title=seoLine(page.seo_title)||(target&&!includesSeoPhrase(name,target)?name+" – "+target:name)+
   " | "+(seoLine(settings.name)||"واجهة التطبيقات");
  const description=seoLine(page.description)||seoDescription("",render(page.body,true),target,selected.supporting||[],excludedTerms(selected));
  return {title,description};
 }
 const seo={collectSeoPhrases,seoDescription,siteMetadata,pageMetadata,includesSeoPhrase};
 if(typeof module==="object"&&module.exports)module.exports=seo;
 else root.siteSeo=seo;
})(globalThis);
