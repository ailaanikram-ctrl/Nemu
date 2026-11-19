'use strict';
/* ================= Nemu — parser (offline provider) =================
   Pasted text is DATA. It is never executed or sent to privileged APIs. */
const DAYS={sunday:0,monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6,ahad:0,isnin:1,selasa:2,rabu:3,khamis:4,jumaat:5,sabtu:6};
const VERBS='check|compare|update|submit|send|buy|call|report|upload|reply|confirm|attend|register|fill|apply|follow|include|note|message|inspect|prepare|clean|wash|organi[sz]e|finish|print|ask|pay|book|email|write|read|study|revise|take|bring|make|get|go|meet|fix|order|pack|tell|review|complete|collect|pick|return|renew|cook|iron|do|beli|hantar|siapkan|telefon|bayar|cuci|kemas|ambil|tanya|semak|cetak|hubungi';
const FILL=/\b(remind me to|remind me|i need to|i have to|i must|need to|have to|must|please|remember to|don'?t forget to|jangan lupa|kena|perlu|can you|could you)\b/ig;
const TRIG=new RegExp('\\b(need to|have to|must|remember|please|make sure|remind|kena|perlu|jangan lupa|should|submit|due|hantar)\\b','i');
const VSTART=new RegExp('^(?:'+VERBS+')\\b','i');
const LA='(?=(?:'+VERBS+'|remember|after|once|i need|i have|please|selepas)\\b)';
const SPLIT=new RegExp('(?:,\\s*)?\\s+(?:and then|then|and|dan|kemudian|lepas tu)\\s+'+LA+'|,\\s+'+LA,'i');
const STEPS=[[/clean|tidy|kemas/,['Put dirty clothes in the basket','Pick up rubbish','Clear the bed','Put things back in place']],
[/wash|cuci/,['Gather what needs washing','Start the wash']],[/check|inspect|compare|semak/,['Get what you need to check','Check the first item']],
[/submit|hantar/,['Open the file','Look it over','Send it']],[/buy|beli|order/,['Write down what to buy','Get the first item']],
[/call|telefon|hubungi/,['Open the contact','Press call']],[/message|update|send|email|tell|ask|tanya/,['Open the chat','Write one line']],
[/assignment|study|revise|read|report|write/,['Open your notes or file','Work on it for 2 minutes']]];
const MED=/assignment|report|study|revise|clean|check|inspect|prepare|write|kemas|semak/i;
const dayStr=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const addDays=(b,n)=>{const d=new Date(b);d.setHours(0,0,0,0);d.setDate(d.getDate()+n);return d};
const atTime=(ds,h,m)=>{const [y,mo,d]=ds.split('-').map(Number);return new Date(y,mo-1,d,h,m,0,0)};
function parseWhen(s,base){
  const r={day:null,h:null,mi:0,kind:null,fuzzy:null,ambig:false,rest:s};let m;
  const cut=x=>{r.rest=r.rest.replace(x,' ')};
  if(m=s.match(/\b(day after tomorrow|lusa)\b/i)){r.day=addDays(base,2);cut(m[0])}
  else if(m=s.match(/\b(tomorrow|tmrw|tmr|esok)\b/i)){r.day=addDays(base,1);cut(m[0])}
  else if(m=s.match(/\b(today|hari ini)\b/i)){r.day=addDays(base,0);cut(m[0])}
  else if(m=s.match(/\b(tonight|malam ini)\b/i)){r.day=addDays(base,0);r.fuzzy='tonight';cut(m[0])}
  else if(m=s.match(/\b(?:on\s+|this\s+|next\s+|hari\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|ahad|isnin|selasa|rabu|khamis|jumaat|sabtu)\b/i)){
    const t=DAYS[m[1].toLowerCase()];let n=(t-base.getDay()+7)%7;if(n===0)n=7;r.day=addDays(base,n);cut(m[0])}
  if(!r.fuzzy&&(m=s.match(/\b(morning|afternoon|evening|pagi|petang)\b/i))){r.fuzzy=m[1].toLowerCase();cut(m[0])}
  const re=/\b(before|by|sebelum|at|pukul|pkl|@)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/ig;
  while(m=re.exec(r.rest)){const pre=m[1],ap=m[4],col=m[3];if(!(pre||ap||col))continue;let h=+m[2];if(h>23)continue;
    if(ap){const p=ap.toLowerCase()==='pm';if(p&&h<12)h+=12;if(!p&&h===12)h=0}else if(h>=1&&h<=6){r.ambig=true;h+=12}
    r.h=h;r.mi=col?+col:0;r.kind=/^(before|by|sebelum)$/i.test(pre||'')?'before':'at';r.rest=r.rest.replace(m[0],' ');break}
  return r}
function extract(text,mode,now){
  now=now||new Date();const out={tasks:[],info:[],uncertain:[],summary:''};
  let parts=String(text).slice(0,8000).split(mode==='dump'?/[\n,;]+/:/\n+|(?<=[.!?])\s+|;\s*/).flatMap(p=>mode==='dump'?p.split(new RegExp('\\s+(?=(?:'+VERBS+'|need)\\b)','i')):p.split(SPLIT)).map(x=>x.trim()).filter(Boolean);
  const days=new Set(),draft=[];
  for(const raw of parts){
    let s=raw.replace(/^(hi|hello|hey|salam|assalamualaikum)\b[^,]*,\s*/i,'').replace(/[.!?]+$/,'').trim();if(!s)continue;
    let cond=null,after=false,note=null,m;
    if(m=s.match(/^(?:if|kalau|jika)\s+(.+?),\s*(.+)$/i)){cond=m[1];s=m[2]}
    else if(m=s.match(/^(.*?)[,\s]+(?:only\s+)?(?:if|kalau|jika)\s+(.+)$/i)){s=m[1];cond=m[2]}
    if(/^(?:and\s+)?(?:once|then)\b/i.test(s)){after=true;s=s.replace(/^(?:and\s+)?(?:once|then)\b\s*(?:(?:that|it'?s|completed|done|finished)\b\s*)*,?\s*/i,'')}
    if(m=s.match(/\bafter\s+(work|school|class|dinner|lunch|kerja|sekolah)\b/i)){note='After '+m[1];s=s.replace(m[0],' ')}
    const w=parseWhen(s,now);s=w.rest;
    const title=s.replace(FILL,' ').replace(/\b(before that|before|by|on|at)\s*$/i,'').replace(/\bbefore that\b/i,'').replace(/^[\s,.\-–:]+|[\s,.\-–:]+$/g,'').replace(/^to\s+/i,'').replace(/\s+/g,' ');
    const isTask=mode==='dump'?!!title:(TRIG.test(raw)||VSTART.test(title)||!!cond);
    if(!title||!isTask){if(title)out.info.push(raw);continue}
    if(w.day)days.add(dayStr(w.day));
    const T=title[0].toUpperCase()+title.slice(1);
    const p=(T.match(/\b(?:[Uu]pdate|[Cc]all|[Mm]essage|[Tt]ell|[Aa]sk|[Ee]mail|[Ii]nform|[Hh]ubungi|[Tt]elefon)\s+([A-Z][a-zA-Z]+)/)||[])[1];
    const lw=T.toLowerCase();const st=(STEPS.find(x=>x[0].test(lw))||[0,['Open what you need','Do the first 2 minutes']])[1];
    const medium=MED.test(T);
    const t={title:T.slice(0,120),steps:st,day:w.day?dayStr(w.day):null,daySource:w.day?'explicit':'none',deadline:null,deadlineSource:'none',dateOnly:false,
      scheduledAt:null,fuzzy:w.fuzzy,effort:medium?'medium':'small',minutes:medium?20:5,people:p?[p]:[],condition:cond?{text:cond}:null,afterPrev:after,
      remindAt:null,remindSource:'none',note,confidence:0.6,_h:w.h,_mi:w.mi,_kind:w.kind,_before:/\bbefore that\b/i.test(raw),_dueWord:/submit|due|deadline|hantar/i.test(raw)};
    if(w.ambig)out.uncertain.push('"'+T+'": I assumed '+(w.h%12||12)+' PM. Change it if you meant AM.');
    draft.push(t)}
  const only=days.size===1?[...days][0]:null;
  draft.forEach((t,i)=>{
    if(!t.day&&only){t.day=only;t.daySource='suggested'}
    if(t._h!=null){const ds=t.day||dayStr(now);if(!t.day){t.day=ds;t.daySource='suggested'}
      const dt=atTime(ds,t._h,t._mi);
      if(t._kind==='before'){t.deadline=dt.toISOString();t.deadlineSource=t.daySource==='explicit'||t._kind?'explicit':'suggested';t.confidence=0.95;
        t.remindAt=new Date(dt.getTime()-45*60000).toISOString();t.remindSource='suggested'}
      else{t.scheduledAt=dt.toISOString();t.remindAt=dt.toISOString();t.remindSource='suggested';t.confidence=0.9}}
    else if(t.day&&t._dueWord&&t.daySource==='explicit'){t.deadline=atTime(t.day,23,59).toISOString();t.dateOnly=true;t.deadlineSource='explicit';t.confidence=0.85}
    if(t.condition){const f=draft.findIndex(x=>!x.condition);t.condition.parentIdx=f>=0&&f!==i?f:null}
    if(t.afterPrev&&i>0)t.afterIdx=i-1;
    if(t._before&&i>0)draft[i-1].afterIdx=i;
    delete t._h;delete t._mi;delete t._kind;delete t._dueWord;delete t._before;delete t.afterPrev});
  out.tasks=draft;out.summary=draft.length+' thing'+(draft.length===1?'':'s')+' to do';
  if(out.info.length)out.uncertain.push(out.info.length+' line(s) looked like information, not tasks.');
  return out}
function validate(o){ // schema check for ANY provider output (local or remote)
  if(!o||!Array.isArray(o.tasks))throw new Error('bad shape');
  const ok=d=>d==null||(typeof d==='string'&&!isNaN(Date.parse(d)));
  const tasks=o.tasks.slice(0,30).map(t=>{
    if(typeof t.title!=='string'||!t.title.trim())throw new Error('bad title');
    if(!ok(t.deadline)||!ok(t.scheduledAt)||!ok(t.remindAt))throw new Error('bad date');
    return{title:t.title.trim().slice(0,120),steps:Array.isArray(t.steps)?t.steps.slice(0,6).map(x=>String(x).slice(0,100)):['Do the first 2 minutes'],
      day:/^\d{4}-\d\d-\d\d$/.test(t.day||'')?t.day:null,daySource:['explicit','suggested','none'].includes(t.daySource)?t.daySource:'none',
      deadline:t.deadline||null,deadlineSource:['explicit','suggested','none'].includes(t.deadlineSource)?t.deadlineSource:'none',dateOnly:!!t.dateOnly,
      scheduledAt:t.scheduledAt||null,fuzzy:t.fuzzy?String(t.fuzzy).slice(0,20):null,effort:t.effort==='medium'?'medium':'small',
      minutes:Math.min(240,Math.max(1,+t.minutes||5)),people:Array.isArray(t.people)?t.people.slice(0,5).map(x=>String(x).slice(0,40)):[],
      condition:t.condition&&t.condition.text?{text:String(t.condition.text).slice(0,120),parentIdx:Number.isInteger(t.condition.parentIdx)?t.condition.parentIdx:null}:null,
      afterIdx:Number.isInteger(t.afterIdx)?t.afterIdx:null,remindAt:t.remindAt||null,remindSource:t.remindSource||'none',note:t.note?String(t.note).slice(0,60):null,
      confidence:Math.min(1,Math.max(0,+t.confidence||0.5))}});
  return{tasks,info:[],uncertain:Array.isArray(o.uncertainties||o.uncertain)?(o.uncertainties||o.uncertain).slice(0,10).map(String):[],summary:String(o.summary||'').slice(0,100)}}

/* ================= Nemu interpreter: one message = one task ================= */
const URL_RE=/https?:\/\/[^\s<>"']+/gi;
const INDEP=new RegExp('^(?:buy|call|submit|send|pay|book|email|message|print|wash|clean|collect|pick|return|renew|cook|iron|bring|order|pack|beli|hantar|bayar|cuci|kemas|ambil|telefon|hubungi)\\b','i');
const cap=x=>x?x[0].toUpperCase()+x.slice(1):x;
const safeUrl=u=>{try{u=String(u).trim();if(u.length>2000)return null;const x=new URL(u);return(x.protocol==='https:'||x.protocol==='http:')?x.href:null}catch(e){return null}};
const stepsFor=t=>{const l=String(t).toLowerCase();return(STEPS.find(x=>x[0].test(l))||[0,['Open what you need','Do the first 2 minutes']])[1]};
const endDot=x=>x?x.replace(/[.!?]*$/,'.'):x;
function localInterpret(text,now,opts){
  now=now||new Date();opts=Object.assign({one:true,multi:true},opts);const links=[];
  let body=String(text).slice(0,8000).replace(URL_RE,m=>{const u=safeUrl(m.replace(/[).,;!?]+$/,''));if(u)links.push(u);return' '}).replace(/\b(tomorrow|today|tonight)['’]s\b/gi,'$1');
  let rec=null,m;
  if(m=body.match(/\bevery\s+(day|daily|morning|night|evening|week|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i)){const u=m[1].toLowerCase();
    rec=/^(day|daily|morning|night|evening)$/.test(u)?'daily':'weekly';body=body.replace(m[0],/^(morning|night|evening)$/.test(u)?u:/^(day|daily|week)$/.test(u)?'':u)}
  const full=extract(body,'paste',now);full.uncertain=full.uncertain.filter(u=>!/looked like information/.test(u));
  const empty={tasks:[],uncertain:[],summary:''};
  if(!full.tasks.length)return{pick:'single',single:empty,multi:null,prov:'Offline reader'};
  const tasks=full.tasks.map(t=>Object.assign({brief:null,link:null,rec:null},t));
  const lines=body.split(/\n+/).filter(x=>x.trim()).length,oneSentence=!/[.!?]\s+\S/.test(body.replace(/\n+/g,' ').trim());
  const indep=tasks.length>=2&&tasks.every(t=>!t.condition&&t.afterIdx==null&&INDEP.test(t.title))&&(lines>=2||oneSentence);
  const p=Object.assign({},tasks[0]);const rest=tasks.slice(1);
  if(!(p.deadline||p.scheduledAt||p.day)){const d=rest.find(t=>t.deadline||t.scheduledAt||t.day);if(d)['day','daySource','deadline','deadlineSource','dateOnly','scheduledAt','fuzzy','remindAt','remindSource'].forEach(k=>p[k]=d[k])}
  const parts=rest.map(t=>t.title).concat(full.info.map(x=>x.replace(/[.!?]+$/,'')));if(p.condition)parts.push('Only if '+p.condition.text);
  p.brief=parts.length?endDot(cap(parts.join('. ')).slice(0,240)):null;p.link=links[0]||null;p.rec=rec;p.afterIdx=null;p.condition=null;
  if(rec&&!p.day){p.day=dayStr(now);p.daySource='suggested'}
  const single={tasks:[p],uncertain:full.uncertain,summary:''};
  let multi=null;
  if(tasks.length>=2&&opts.multi){multi={tasks:tasks.map(t=>Object.assign(t,{rec})),uncertain:full.uncertain.concat(links.length?['A link was in your message. Add it to the right task after creating.']:[]),summary:''}}
  const pick=multi&&(opts.one===false||indep)?'multi':'single';
  return{pick,single,multi,prov:'Offline reader'}}
function mergeToOne(out){const t=out.tasks,p=Object.assign({},t[0]);const rest=t.slice(1).map(x=>x.title);
  p.brief=endDot([p.brief,rest.length?cap(rest.join('. ')):null].filter(Boolean).join(' ').slice(0,240))||null;p.afterIdx=null;p.condition=null;p.link=p.link||(t.find(x=>x.link)||{}).link||null;
  return{tasks:[p],uncertain:out.uncertain||[],summary:''}}
function normalizeNemu(o){ // validates AI JSON in Nemu's schema. Throws on anything malformed.
  if(!o||typeof o!=='object')throw new Error('bad output');
  const list=o.interpretation==='multiple_tasks'?o.tasks:o.interpretation==='single_task'?[o.task]:null;
  if(!Array.isArray(list)||!list.length||list.some(x=>!x||typeof x!=='object'))throw new Error('bad shape');
  const tasks=list.slice(0,20).map(x=>{
    const title=typeof x.task==='string'?x.task.trim():'';if(!title||title.length>120)throw new Error('bad task');
    let brief=null;if(x.taskBrief!=null){if(typeof x.taskBrief!=='string')throw new Error('bad brief');brief=x.taskBrief.trim().slice(0,240)||null}
    let link=null;if(x.taskLink!=null){link=safeUrl(x.taskLink);if(!link)throw new Error('bad link')}
    let dl=null,day=null,dateOnly=false;
    if(x.due!=null){if(typeof x.due!=='string'||isNaN(Date.parse(x.due)))throw new Error('bad due');dateOnly=/^\d{4}-\d\d-\d\d$/.test(x.due);const d=new Date(x.due);dl=dateOnly?atTime(x.due,23,59).toISOString():d.toISOString();day=dateOnly?x.due:dayStr(d)}
    const c=(o.interpretation==='single_task'?o.confidence:x.confidence)||{};const sr=(c.due==null||c.due>=0.8)?'explicit':'suggested';
    const rm=dl&&!dateOnly&&Date.parse(dl)-45*60000>Date.now()?new Date(Date.parse(dl)-45*60000).toISOString():null;
    return{title,brief,link,day,daySource:dl?sr:'none',deadline:dl,deadlineSource:dl?sr:'none',dateOnly,scheduledAt:null,fuzzy:null,effort:'small',minutes:5,steps:stepsFor(title),people:[],
      condition:null,afterIdx:null,remindAt:rm,remindSource:rm?'suggested':'none',note:null,rec:['daily','weekly'].includes(x.recurrence)?x.recurrence:null,confidence:+(c.task||0.7)||0.7}});
  return{pick:o.interpretation==='multiple_tasks'&&tasks.length>1?'multi':'single',tasks}}
function applyWhen(p,w){const ds=w.day?dayStr(w.day):(p.day||dayStr(new Date()));p.day=ds;p.daySource='explicit';if(w.fuzzy)p.fuzzy=w.fuzzy;
  if(w.h!=null){const dt=atTime(ds,w.h,w.mi);p.fuzzy=null;
    if(w.kind==='before'){p.deadline=dt.toISOString();p.deadlineSource='explicit';p.dateOnly=false;p.scheduledAt=null;p.remindAt=new Date(dt.getTime()-45*60000).toISOString()}
    else{p.scheduledAt=dt.toISOString();p.deadline=null;p.dateOnly=false;p.remindAt=p.scheduledAt}p.remindSource='suggested'}
  else{if(p.deadline){const o=new Date(p.deadline);p.deadline=atTime(ds,o.getHours(),o.getMinutes()).toISOString();if(p.remindAt&&!p.dateOnly)p.remindAt=new Date(Date.parse(p.deadline)-45*60000).toISOString()}
    if(p.scheduledAt){const o=new Date(p.scheduledAt);p.scheduledAt=atTime(ds,o.getHours(),o.getMinutes()).toISOString();p.remindAt=p.scheduledAt}}}
function refineDraft(p,text){let ch=false,m;text=String(text);
  const lk=(text.match(URL_RE)||[]).map(x=>safeUrl(x.replace(/[).,;!?]+$/,''))).find(Boolean);
  if(lk){p.link=lk;ch=true;text=text.replace(URL_RE,' ')}
  if(m=text.match(/^\s*(?:rename(?: it)?(?: to)?|call it|title)[:\s]+(.+)$/i)){p.title=m[1].trim().slice(0,120);return true}
  if(m=text.match(/^\s*(?:brief|note|details?)[:\s]+(.+)$/i)){p.brief=m[1].trim().slice(0,240);return true}
  if(/\b(no|remove|clear)\s+(due|date|deadline)\b/i.test(text)){Object.assign(p,{day:null,deadline:null,scheduledAt:null,dateOnly:false,fuzzy:null,remindAt:null,daySource:'none',deadlineSource:'none'});return true}
  const w=parseWhen(text,new Date());if(w.day||w.h!=null||w.fuzzy){applyWhen(p,w);ch=true}
  return ch}
if(typeof module!=='undefined')module.exports={extract,validate,localInterpret,normalizeNemu,mergeToOne,refineDraft};
if(typeof document==='undefined')throw 0;

/* ================= State ================= */
const $=q=>document.querySelector(q);
const esc=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>crypto.randomUUID?crypto.randomUUID():'id'+Date.now()+Math.random().toString(16).slice(2);
const DEF={tasks:[],routines:[],cal:[],ev:[],fm:0,skip:[],level:{starts:0,done:0},lastOpen:null,cfg:{lang:'en',theme:'system',large:false,mode:'balanced',qs:'22:00',qe:'07:00',maxRem:3,priv:false,persona:'gentle',energy:null,sbUrl:'',sbKey:'',vapid:'',autoSmall:false,name:'',aiOn:true,oneTask:true,multi:true,lastSync:null},session:null,onboarded:false};
let S=JSON.parse(JSON.stringify(DEF));
/* IndexedDB store (falls back to localStorage if IDB is unavailable) */
const idb=()=>new Promise((res,rej)=>{const r=indexedDB.open('momentum',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
async function idbGet(k){try{const d=await idb();return await new Promise(r=>{const q=d.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>r(q.result);q.onerror=()=>r(null)})}catch(e){return null}}
let _st=0;const flush=async()=>{try{const d=await idb();d.transaction('kv','readwrite').objectStore('kv').put(JSON.parse(JSON.stringify(S)),'state')}catch(e){try{localStorage.setItem('mm',JSON.stringify(S))}catch(x){}}};
const save=()=>{clearTimeout(_st);_st=setTimeout(flush,120)};
addEventListener('pagehide',()=>flush());
const L={en:{today:'Today',tasks:'Tasks',focus:'Focus',you:'You',now:'Now',next:'Next',later:'Later',start:'Start now',two:'Start for 2 minutes',smaller:'Make it smaller',notthis:'Not this',done:'Done',choose:'Help me choose',paste:'Paste something',pasteSub:'Message, email, instructions, notes… anything.',dump:'Brain dump',empty:'Nothing here yet. Paste something and I will find the tasks.'},
ms:{today:'Hari ini',tasks:'Tugasan',focus:'Fokus',you:'Anda',now:'Sekarang',next:'Seterusnya',later:'Kemudian',start:'Mula sekarang',two:'Mula 2 minit',smaller:'Kecilkan',notthis:'Bukan ini',done:'Siap',choose:'Bantu saya pilih',paste:'Tampal sesuatu',pasteSub:'Mesej, e-mel, arahan, nota… apa-apa.',dump:'Curah fikiran',empty:'Belum ada apa-apa. Tampal sesuatu dan saya cari tugasannya.'}};
const t_=k=>(L[S.cfg.lang]||L.en)[k]||L.en[k]||k;
let tab='today',F=null,PV=null;
const toast=m=>{const e=$('#toast');e.textContent=m;e.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>e.style.display='none',2600)};
const live=()=>S.tasks.filter(x=>!x.deleted);
const byId=id=>S.tasks.find(x=>x.id===id);
const touch=t=>{t.updatedAt=new Date().toISOString();t.dirty=true;save();sync()};
const fmtT=d=>new Date(d).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
const dayLbl=ds=>{if(!ds)return'';const t=dayStr(new Date());if(ds===t)return'Today';if(ds===dayStr(addDays(new Date(),1)))return'Tomorrow';return atTime(ds,0,0).toLocaleDateString([], {weekday:'long',day:'numeric',month:'short'})};
const safeHref=safeUrl;
function due(t){const dl=t.deadline?new Date(t.deadline):null;
  if(dl){const d=dayLbl(dayStr(dl));if(t.dateOnly)return d;return d+' · '+(dl.getHours()*60+dl.getMinutes()===1439?'':'Before ')+fmtT(t.deadline)}
  if(t.scheduledAt)return dayLbl(t.day)+' · '+fmtT(t.scheduledAt);
  if(t.day)return dayLbl(t.day)+(t.fuzzy?' · '+t.fuzzy:'');return t.fuzzy?cap(t.fuzzy):''}
const linkBtn=(t,c)=>{const u=safeUrl(t.link);return u?`<a class="lnk ${c||''}" href="${esc(u)}" target="_blank" rel="noopener noreferrer">Open link ↗</a>`:''};
const src=(s)=>s==='explicit'?'<span class="tag ex">From your text</span>':s==='suggested'?'<span class="tag ai">AI suggested</span>':'';
const ready=t=>t.status==='open'&&!t.deleted&&(!t.afterId||(byId(t.afterId)||{}).status==='done'||!byId(t.afterId));
function ranked(){let a=live().filter(ready);
  const k=t=>t.deadline?Date.parse(t.deadline):t.scheduledAt?Date.parse(t.scheduledAt):t.day?atTime(t.day,12,0).getTime():9e15;
  a.sort((x,y)=>k(x)-k(y)||(x.createdAt<y.createdAt?-1:1));
  if(S.cfg.energy==='low'){const sm=a.filter(x=>x.effort==='small');if(sm.length)a=sm.concat(a.filter(x=>x.effort!=='small'))}
  const ns=a.filter(x=>!S.skip.includes(x.id));return ns.length?ns:a}
const quiet=()=>{const n=new Date(),m=n.getHours()*60+n.getMinutes(),f=s=>{const [h,i]=s.split(':').map(Number);return h*60+i},a=f(S.cfg.qs),b=f(S.cfg.qe);return a>b?(m>=a||m<b):(m>=a&&m<b)};
const firstStep=t=>(t.steps&&t.steps[0])||'Do the first 2 minutes';
const noteTxt=t=>t.blocker==='big'?"Don't finish it. Just do the first step: "+firstStep(t):'First step: '+firstStep(t);
const persona=t=>({minimal:t.title+'. Start now.',gentle:'Ready? Let’s begin with one small step.',direct:'Time to start. '+firstStep(t),encouraging:'You don’t need to finish. Just start here.'}[S.cfg.persona]);

/* ================= Create / complete ================= */
function createFromPreview(){
  const ids=[];const keep=PV.keep;let n=0;
  PV.out.tasks.forEach((p,i)=>{if(!PV.on[i])return;const id=uid();ids[i]=id;n++;
    S.tasks.push({id,title:p.title,brief:p.brief||null,link:safeUrl(p.link),rec:p.rec||null,steps:p.steps,day:p.day,daySource:p.daySource,deadline:p.deadline,deadlineSource:p.deadlineSource,dateOnly:p.dateOnly,scheduledAt:p.scheduledAt,fuzzy:p.fuzzy,
      effort:p.effort,minutes:p.minutes,people:p.people,note:p.note,status:'open',remindAt:PV.rem[i]===undefined?p.remindAt:PV.rem[i],remCount:0,snooze:0,
      source:keep?PV.text:null,sourceType:'paste',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),dirty:true})});
  PV.out.tasks.forEach((p,i)=>{const t=byId(ids[i]);if(!t)return;
    if(p.afterIdx!=null&&ids[p.afterIdx])t.afterId=ids[p.afterIdx];
    if(p.condition){t.status='waiting';t.cond={text:p.condition.text,parentId:ids[p.condition.parentIdx]||null};if(!t.cond.parentId)t.status='open'}});
  save();sync();closeSheet();PV=null;toast(n===1?'Task created':n+' tasks created');go('today')}
/* ---- AI provider interface: every provider returns {pick,single,multi} and is validated ---- */
const aiResult=j=>{const r=normalizeNemu(j);const o={tasks:r.tasks,uncertain:[],summary:''};
  if(r.pick==='multi'&&S.cfg.multi!==false)return{pick:S.cfg.oneTask===false?'multi':'multi',single:mergeToOne(o),multi:o};
  return{pick:'single',single:r.tasks.length>1?mergeToOne(o):o,multi:null}};
const PROVIDERS={
  qwen:{label:'Qwen AI',ok:()=>!!(S.cfg.aiOn!==false&&aiReady()&&navigator.onLine&&AIS.status!=='not_configured'),run:async t=>aiResult(await aiFetch('/ai/extract',{text:t,now:new Date().toISOString(),tz:Intl.DateTimeFormat().resolvedOptions().timeZone}))},
  offline:{label:'Offline reader',ok:()=>true,run:async t=>localInterpret(t,new Date(),{one:S.cfg.oneTask!==false,multi:S.cfg.multi!==false})}};
async function interpretText(text){const order=S.cfg.aiOn===false?['offline']:['qwen','offline'];let fail=null;
  for(const k of order){const P=PROVIDERS[k];if(!P.ok())continue;try{const r=await P.run(text);r.prov=P.label;r.fail=fail;return r}catch(e){fail=(e&&e.code==='not_configured')?fail:(fail||(P.label+' is temporarily unavailable'))}}}
function newPV(text,r){const out=r[r.pick]||r.single;return{text,r,pick:r.pick,out,prov:r.prov,fail:r.fail,on:out.tasks.map(()=>true),rem:{},keep:true}}
async function plan(text,mode){
  if(mode==='dump'){const out=extract(text,'dump');PV=newPV(text,{pick:'single',single:out,multi:null,prov:'Offline reader'});sheetPreview();return}
  sheet('<p class="mute">Reading your message…</p>');PV=newPV(text,await interpretText(text));sheetPreview()}
function complete(id){const t=byId(id);if(!t)return;t.status='done';t.doneAt=new Date().toISOString();S.level.done++;ev('done');touch(t);nextRecurrence(t);
  const kids=live().filter(x=>x.status==='waiting'&&x.cond&&x.cond.parentId===id);
  if(kids.length){sheet(`<h1>One quick check</h1>`+kids.map(k=>`<div class="card"><p><b>${esc(k.title)}</b></p><p class="mute">Only if: ${esc(k.cond.text)}</p><div class="row"><button class="btn p" data-a="yes" data-id="${k.id}">Yes, it applies</button><button class="btn" data-a="no" data-id="${k.id}">No, skip it</button></div></div>`).join(''))}
  else toast('Done. Nice start.');render()}
function breakDown(id){const t=byId(id);if(!t)return;t.usedSmall=true;ev('small');touch(t);sheet(`<h1>${esc(t.title)}</h1><p class="mute">First step</p><div class="card now"><h1>${esc(firstStep(t))}</h1></div>
  <div class="row"><button class="btn p" data-a="two" data-id="${id}">Start first step (2 min)</button><button class="btn" data-a="steps" data-id="${id}">Show all steps</button></div>`)}

/* ================= Focus ================= */
function startFocus(id,secs,mode){const t=byId(id);if(!t)return;S.level.starts++;ev('start');t.startedAt=t.startedAt||new Date().toISOString();touch(t);
  F={id,total:secs,end:Date.now()+secs*1000,mode,paused:null};closeSheet();tab='focus';render();clearInterval(startFocus.i);startFocus.i=setInterval(tick,500)}
function tick(){if(!F||F.paused)return;const left=Math.max(0,Math.round((F.end-Date.now())/1000));
  if(left<=0){clearInterval(startFocus.i);F.over=true;S.fm+=F.total;save();if(F.mode==='two')sheetTwoDone();else toast('Time is up');if(tab==='focus')render();return}
  const b=$('#fb');if(b){b.textContent=mm(left);const c=$('#fc');c.style.strokeDashoffset=String(754*(1-left/F.total))}}
const mm=s=>String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
function sheetTwoDone(){const t=byId(F.id);sheet(`<h1>You’re already moving.</h1><p class="mute">Starting counts.</p><div class="row"><button class="btn p" data-a="keep" data-id="${t.id}">Keep going</button><button class="btn ok" data-a="finish" data-id="${t.id}">Done</button><button class="btn" data-a="brk">Take a break</button></div>`)}

/* ================= Reminders ================= */
async function notify(t){const link=safeUrl(t.link);const body=S.cfg.priv?'You have a scheduled reminder.':(due(t)?'Due '+due(t).toLowerCase()+'. ':'')+noteTxt(t);
  const o={body,tag:t.id,data:{id:t.id,link},actions:[{action:'start',title:link?'Open & start':'Start'},{action:'snooze',title:'Later'}]};
  try{const r=await navigator.serviceWorker.ready;if(Notification.permission==='granted'){await r.showNotification(S.cfg.priv?'Nemu':t.title,o);return}}catch(e){}
  toast(t.title+' — '+noteTxt(t))}
function checkReminders(){const now=Date.now(),max=S.cfg.mode==='gentle'?1:S.cfg.mode==='balanced'?Math.min(2,S.cfg.maxRem):S.cfg.maxRem,gap=15*60000;
  if(quiet())return;routineDue();live().forEach(t=>{if(t.status!=='open'||!t.remindAt||F&&F.id===t.id)return;
    const at=Date.parse(t.remindAt);if(now<at)return;if(t.remCount>=max)return;if(t.lastRem&&now-t.lastRem<gap)return;
    t.remCount++;t.lastRem=now;notify(t);save()})}
function snoozeSheet(id){sheet(`<h1>Snooze</h1><div class="chips">${[5,15,30].map(m=>`<button class="btn" data-a="sn" data-m="${m}" data-id="${id}">${m} min</button>`).join('')}</div>
  <h2>What’s in the way? (optional)</h2><div class="chips">${['Busy','Too tired','Too difficult','Too big','Wrong place','Need help'].map(b=>`<button class="btn" data-a="blk" data-b="${b}" data-id="${id}">${b}</button>`).join('')}</div>`)}

/* ================= Sync (Supabase REST, offline-first) ================= */
let syncing=false;
const H=()=>({apikey:S.cfg.sbKey,Authorization:'Bearer '+S.session.access_token,'Content-Type':'application/json'});
async function sync(){if(syncing||!S.cfg.sbUrl||!S.session||!navigator.onLine)return;syncing=true;
  try{const u=S.cfg.sbUrl.replace(/\/$/,'')+'/rest/v1/tasks';const dirty=S.tasks.filter(t=>t.dirty);
    if(dirty.length){const r=await fetch(u+'?select=id,updated_at&id=in.('+dirty.map(t=>t.id).join(',')+')',{headers:H()});const srv=await r.json();
      const conf=dirty.filter(t=>{const s=srv.find(x=>x.id===t.id);return s&&t.baseV&&s.updated_at!==t.baseV});
      conf.forEach(t=>{t.conflict=true});const okT=dirty.filter(t=>!t.conflict);
      if(okT.length){const rows=okT.map(t=>({id:t.id,title:t.title,status:t.status,deadline:t.deadline,scheduled_at:t.scheduledAt,deleted:!!t.deleted,reminder_at:t.status==='open'?t.remindAt:null,updated_at:t.updatedAt,data:strip(t)}));
        const w=await fetch(u+'?on_conflict=id',{method:'POST',headers:Object.assign(H(),{Prefer:'resolution=merge-duplicates,return=representation'}),body:JSON.stringify(rows)});
        if(w.ok){(await w.json()).forEach(x=>{const t=byId(x.id);if(t){t.baseV=x.updated_at;t.dirty=false}})}}
      if(conf.length)conflictSheet()}
    const since=S.cfg.lastSync?'&updated_at=gt.'+encodeURIComponent(S.cfg.lastSync):'';
    const g=await fetch(u+'?select=*'+since,{headers:H()});const rows=await g.json();
    if(Array.isArray(rows))rows.forEach(x=>{const l=byId(x.id);const rem=Object.assign({},x.data,{id:x.id,deleted:x.deleted,baseV:x.updated_at,updatedAt:x.updated_at,dirty:false});
      if(!l)S.tasks.push(rem);else if(!l.dirty)Object.assign(l,rem);else if(l.updatedAt!==x.updated_at){l.conflict=true;l.remote=rem}
      S.cfg.lastSync=x.updated_at>(S.cfg.lastSync||'')?x.updated_at:S.cfg.lastSync});
    save();render()}catch(e){}finally{syncing=false}}
const strip=t=>{const c=Object.assign({},t);['dirty','conflict','remote','baseV','source'].forEach(k=>delete c[k]);return c};
function conflictSheet(){const c=S.tasks.filter(t=>t.conflict);if(!c.length)return;
  sheet('<h1>Changed on two devices</h1><p class="mute">Nothing was overwritten. Pick the version to keep.</p>'+c.map(t=>`<div class="card"><p><b>${esc(t.title)}</b></p><div class="row"><button class="btn p" data-a="mine" data-id="${t.id}">Keep this device</button><button class="btn" data-a="theirs" data-id="${t.id}">Keep other device</button></div></div>`).join(''))}
async function auth(kind,email,pw){const b=S.cfg.sbUrl.replace(/\/$/,'')+'/auth/v1/'+(kind==='up'?'signup':'token?grant_type=password');
  const r=await fetch(b,{method:'POST',headers:{apikey:S.cfg.sbKey,'Content-Type':'application/json'},body:JSON.stringify({email,password:pw})});const j=await r.json();
  if(j.access_token){S.session={access_token:j.access_token,refresh_token:j.refresh_token,email};save();toast('Signed in');sync();aiStatus().then(()=>render());render();return}
  toast(j.msg||j.error_description||'Check your email to confirm, then sign in')}

/* ================= UI ================= */
const sheetEl=()=>$('#sheet');
function sheet(h){const e=sheetEl();e.innerHTML='<div>'+h+'<div class="row"><button class="btn g" data-a="close">Close</button></div></div>';e.classList.add('on')}
function closeSheet(){sheetEl().classList.remove('on');sheetEl().innerHTML=''}
function go(t){tab=t;render();scrollTo(0,0)}
function sheetAdd(mode){sheet(`<h1>${mode==='dump'?t_('dump'):'Paste a message'}</h1><p class="mute">${mode==='dump'?'Write everything in your head. Separate with commas or new lines.':'Paste a message or type it. One task or many.'}</p>
  <textarea id="qa" placeholder="${mode==='dump'?'wash shoes, call mum, buy shampoo…':'Tomorrow please check stock before 10 AM, then update Nurdin…'}" aria-label="Text"></textarea>
  <p class="small mute">${S.cfg.aiOn!==false&&aiReady()&&AIS.status!=='not_configured'?'This text will be sent to your server, which asks Qwen to understand it.':'Read on this device. Nothing is sent anywhere.'}</p>
  <div class="row"><button class="btn p" data-a="plan" data-m="${mode||'paste'}">Send</button><button class="btn" data-a="mic">🎙 Voice</button><button class="btn" data-a="clip">📋 Paste</button></div>`);setTimeout(()=>{const q=$('#qa');q&&q.focus()},50)}
const mins=d=>{const m=Math.round((Date.parse(d)-Date.now())/60000);return m<0?'time has passed':m<60?m+' minutes away':Math.round(m/60)+' hours away'};
const pct=t=>{const a=Date.parse(t.createdAt),b=Date.parse(t.deadline);return Math.max(2,Math.min(100,Math.round((Date.now()-a)/(b-a)*100)))};
function nextRecurrence(t){if(!t.rec)return;const step=t.rec==='daily'?1:7,base=Date.parse(t.deadline||t.scheduledAt||(t.day?atTime(t.day,23,59).toISOString():new Date().toISOString()));
  const k=Math.max(1,Math.ceil((Date.now()-base)/(step*864e5))),sh=ms=>ms?new Date(Date.parse(ms)+k*step*864e5).toISOString():null,now=new Date().toISOString();
  const n=Object.assign({},strip(t),{id:uid(),status:'open',doneAt:null,startedAt:null,snooze:0,remCount:0,lastRem:null,afterId:null,cond:null,baseV:null,origRemind:null,adaptDismissed:false,createdAt:now,updatedAt:now,dirty:true,
    deadline:sh(t.deadline),scheduledAt:sh(t.scheduledAt),remindAt:sh(t.remindAt),day:t.day?dayStr(new Date(atTime(t.day,12,0).getTime()+k*step*864e5)):null});S.tasks.push(n);save()}
function taskPrev(p,i,multi){const ds=p.deadline?p.deadlineSource:p.day?p.daySource:'none';
  return`<div class="card pv">${multi?`<input type="checkbox" data-a="tog" data-i="${i}" ${PV.on[i]?'checked':''} aria-label="Include this task">`:''}<div class="t">
  <p class="lbl">Task</p><input type="text" data-a="ttl" data-i="${i}" value="${esc(p.title)}" aria-label="Task">
  ${p.brief?`<p class="lbl">Task Brief</p><p>${esc(p.brief)}</p>`:''}
  ${due(p)?`<p class="lbl">Due</p><p>${src(ds)}${esc(due(p))}</p>`:`<p class="small mute" style="margin-top:8px">No due date. <select data-a="sug" data-i="${i}" aria-label="Add a reminder"><option value="">Want a reminder?</option><option value="tonight">Tonight, 8 PM</option><option value="tomorrow">Tomorrow, 9 AM</option></select></p>`}
  ${safeUrl(p.link)?`<p class="lbl">Task Link</p><p>${linkBtn(p)}</p>`:''}
  ${p.rec?`<p class="small mute">Repeats ${p.rec==='daily'?'every day':'every week'}</p>`:''}
  ${p.afterIdx!=null&&PV.out.tasks[p.afterIdx]?`<p class="small mute">After: ${esc(PV.out.tasks[p.afterIdx].title)}</p>`:''}${p.condition?`<p class="small"><span class="tag u">Only if</span>${esc(p.condition.text)}</p>`:''}${p.note?`<p class="small mute">${esc(p.note)}</p>`:''}
  ${p.scheduledAt&&clash(p.scheduledAt)?`<p class="small"><span class="tag u">Busy</span>${esc(clash(p.scheduledAt).t)} until ${fmtT(clash(p.scheduledAt).e)} <button class="btn" data-a="aft" data-i="${i}">Schedule after it</button></p>`:''}
  ${p.remindAt?`<p class="small">${src(p.remindSource)}Reminder ${fmtT(p.remindAt)}</p>`:p.day?`<p class="small">Reminder: <select data-a="rem" data-i="${i}" aria-label="Reminder time"><option value="">None</option><option value="08:00">8:00 AM</option><option value="09:00">9:00 AM</option><option value="19:00">7:00 PM</option></select></p>`:''}
  <button class="btn g" data-a="editpv" data-i="${i}">Edit</button></div></div>`}
function sheetPreview(){const o=PV.out,n=o.tasks.length;
  let x=n>1?`<h1>I found ${n} separate things to do</h1>`:`<h1>${n?'Got it.':'Nothing found'}</h1>`;
  x+=`<p class="small mute">Read by: ${esc(PV.prov)}.${PV.fail?' '+esc(PV.fail)+', so the offline reader was used.':''} Nothing is saved until you press Create.</p>`;
  x+=n?o.tasks.map((p,i)=>taskPrev(p,i,n>1)).join(''):`<div class="card"><p>I couldn’t find a task in that. Try rewording, or create it yourself.</p><button class="btn p w" data-a="manual">Create task manually</button></div>`;
  if(o.uncertain&&o.uncertain.length)x+=`<div class="card"><p class="small"><b>Not sure about</b></p>${o.uncertain.map(u=>`<p class="small mute">${esc(u)}</p>`).join('')}</div>`;
  if(n===1)x+=`<div class="card"><input type="text" id="fu" placeholder="Change something… e.g. Make that Saturday" aria-label="Change something"><div class="row"><button class="btn" data-a="refine">Update</button></div></div>`;
  if(n){x+=`<label class="small"><input type="checkbox" data-a="keep" ${PV.keep?'checked':''}> Keep the original text for reference</label>
  <div class="row"><button class="btn p" data-a="create">${n>1?'Create '+PV.on.filter(Boolean).length+' tasks':'Create task'}</button></div>`;
    const alt=PV.pick==='single'&&PV.r.multi&&PV.r.multi.tasks.length>1?`<button class="btn" data-a="split">Split into ${PV.r.multi.tasks.length} tasks</button>`:PV.pick==='multi'?`<button class="btn" data-a="merge">Keep as one</button>`:'';
    x+=`<div class="row">${alt}<button class="btn g" data-a="cancelpv">Cancel</button></div>`}
  else x+=`<div class="row"><button class="btn g" data-a="cancelpv">Cancel</button></div>`;
  sheet(x)}
function manualSheet(ctx){const q=ctx.kind==='pv'?PV.out.tasks[ctx.i]:ctx.kind==='task'?byId(ctx.id):{};MC=ctx;
  const dl=q.deadline?new Date(q.deadline):q.scheduledAt?new Date(q.scheduledAt):null,d=q.day||(dl?dayStr(dl):''),tm=dl&&!q.dateOnly?String(dl.getHours()).padStart(2,'0')+':'+String(dl.getMinutes()).padStart(2,'0'):'';
  sheet(`<h1>${ctx.kind==='new'?'Create task':'Edit task'}</h1>
  <p class="lbl">Task</p><input type="text" id="m_t" maxlength="120" value="${esc(q.title||'')}" aria-label="Task">
  <p class="lbl">Task Brief (optional)</p><textarea id="m_b" style="min-height:90px" maxlength="240" aria-label="Task Brief">${esc(q.brief||'')}</textarea>
  <p class="lbl">Due (optional)</p><div class="row" style="margin-top:0"><input type="date" id="m_d" value="${d}" aria-label="Due date"><input type="time" id="m_h" value="${tm}" aria-label="Due time"></div>
  <p class="lbl">Task Link (optional)</p><input type="text" id="m_l" inputmode="url" value="${esc(q.link||'')}" placeholder="https://…" aria-label="Task Link">
  <div class="row"><button class="btn p" data-a="msave">Save</button></div>`);setTimeout(()=>{const e=$('#m_t');e&&e.focus()},50)}
function manualSave(){const title=$('#m_t').value.trim();if(!title)return toast('Add a task name');
  const lk=$('#m_l').value.trim();let link=null;if(lk){link=safeUrl(/^https?:\/\//i.test(lk)?lk:'https://'+lk);if(!link)return toast('That link does not look valid')}
  const d=$('#m_d').value,h=$('#m_h').value,f={title:title.slice(0,120),brief:$('#m_b').value.trim().slice(0,240)||null,link};
  if(d){f.day=d;f.daySource='explicit';f.fuzzy=null;f.scheduledAt=null;f.deadlineSource='explicit';
    if(h){const [a,b]=h.split(':').map(Number);f.deadline=atTime(d,a,b).toISOString();f.dateOnly=false;const r=Date.parse(f.deadline)-45*60000;f.remindAt=r>Date.now()?new Date(r).toISOString():null;f.remindSource=f.remindAt?'suggested':'none'}
    else{f.deadline=atTime(d,23,59).toISOString();f.dateOnly=true;f.remindAt=null}}
  else Object.assign(f,{day:null,daySource:'none',deadline:null,deadlineSource:'none',dateOnly:false,scheduledAt:null,fuzzy:null,remindAt:null});
  if(MC.kind==='pv'){Object.assign(PV.out.tasks[MC.i],f);sheetPreview()}
  else if(MC.kind==='task'){const t=byId(MC.id);Object.assign(t,f);t.remCount=0;touch(t);detailSheet(t.id);render()}
  else{const now=new Date().toISOString();S.tasks.push(Object.assign({id:uid(),steps:stepsFor(f.title),effort:'small',minutes:5,people:[],status:'open',remCount:0,snooze:0,source:null,sourceType:'manual',createdAt:now,updatedAt:now,dirty:true},f));save();sync();closeSheet();toast('Task created');go('today')}}
function detailSheet(id){const t=byId(id);if(!t)return;const dd=due(t);
  sheet(`<p class="mute">${t.status==='done'?'Done':t.status==='waiting'?'Waiting':'Upcoming'}</p><h1>${esc(t.title)}</h1>
  ${t.brief?`<p class="lbl">Task Brief</p><p>${esc(t.brief)}</p>`:''}${dd?`<p class="lbl">Due</p><p>${esc(dd)}</p>`:''}${safeUrl(t.link)?`<p class="lbl">Task Link</p><p>${linkBtn(t)}</p>`:''}
  ${t.status==='open'?`<div class="row"><button class="btn p" data-a="go25" data-id="${id}">Start</button><button class="btn ok" data-a="fin" data-id="${id}">Done</button></div>`:''}
  <details class="menu"><summary>More</summary><div class="row"><button class="btn" data-a="edit" data-id="${id}">Edit</button><button class="btn" data-a="edit" data-id="${id}">Reschedule</button><button class="btn" data-a="dup" data-id="${id}">Duplicate</button><button class="btn" data-a="del" data-id="${id}">Delete</button></div></details>`)}
function addMenu(){sheet(`<h1>Add something</h1><div class="col"><button class="btn p w" data-a="tell">Tell Nemu</button><button class="btn w" data-a="paste">Paste a longer message</button><button class="btn w" data-a="manual">Create manually</button><button class="btn w" data-a="dumpq">Brain dump</button></div>`)}
function sendComposer(){const el=$('#cmp'),v=el&&el.value.trim();if(!v)return toast('Type something first');el.value='';el.style.height='auto';plan(v,'paste')}
function refineNow(){const el=$('#fu'),v=el&&el.value.trim();if(!v||!PV)return;if(refineDraft(PV.out.tasks[0],v))sheetPreview();else toast('I’m not sure what to change. Use Edit.')}
const composer=()=>`<div class="card comp"><label for="cmp" class="small mute">What do you need to do?</label><div class="cwrap"><textarea id="cmp" rows="1" placeholder="Tell Nemu…" aria-label="Tell Nemu what you need to do"></textarea><button class="send" data-a="send" aria-label="Send">↑</button></div>
  <p class="small mute" style="margin:8px 0 0">Try: “Friday remind me to submit Geography.”</p><div class="row" style="margin-top:4px"><button class="btn g" data-a="add">More ways to add</button><button class="btn g" data-a="chat">AI Assistant</button></div></div>`;
const nextRow=t=>`<button class="card trow" data-a="det" data-id="${t.id}"><span class="small mute">${esc(due(t))||'No due date'}</span><br><b>${esc(t.title)}</b></button>`;
function renderToday(){const r=ranked(),n=r[0],h=new Date().getHours(),nm=S.cfg.name?', '+esc(S.cfg.name):'';
  let x=`<h1>${h<12?'Good morning':h<18?'Good afternoon':'Good evening'}${nm}.</h1><p class="mute">Let’s make today manageable.</p>`+composer();
  x+=`<div class="seg" role="group" aria-label="Energy"><span class="small mute">Energy</span>${['low','medium','high'].map(e=>`<button data-a="en" data-v="${e}" aria-pressed="${S.cfg.energy===e}">${cap(e)}</button>`).join('')}</div>`;
  const ad=live().find(t=>t.status==='open'&&t.snooze>=3&&!t.adaptDismissed&&t.origRemind);
  if(ad)x+=`<div class="card"><p><b>${fmtT(ad.origRemind)} doesn’t seem to be working for “${esc(ad.title)}”.</b></p><p class="mute">Want to try 8 PM?</p><div class="row"><button class="btn p" data-a="try" data-id="${ad.id}">Try it</button><button class="btn" data-a="keept" data-id="${ad.id}">Keep ${fmtT(ad.origRemind)}</button></div></div>`;
  if(n){const dd=due(n);x+=`<h2>Now</h2><div class="card now"><h1>${esc(n.title)}</h1>${n.brief?`<p class="mute">${esc(n.brief)}</p>`:''}<p class="small mute">${[dd,n.deadline&&!n.dateOnly?mins(n.deadline):'',n.minutes?'About '+n.minutes+' min':''].filter(Boolean).map(esc).join(' · ')}</p>
    ${n.deadline&&!n.dateOnly?`<div class="bar" aria-hidden="true"><i style="width:${pct(n)}%"></i></div>`:''}<p style="margin-top:12px"><b>First step:</b> ${esc(firstStep(n))}</p>
    <div class="row"><button class="btn p" data-a="${S.cfg.autoSmall?'two':'go25'}" data-id="${n.id}">${t_('start')}</button>${linkBtn(n,'btn')}</div>
    <details class="menu"><summary>More</summary><div class="row"><button class="btn ok" data-a="fin" data-id="${n.id}">${t_('done')}</button><button class="btn" data-a="two" data-id="${n.id}">${t_('two')}</button><button class="btn" data-a="sm" data-id="${n.id}">${t_('smaller')}</button><button class="btn" data-a="skip" data-id="${n.id}">${t_('notthis')}</button><button class="btn" data-a="snz" data-id="${n.id}">Later</button></div></details></div>`;
    const nx=r.slice(1,4);if(nx.length)x+=`<h2>Next</h2>`+nx.map(nextRow).join('')+(r.length>4?`<div class="row"><button class="btn g" data-a="go" data-t="tasks">View all (${r.length})</button></div>`:'')}
  else x+=`<div class="card"><p>${t_('empty')}</p></div>`;
  const lv=S.level.starts+S.level.done*2;return x+`<p class="small mute" style="margin-top:22px">${lv<5?'🌱 Starting':lv<25?'🌿 Growing':'🌳 Strong'} · ${S.level.starts} starts, ${S.level.done} done</p>`}
function renderTasks(){const a=live().filter(t=>t.status!=='done'&&t.status!=='cancelled');let x='<h1>Tasks</h1>';
  x+=a.length?a.map(t=>`<div class="card trow2"><button class="tl" data-a="det" data-id="${t.id}">${esc(t.title)}</button><p class="small mute" style="margin:2px 0 0">${esc(due(t))||'No due date'}${t.status==='waiting'?' · waiting: '+esc(t.cond.text):''}${t.afterId&&byId(t.afterId)&&byId(t.afterId).status!=='done'?' · after: '+esc(byId(t.afterId).title):''}</p>
   <div class="row" style="align-items:center"><button class="btn ok" data-a="fin" data-id="${t.id}">Done</button>${linkBtn(t,'btn')}</div></div>`).join(''):`<div class="card"><p>${t_('empty')}</p></div>`;
  const d=live().filter(t=>t.status==='done').length;return x+`<p class="small mute">${d} finished</p>`+routinesHtml()}
function renderFocus(){if(!F)return`<h1>Focus</h1><div class="card"><p>Pick a task on Today, then press Start. Or try 2 minutes: you don’t need to finish, just begin.</p></div><div class="row"><button class="btn p w" data-a="go" data-t="today">Go to Today</button></div>`;
  const t=byId(F.id),left=F.paused!=null?Math.round(F.paused/1000):Math.max(0,Math.round((F.end-Date.now())/1000));
  return`<p class="mute" style="text-align:center">${F.mode==='two'?'You don’t need to finish. Just begin.':'Focus'}</p><h1 style="text-align:center">${esc(t.title)}</h1>${t.brief?`<p class="mute" style="text-align:center">${esc(t.brief)}</p>`:''}
  <div class="ring"><svg width="240" height="240" viewBox="0 0 240 240" aria-hidden="true"><circle cx="120" cy="120" r="120" fill="none" stroke="var(--line)" stroke-width="14" transform="scale(.97) translate(4 4)"/><circle id="fc" cx="120" cy="120" r="120" fill="none" stroke="var(--pri)" stroke-width="14" stroke-linecap="round" stroke-dasharray="754" stroke-dashoffset="${754*(1-left/F.total)}" transform="scale(.97) translate(4 4)"/></svg><b id="fb">${mm(left)}</b></div>
  <div class="row"><button class="btn ok" data-a="fin" data-id="${t.id}">Done</button><button class="btn" data-a="pause">${F.paused!=null?'Resume':'Pause'}</button></div>
  <div class="row">${linkBtn(t,'btn')}<button class="btn g" data-a="stuck" data-id="${t.id}">I’m stuck</button></div>`}
function renderYou(){const c=S.cfg;const sel=(k,v,o)=>`<select data-a="cfg" data-k="${k}" aria-label="${k}">${o.map(x=>`<option value="${x[0]}" ${String(v)===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select>`;
  const chk=(k,l)=>`<label class="small" style="display:block;margin:8px 0"><input type="checkbox" data-a="cfg" data-k="${k}" ${c[k]!==false&&c[k]?'checked':''}> ${l}</label>`;
  return`<h1>You</h1><h2>Preferences</h2><div class="card"><p class="small mute">Your name (for the greeting)</p><input type="text" data-a="cfg" data-k="name" value="${esc(c.name)}" maxlength="30" aria-label="Your name">
  <p class="small mute" style="margin-top:10px">Theme</p>${sel('theme',c.theme,[['system','System'],['light','Light'],['dark','Dark']])}<p class="small mute" style="margin-top:10px">Language</p>${sel('lang',c.lang,[['en','English'],['ms','Bahasa Melayu']])}
  ${chk('large','Large text')}<p class="small mute">Reminder style</p>${sel('mode',c.mode,[['gentle','Gentle: one reminder'],['balanced','Balanced: a little follow-up'],['persistent','Persistent: up to your limit']])}
  <p class="small mute" style="margin-top:10px">Wording</p>${sel('persona',c.persona,[['minimal','Minimal'],['gentle','Gentle'],['direct','Direct'],['encouraging','Encouraging']])}
  <p class="small mute" style="margin-top:10px">Quiet hours</p><div class="row" style="margin-top:0"><input type="time" data-a="cfg" data-k="qs" value="${c.qs}" aria-label="Quiet from"><input type="time" data-a="cfg" data-k="qe" value="${c.qe}" aria-label="Quiet until"></div>
  <p class="small mute" style="margin-top:10px">Most reminders per task</p>${sel('maxRem',c.maxRem,[['1','1'],['2','2'],['3','3'],['5','5']])}${chk('priv','Hide details on the lock screen')}<div class="row"><button class="btn" data-a="perm">Allow notifications</button></div></div>
  <h2>AI</h2><div class="card">${chk('aiOn','AI task interpretation')}${chk('oneTask','One message = one task')}${chk('multi','Detect several separate tasks')}
  <p class="small mute">${c.aiOn===false?'AI is off. Your text is read on this device only.':aiReady()&&AIS.status!=='not_configured'?'Your text is sent to your own server, which asks Qwen to understand it.':'No AI service is available. Your text is read on this device only.'} Nothing is saved without your approval.</p></div>
  <h2>Integrations</h2>${aiCard()}${calCard()}${pushCard()}
  ${statsCard()}<h2>Data</h2><div class="card"><div class="row" style="margin-top:0"><button class="btn" data-a="exp">Export</button><button class="btn" data-a="clearDone">Clear completed</button><button class="btn" data-a="wipe">Delete originals</button></div></div>${syncCard()}`}
function syncCard(){const c=S.cfg;return`<details class="menu card"><summary>Sync and storage (advanced)</summary><p class="small mute">${S.session?'Signed in as '+esc(S.session.email)+'. Last sync '+(c.lastSync?new Date(c.lastSync).toLocaleString():'never'):'Works fully offline. Sign in to sync across devices.'}</p>
  <input type="text" data-a="cfg" data-k="sbUrl" value="${esc(c.sbUrl)}" placeholder="Supabase project URL" aria-label="Supabase URL"><p></p><input type="text" data-a="cfg" data-k="sbKey" value="${esc(c.sbKey)}" placeholder="Supabase anon key" aria-label="Supabase key"><p></p>
  ${S.session?`<div class="row"><button class="btn p" data-a="syncnow">Sync now</button><button class="btn" data-a="out">Sign out</button></div>`:`<input type="email" id="em" placeholder="Email" aria-label="Email"><p></p><input type="password" id="pw" placeholder="Password" aria-label="Password"><div class="row"><button class="btn p" data-a="in">Sign in</button><button class="btn" data-a="up">Create account</button></div>`}</details>`}
const ICO={'today': '<path d="M4 11.5 12 4l8 7.5V20H4z"/>', 'tasks': '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>', 'focus': '<circle cx="12" cy="13" r="7"/><path d="M12 9v4l2.5 2M9.5 3h5"/>', 'you': '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'};
const NAV=[['today',t_('today')],['tasks',t_('tasks')],['add'],['focus',t_('focus')],['you',t_('you')]];
function render(){const v=$('#view');NAV[0][1]=t_('today');NAV[1][1]=t_('tasks');NAV[3][1]=t_('focus');NAV[4][1]=t_('you');
  if(!S.onboarded){v.innerHTML=`<h1>Nemu</h1><p class="mute">Tell it once. Start when it matters.</p><div class="card"><p>What usually gets in your way?</p><div class="chips">${['I forget','I procrastinate','I lose track of time','Tasks feel too big','I ignore notifications','I struggle to start','I get overwhelmed'].map(x=>`<label class="btn" style="display:flex;align-items:center;gap:8px"><input type="checkbox"> ${x}</label>`).join('')}</div></div>
  <div class="card"><p>How should I remind you?</p>${['gentle','balanced','persistent'].map(m=>`<button class="btn w" style="margin:4px 0" data-a="ob" data-m="${m}">${m[0].toUpperCase()+m.slice(1)}</button>`).join('')}</div>`;$('#nav').style.display='none';return}
  $('#nav').style.display='flex';
  v.innerHTML={today:renderToday,tasks:renderTasks,focus:renderFocus,you:renderYou}[tab]();
  $('#nav').innerHTML=[['today','◉',t_('today')],['tasks','☰',t_('tasks')],['add','+',''],['focus','◔',t_('focus')],['you','☺',t_('you')]].map(x=>x[0]==='add'?`<button class="plus" data-a="add" aria-label="Quick add">+</button>`:`<button data-a="go" data-t="${x[0]}" ${tab===x[0]?'aria-current="page"':''}><span aria-hidden="true">${x[1]}</span>${x[2]}</button>`).join('');
  document.documentElement.dataset.theme=S.cfg.theme==='system'?'':S.cfg.theme;document.documentElement.dataset.large=S.cfg.large?'on':'off';document.documentElement.lang=S.cfg.lang==='ms'?'ms':'en'}

/* ================= V2 helpers ================= */
let RT=null,MC=null;
const ev=y=>{S.ev.push({y,t:Date.now(),h:new Date().getHours()});if(S.ev.length>500)S.ev.shift()};
const clash=iso=>iso&&S.cal.find(c=>Date.parse(c.s)<=Date.parse(iso)&&Date.parse(iso)<Date.parse(c.e));
function parseICS(txt){const out=[];txt=txt.replace(/\r?\n[ \t]/g,'');txt.split('BEGIN:VEVENT').slice(1).forEach(b=>{
  const g=k=>{const m=b.match(new RegExp('^'+k+'[^:\\n]*:(.*)$','m'));return m?m[1].trim():null};
  const d=v=>{const m=(v||'').match(/^(\d{4})(\d\d)(\d\d)(?:T(\d\d)(\d\d)(\d\d)?(Z)?)?$/);if(!m)return null;return m[7]?new Date(Date.UTC(+m[1],m[2]-1,+m[3],+m[4],+m[5])):new Date(+m[1],m[2]-1,+m[3],+(m[4]||0),+(m[5]||0))};
  const s=d(g('DTSTART'));if(!s)return;const e=d(g('DTEND'))||new Date(s.getTime()+3600000);out.push({s:s.toISOString(),e:e.toISOString(),t:(g('SUMMARY')||'Busy').slice(0,60)})});return out.slice(0,2000)}
const routinesHtml=()=>`<h2>Routines</h2>`+(S.routines.length?S.routines.map(r=>`<div class="card"><p style="margin:0;font-weight:700">${esc(r.title)}</p><p class="small mute">${r.steps.length} steps${r.time?' · daily '+r.time:''}</p><div class="row"><button class="btn p" data-a="rgo" data-id="${r.id}">Start</button><button class="btn" data-a="rdel" data-id="${r.id}">Remove</button></div></div>`).join(''):'<p class="small mute">A routine shows one step at a time. Example: Morning.</p>')+`<div class="row"><button class="btn w" data-a="rnew">New routine</button></div>`;
function routineSheet(){const r=S.routines.find(x=>x.id===RT.id);if(!r)return;
  if(RT.i>=r.steps.length){S.level.done++;save();RT=null;sheet(`<h1>${esc(r.title)} complete 🌿</h1><p class="mute">Nice work.</p>`);return}
  sheet(`<p class="mute">${esc(r.title)} · ${RT.i+1} of ${r.steps.length}</p><div class="card now"><h1>${esc(r.steps[RT.i])}</h1></div><div class="row"><button class="btn ok" data-a="rdone">Done</button><button class="btn" data-a="rskip">Skip</button></div>`)}
function routineDue(){const n=new Date(),hm=String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0'),dk=dayStr(n);
  S.routines.forEach(r=>{if(r.time&&r.last!==dk&&hm>=r.time){r.last=dk;save();notify({id:'r:'+r.id,title:r.title,steps:[r.steps[0]]})}})}
function statsCard(){const L=live(),st=S.ev.filter(x=>x.y==='start'),sn=S.ev.filter(x=>x.y==='snooze').length,h={};st.forEach(x=>h[x.h]=(h[x.h]||0)+1);
  const b=Object.entries(h).sort((x,y)=>y[1]-x[1])[0],r=a=>a.length?Math.round(a.filter(t=>t.startedAt).length/a.length*100):null;
  const sm=L.filter(t=>t.usedSmall),ns=L.filter(t=>!t.usedSmall&&t.status!=='waiting'),rs=r(sm),rn=r(ns);
  const ins=rs!=null&&rn!=null&&sm.length>=3&&rs>rn?`<p>Tasks you made smaller get started more often (${rs}% vs ${rn}%).</p><label class="small"><input type="checkbox" data-a="cfg" data-k="autoSmall" ${S.cfg.autoSmall?'checked':''}> Start with the 2-minute step by default</label>`:'<p class="small mute">Insights appear after a few days of use.</p>';
  return`<div class="card"><p><b>What helps me start?</b></p><p>${st.length} starts · ${Math.round(S.fm/60)} focus minutes · ${L.length?(sn/L.length).toFixed(1):0} snoozes per task</p>${b?`<p class="small mute">You start most often around ${b[0]}:00.</p>`:''}${ins}</div>`}
function pushCard(){return`<div class="card"><p><b>Reminders when the app is closed</b></p><p class="small mute">Needs sign-in and your VAPID public key (see README).</p><input type="text" data-a="cfg" data-k="vapid" value="${esc(S.cfg.vapid)}" placeholder="VAPID public key" aria-label="VAPID public key"><div class="row"><button class="btn p" data-a="push">Turn on background reminders</button></div></div>
`}
function calCard(){return`<div class="card"><p><b>Calendar</b></p><p class="small mute">${S.cal.length?S.cal.length+' events loaded. ':''}Import an .ics file. Nemu only warns about clashes and never changes your calendar. Repeating events are not expanded.</p><input type="file" accept=".ics,text/calendar" data-a="ics" aria-label="Import calendar file"></div>`}
const b64u=s=>{const r=atob((s+'='.repeat((4-s.length%4)%4)).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...r].map(c=>c.charCodeAt(0)))};
async function pushSync(sub){if(!S.session||!S.cfg.sbUrl)return;sub=sub||await (await navigator.serviceWorker.ready).pushManager.getSubscription();if(!sub)return;const j=sub.toJSON(),c=S.cfg;
  await fetch(c.sbUrl.replace(/\/$/,'')+'/rest/v1/push_subscriptions?on_conflict=endpoint',{method:'POST',headers:Object.assign(H(),{Prefer:'resolution=merge-duplicates'}),
   body:JSON.stringify({endpoint:j.endpoint,sub:j,qs:c.qs,qe:c.qe,tz_offset:new Date().getTimezoneOffset(),max_rem:c.mode==='gentle'?1:c.mode==='balanced'?Math.min(2,c.maxRem):c.maxRem,priv:!!c.priv})})}
async function enablePush(){try{if(!S.session||!S.cfg.vapid)return toast('Sign in and add the VAPID key first');if(!('PushManager'in window))return toast('Push not supported here. On iPhone, add to Home Screen first.');
  if(await Notification.requestPermission()!=='granted')return toast('Notifications blocked');const reg=await navigator.serviceWorker.ready;
  const sub=(await reg.pushManager.getSubscription())||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(S.cfg.vapid)});await pushSync(sub);toast('Background reminders on')}catch(e){toast('Could not turn on push: '+(e.message||e))}}

/* ================= AI Assistant, powered by Qwen =================
   The browser never sees a Qwen credential. It calls YOUR Supabase function (/functions/v1/api/ai/*) with the signed-in user's session;
   the function keeps the provider credentials as server secrets and talks to the model. */
let AIS={status:'unknown',model:'',host:'',msg:''};   // non-sensitive runtime status only: unknown | not_configured | configured | connected | failed
const aiBase=()=>S.cfg.sbUrl?S.cfg.sbUrl.replace(/\/$/,'')+'/functions/v1/api':null;
const aiReady=()=>!!(aiBase()&&S.session);
const aiLabel=()=>({connected:'Connected ✓',configured:'Configured. Press Test connection to verify.',not_configured:'Not configured',failed:'Connection failed',unknown:'Not checked yet'}[AIS.status]);
async function aiFetch(path,body){
  if(!aiReady()){const e=new Error('Sign in under Settings > Sync first. The AI Assistant only answers signed-in users.');e.code='no_session';throw e}
  let r;try{r=await fetch(aiBase()+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',apikey:S.cfg.sbKey,Authorization:'Bearer '+S.session.access_token},body:body?JSON.stringify(body):undefined})}
  catch(e){const x=new Error(navigator.onLine===false?'You appear to be offline.':'Could not reach the server. Check your connection.');x.code='network';throw x}
  let j=null;try{j=await r.json()}catch(e){}
  if(!r.ok){const er=j&&j.error&&typeof j.error==='object'?j.error:{};const x=new Error(typeof er.message==='string'?er.message:r.status===401?'Please sign in again (Settings > Sync).':'The AI Assistant is unavailable. Try again.');
    x.code=er.code||(r.status===401?'unauthorized':'unavailable');
    if(x.code==='not_configured')AIS.status='not_configured';else if(['auth_failed','model_unavailable','unavailable','timeout','bad_response'].includes(x.code))AIS.status='failed';
    AIS.msg=x.message;throw x}
  return j}
async function aiStatus(){if(!aiReady())return;try{const j=await aiFetch('/ai/status');AIS.model=String(j.model||'').slice(0,64);AIS.host=String(j.host||'').slice(0,80);AIS.msg='';if(AIS.status!=='connected')AIS.status=j.configured?'configured':'not_configured'}catch(e){}}
async function aiTest(){try{const j=await aiFetch('/ai/test',{});AIS.status='connected';AIS.msg='';AIS.model=String(j.model||AIS.model).slice(0,64)}catch(e){}}
function aiSheet(){sheet(`<h1>Connect Qwen AI</h1><p class="mute">Connect this application to a Qwen model. The administrator must configure the Qwen API key and endpoint securely on the server.</p>
  <div class="card"><p><b>Status:</b> ${esc(aiLabel())}</p>${AIS.model?`<p class="small mute">Model: ${esc(AIS.model)}${AIS.host?' · '+esc(AIS.host):''}</p>`:''}${AIS.msg&&AIS.status!=='connected'?`<p class="small">${esc(AIS.msg)}</p>`:''}
  ${!aiReady()?'<p class="small">Sign in under Settings > Sync (advanced) first. The server only answers signed-in users.</p>':''}</div>
  <div class="row"><button class="btn p" data-a="aitest" ${aiReady()?'':'disabled'}>Test connection</button>${AIS.status==='connected'||AIS.status==='configured'?'<button class="btn" data-a="chat">Open AI Assistant</button>':''}</div>`)}
const aiCard=()=>`<div class="card"><p><b>AI Assistant</b> <span class="small mute">Powered by Qwen</span></p><p class="small mute">Status: ${esc(aiLabel())}</p>
  <p class="small mute">Your messages go to your own server, which forwards them to a Qwen model. The API key stays on the server and never reaches this app.</p><div class="row"><button class="btn p" data-a="aiset">Connect Qwen AI</button><button class="btn" data-a="chat">Open chat</button></div></div>`;
/* ---- chat box ---- */
let CH={msgs:[],busy:false,err:null,last:null};
async function chatOpen(){if(!aiReady())return aiSheet();if(AIS.status==='unknown'||AIS.status==='failed')await aiStatus();if(AIS.status==='not_configured')return aiSheet();chatSheet()}
function chatSheet(){const b=t=>esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>');
  sheet(`<h1>AI Assistant</h1><p class="small mute">Powered by Qwen · ${esc(aiLabel())}</p><div id="cm" style="max-height:44vh;overflow:auto" aria-live="polite">${CH.msgs.length?CH.msgs.map(m=>`<div class="bub ${m.r}">${b(m.text)}</div>`).join(''):'<p class="mute">Ask anything, or paste a message and press Make tasks.</p>'}${CH.busy?'<div class="bub c mute">Thinking…</div>':''}</div>
  ${CH.err?`<div class="card"><p class="small">${esc(CH.err)}</p><div class="row"><button class="btn" data-a="cretry">Retry</button></div></div>`:''}
  <textarea id="cin" style="min-height:76px;margin-top:10px" placeholder="Message the AI Assistant" aria-label="Message the AI Assistant"></textarea>
  <div class="row"><button class="btn p" data-a="csend" ${CH.busy?'disabled':''}>Send</button><button class="btn" data-a="ctask" ${CH.msgs.length?'':'disabled'}>Make tasks from last message</button></div>
  <div class="row"><button class="btn g" data-a="cnew">New chat</button><button class="btn g" data-a="aiset">Connection</button></div>`);
  const m=$('#cm');if(m)m.scrollTop=m.scrollHeight}
async function chatSend(retry){const i=$('#cin'),t=retry?CH.last:(i&&i.value.trim());if(!t){toast('Type a message first');return}if(CH.busy)return;
  if(!retry){CH.msgs.push({r:'u',text:t});CH.last=t}CH.busy=true;CH.err=null;chatSheet();
  try{let h=CH.msgs.slice(-20).map(m=>({role:m.r==='u'?'user':'assistant',content:m.text})),n=0;while(h.length>1&&(n=h.reduce((a,m)=>a+m.content.length,0))>14000)h.shift();
    while(h.length&&h[0].role!=='user')h.shift();
    const j=await aiFetch('/ai/chat',{messages:h});if(typeof j.reply!=='string'||!j.reply.trim())throw Object.assign(new Error('The AI service sent an unexpected reply. Try again.'),{code:'bad_response'});
    CH.msgs.push({r:'c',text:j.reply});AIS.status='connected'}
  catch(e){CH.err=e.message||'Something went wrong. Try again.'}
  CH.busy=false;chatSheet()}

/* ================= Events ================= */
document.addEventListener('click',async e=>{const b=e.target.closest('[data-a]');if(!b||b.tagName==='SELECT'||b.type==='checkbox'||b.type==='time'||b.type==='text')return;const a=b.dataset.a,id=b.dataset.id,t=id&&byId(id);
  const A={go:()=>go(b.dataset.t),add:()=>addMenu(),close:closeSheet,cancelpv:()=>{PV=null;closeSheet()},create:createFromPreview,
   plan:()=>{const v=$('#qa').value.trim();if(v)plan(v,b.dataset.m)},clip:async()=>{try{$('#qa').value=await navigator.clipboard.readText()}catch(x){toast('Paste with long-press instead')}},
   mic:()=>{const R=window.SpeechRecognition||window.webkitSpeechRecognition;if(!R)return toast('Voice not supported here');const r=new R();r.lang=S.cfg.lang==='ms'?'ms-MY':'en-MY';r.onresult=ev=>{$('#qa').value+=ev.results[0][0].transcript};r.start()},
   go25:()=>startFocus(id,25*60,'focus'),two:()=>startFocus(id,120,'two'),fin:()=>{closeSheet();if(F&&F.id===id){if(!F.over)S.fm+=Math.round((F.total*1000-(F.paused!=null?F.paused:Math.max(0,F.end-Date.now())))/1000);F=null;clearInterval(startFocus.i)}complete(id)},
   sm:()=>breakDown(id),steps:()=>sheet(`<h1>${esc(t.title)}</h1>`+t.steps.map((s,i)=>`<div class="card">${i+1}. ${esc(s)}</div>`).join('')),
   skip:()=>{S.skip.push(id);save();render()},snz:()=>snoozeSheet(id),
   sn:()=>{if(!t.origRemind)t.origRemind=t.remindAt;ev('snooze');t.remindAt=new Date(Date.now()+b.dataset.m*60000).toISOString();t.remCount=0;t.snooze=(t.snooze||0)+1;touch(t);closeSheet();toast('Snoozed '+b.dataset.m+' min');render()},
   blk:()=>{t.blocker=b.dataset.b==='Too big'?'big':b.dataset.b;touch(t);toast(t.blocker==='big'?'Next time: just the first step':'Noted')},
   en:()=>{S.cfg.energy=S.cfg.energy===b.dataset.v?null:b.dataset.v;save();render()},
   yes:()=>{t.status='open';touch(t);closeSheet();render()},no:()=>{t.status='cancelled';touch(t);closeSheet();render()},
   keep:()=>{startFocus(id,25*60,'focus')},finish:()=>{closeSheet();F=null;complete(id)},brk:()=>{closeSheet();F=null;go('today')},
   pause:()=>{if(F.paused==null){F.paused=F.end-Date.now()}else{F.end=Date.now()+F.paused;F.paused=null}render()},
   stuck:()=>sheet(`<h1>Try this first</h1><div class="card now"><h1>${esc(firstStep(t))}</h1></div><div class="row"><button class="btn p" data-a="two" data-id="${id}">Do it for 2 minutes</button></div><details class="menu"><summary>Other options</summary><div class="row"><button class="btn" data-a="sm" data-id="${id}">Make it smaller</button><button class="btn" data-a="brk">Short break</button></div></details>`),
   del:()=>{if(confirm('Delete this task?')){t.deleted=true;touch(t);closeSheet();render()}},perm:async()=>{const p=await Notification.requestPermission();toast(p==='granted'?'Notifications on':'Notifications blocked')},
   ob:()=>{S.cfg.mode=b.dataset.m;S.onboarded=true;save();render()},mine:()=>{t.conflict=false;t.baseV=null;touch(t);closeSheet()},theirs:()=>{Object.assign(t,t.remote||{});t.conflict=false;t.dirty=false;delete t.remote;save();closeSheet();render()},
   in:()=>auth('in',$('#em').value,$('#pw').value),up:()=>auth('up',$('#em').value,$('#pw').value),out:()=>{S.session=null;save();render()},syncnow:()=>{S.cfg.lastSync=null;sync()},
   exp:()=>{const u=URL.createObjectURL(new Blob([JSON.stringify(S.tasks,null,1)],{type:'application/json'}));const l=document.createElement('a');l.href=u;l.download='momentum-tasks.json';l.click()},
   try:()=>{const d=new Date();d.setHours(20,0,0,0);if(d<=new Date())d.setDate(d.getDate()+1);t.remindAt=d.toISOString();t.snooze=0;t.remCount=0;t.adaptDismissed=true;touch(t);toast('Trying 8 PM');render()},
   keept:()=>{t.adaptDismissed=true;touch(t);render()},
   aft:()=>{const p=PV.out.tasks[+b.dataset.i],c=clash(p.scheduledAt);if(c){p.scheduledAt=p.remindAt=c.e;p.day=dayStr(new Date(c.e))}sheetPreview()},
   push:()=>enablePush(),rnew:()=>sheet(`<h1>New routine</h1><input type="text" id="rt" placeholder="Morning" aria-label="Routine name"><p></p><textarea id="rs" placeholder="One step per line" aria-label="Steps"></textarea><p class="small mute">Daily reminder time (optional)</p><input type="time" id="rm" aria-label="Reminder time"><div class="row"><button class="btn p" data-a="rsave">Save routine</button></div>`),
   rsave:()=>{const st=$('#rs').value.split('\n').map(x=>x.trim()).filter(Boolean).slice(0,15);if(!st.length)return toast('Add at least one step');S.routines.push({id:uid(),title:$('#rt').value.trim()||'Routine',steps:st,time:$('#rm').value||''});save();closeSheet();render()},
   rgo:()=>{RT={id,i:0};S.level.starts++;ev('start');routineSheet()},rdone:()=>{RT.i++;routineSheet()},rskip:()=>{RT.i++;routineSheet()},
   rdel:()=>{if(confirm('Remove this routine?')){S.routines=S.routines.filter(r=>r.id!==id);save();render()}},
   chat:()=>chatOpen(),aiset:async()=>{aiSheet();await aiStatus();if($('#sheet').innerHTML.includes('Connect Qwen AI'))aiSheet()},aitest:async()=>{toast('Testing…');await aiTest();if($('#sheet').innerHTML.includes('Connect Qwen AI'))aiSheet();render()},cretry:()=>chatSend(true),
   csend:()=>chatSend(),ctask:()=>{const m=CH.msgs[CH.msgs.length-1];if(m)plan(m.text,'paste');else toast('Send a message first')},cnew:()=>{CH={cid:null,msgs:[],busy:false};chatSheet()},
   send:sendComposer,refine:refineNow,tell:()=>{closeSheet();go('today');setTimeout(()=>{const e=$('#cmp');e&&e.focus()},60)},paste:()=>sheetAdd(),
   manual:()=>manualSheet({kind:'new'}),dumpq:()=>sheetAdd('dump'),editpv:()=>manualSheet({kind:'pv',i:+b.dataset.i}),msave:manualSave,det:()=>detailSheet(id),edit:()=>manualSheet({kind:'task',id}),
   dup:()=>{const now=new Date().toISOString();S.tasks.push(Object.assign({},strip(t),{id:uid(),status:'open',doneAt:null,startedAt:null,snooze:0,remCount:0,afterId:null,cond:null,baseV:null,createdAt:now,updatedAt:now,dirty:true}));save();sync();closeSheet();toast('Duplicated');render()},
   split:()=>{PV.pick='multi';PV.out=PV.r.multi;PV.on=PV.out.tasks.map(()=>true);PV.rem={};sheetPreview()},
   merge:()=>{PV.pick='single';PV.out=PV.r.single;PV.on=PV.out.tasks.map(()=>true);PV.rem={};sheetPreview()},
   clearDone:()=>{if(confirm('Remove all completed tasks?')){S.tasks.forEach(x=>{if(x.status==='done'&&!x.deleted){x.deleted=true;touch(x)}});render()}},
   wipe:()=>{if(confirm('Delete saved original texts?')){S.tasks.forEach(x=>{if(x.source){x.source=null;x.dirty=true}});save();toast('Originals deleted')}}};
  if(A[a]){e.preventDefault();A[a]()}});
document.addEventListener('change',e=>{const b=e.target,a=b.dataset.a;if(!a)return;
  if(a==='ics'){const f=b.files&&b.files[0];if(f)f.text().then(x=>{S.cal=parseICS(x);save();toast(S.cal.length+' events loaded');render()});return}
  if(a==='cfg'){const k=b.dataset.k;S.cfg[k]=b.type==='checkbox'?b.checked:(k==='maxRem'?+b.value:b.value);save();if(['lang','theme','large'].includes(k))render();if(['qs','qe','priv','maxRem','mode'].includes(k))pushSync().catch(()=>{})}
  else if(PV){const i=+b.dataset.i;if(a==='tog'){PV.on[i]=b.checked;sheetPreview()}else if(a==='ttl')PV.out.tasks[i].title=b.value.slice(0,120);else if(a==='keep'){PV.keep=b.checked}
   else if(a==='sug'){const q=PV.out.tasks[i];if(b.value){const d=new Date();if(b.value==='tomorrow')d.setDate(d.getDate()+1);d.setHours(b.value==='tonight'?20:9,0,0,0);q.day=dayStr(d);q.daySource='explicit';q.scheduledAt=d.toISOString();q.remindAt=q.scheduledAt;q.remindSource='explicit';sheetPreview()}}
   else if(a==='rem'){PV.rem[i]=b.value?atTime(PV.out.tasks[i].day,...b.value.split(':').map(Number)).toISOString():null}}});
function route(m){if(!m)return;if(m.act==='add'){sheetAdd();return}if(m.act==='now'){go('today');return}if(!m.id)return;if(String(m.id).startsWith('r:')){RT={id:m.id.slice(2),i:0};routineSheet();return}const t=byId(m.id);if(!t)return;if(m.act==='start')startFocus(t.id,120,'two');else if(m.act==='done')complete(t.id);else if(m.act==='snooze'){tab='today';render();snoozeSheet(t.id)}}
function updBar(reg){if($('#upd'))return;const d=document.createElement('div');d.id='upd';d.setAttribute('role','status');d.innerHTML='<span>Nemu has been updated.</span><button>Refresh</button>';document.body.appendChild(d);d.querySelector('button').onclick=()=>reg.waiting&&reg.waiting.postMessage('SKIP')}
if('serviceWorker'in navigator){const had=!!navigator.serviceWorker.controller;let rl=false;
  navigator.serviceWorker.register('sw.js').then(reg=>{if(reg.waiting&&had)updBar(reg);reg.addEventListener('updatefound',()=>{const w=reg.installing;w&&w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)updBar(reg)})})}).catch(()=>{});
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(had&&!rl){rl=true;location.reload()}});
  navigator.serviceWorker.addEventListener('message',e=>e.data&&e.data.mm&&route(e.data))}
addEventListener('keydown',e=>{const id=e.target&&e.target.id;if(e.key!=='Enter'||e.shiftKey)return;if(id==='cin'){e.preventDefault();chatSend()}else if(id==='cmp'){e.preventDefault();sendComposer()}else if(id==='fu'){e.preventDefault();refineNow()}});
addEventListener('input',e=>{if(e.target&&e.target.id==='cmp'){e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,160)+'px'}});
addEventListener('online',sync);addEventListener('hashchange',()=>{const p=new URLSearchParams(location.hash.slice(1));route({act:p.get('act'),id:p.get('id')})});
(async()=>{let st=await idbGet('state'),mig=false;if(!st){try{st=JSON.parse(localStorage.getItem('mm')||'null');mig=!!st}catch(e){}}
  if(st){S=Object.assign({},DEF,st);S.cfg=Object.assign({},DEF.cfg,st.cfg)}
  delete S.ms;delete S.msOk;['msClient','msTenant','useCopilot','aiUrl'].forEach(k=>delete S.cfg[k]);try{['ms_v','ms_s','ms_open'].forEach(k=>sessionStorage.removeItem(k))}catch(e){}   // purge old Copilot tokens/settings
  const td=dayStr(new Date());if(S.lastOpen&&S.lastOpen!==td)S.skip=[];S.lastOpen=td;save();if(mig)try{localStorage.removeItem('mm')}catch(e){}
  render();setInterval(checkReminders,20000);checkReminders();sync();pushSync().catch(()=>{});
  aiStatus().then(()=>{if(tab==='you')render()});
  const q=new URLSearchParams(location.search),sh=[q.get('title'),q.get('text'),q.get('url')].filter(Boolean).join('\n');
  if(sh){history.replaceState(null,'',location.pathname);plan(sh,'paste')}
  if(location.hash.includes('act=')){const p=new URLSearchParams(location.hash.slice(1));route({act:p.get('act'),id:p.get('id')})}
})();
