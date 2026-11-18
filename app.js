'use strict';
/* ================= MOMENTUM — parser (offline provider) =================
   Pasted text is DATA. It is never executed or sent to privileged APIs. */
const DAYS={sunday:0,monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6,ahad:0,isnin:1,selasa:2,rabu:3,khamis:4,jumaat:5,sabtu:6};
const VERBS='check|compare|update|submit|send|buy|call|message|inspect|prepare|clean|wash|organi[sz]e|finish|print|ask|pay|book|email|write|read|study|revise|take|bring|make|get|go|meet|fix|order|pack|tell|review|complete|collect|pick|return|renew|cook|iron|do|beli|hantar|siapkan|telefon|bayar|cuci|kemas|ambil|tanya|semak|cetak|hubungi';
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
    if(ap){const p=ap.toLowerCase()==='pm';if(p&&h<12)h+=12;if(!p&&h===12)h=0}else if(h>=1&&h<=6)r.ambig=true;
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
    if(w.ambig)out.uncertain.push('"'+T+'": is '+w.h+' AM or PM?');
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
if(typeof module!=='undefined')module.exports={extract,validate};
if(typeof document==='undefined')throw 0;

/* ================= State ================= */
const $=q=>document.querySelector(q);
const esc=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>crypto.randomUUID?crypto.randomUUID():'id'+Date.now()+Math.random().toString(16).slice(2);
const DEF={tasks:[],skip:[],level:{starts:0,done:0},lastOpen:null,cfg:{lang:'en',theme:'system',large:false,mode:'balanced',qs:'22:00',qe:'07:00',maxRem:3,priv:false,persona:'gentle',energy:null,sbUrl:'',sbKey:'',aiUrl:'',lastSync:null},session:null,onboarded:false};
let S;try{S=Object.assign({},DEF,JSON.parse(localStorage.getItem('mm')||'{}'));S.cfg=Object.assign({},DEF.cfg,S.cfg)}catch(e){S=JSON.parse(JSON.stringify(DEF))}
const save=()=>{try{localStorage.setItem('mm',JSON.stringify(S))}catch(e){}};
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
function due(t){if(t.deadline){return'Before '+(t.dateOnly?dayLbl(dayStr(new Date(t.deadline))):dayLbl(dayStr(new Date(t.deadline)))+' '+fmtT(t.deadline))}
  if(t.scheduledAt)return dayLbl(t.day)+' '+fmtT(t.scheduledAt);if(t.day)return dayLbl(t.day)+(t.fuzzy?' '+t.fuzzy:'');return t.fuzzy||'No deadline'}
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
  const ids=[];const keep=PV.keep;
  PV.out.tasks.forEach((p,i)=>{if(!PV.on[i])return;const id=uid();ids[i]=id;
    S.tasks.push({id,title:p.title,steps:p.steps,day:p.day,daySource:p.daySource,deadline:p.deadline,deadlineSource:p.deadlineSource,dateOnly:p.dateOnly,scheduledAt:p.scheduledAt,fuzzy:p.fuzzy,
      effort:p.effort,minutes:p.minutes,people:p.people,note:p.note,status:'open',remindAt:PV.rem[i]===undefined?p.remindAt:PV.rem[i],remCount:0,snooze:0,
      source:keep?PV.text:null,sourceType:'paste',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),dirty:true})});
  PV.out.tasks.forEach((p,i)=>{const t=byId(ids[i]);if(!t)return;
    if(p.afterIdx!=null&&ids[p.afterIdx])t.afterId=ids[p.afterIdx];
    if(p.condition){t.status='waiting';t.cond={text:p.condition.text,parentId:ids[p.condition.parentIdx]||null};if(!t.cond.parentId)t.status='open'}});
  save();sync();closeSheet();PV=null;toast('Tasks created');go('today')}
async function plan(text,mode){
  let out=null,prov='Offline reader';
  if(S.cfg.aiUrl&&S.session&&navigator.onLine){try{const r=await fetch(S.cfg.aiUrl,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+S.session.access_token},body:JSON.stringify({text,mode,now:new Date().toISOString(),tz:Intl.DateTimeFormat().resolvedOptions().timeZone})});
    out=validate(await r.json());prov='AI'}catch(e){out=null}}
  if(!out)out=validate(extract(text,mode));
  PV={text,out,prov,on:out.tasks.map(()=>true),rem:{},keep:true};sheetPreview()}
function complete(id){const t=byId(id);if(!t)return;t.status='done';t.doneAt=new Date().toISOString();S.level.done++;touch(t);
  const kids=live().filter(x=>x.status==='waiting'&&x.cond&&x.cond.parentId===id);
  if(kids.length){sheet(`<h1>One quick check</h1>`+kids.map(k=>`<div class="card"><p><b>${esc(k.title)}</b></p><p class="mute">Only if: ${esc(k.cond.text)}</p><div class="row"><button class="btn p" data-a="yes" data-id="${k.id}">Yes, it applies</button><button class="btn" data-a="no" data-id="${k.id}">No, skip it</button></div></div>`).join(''))}
  else toast('Done. Nice start.');render()}
function breakDown(id){const t=byId(id);if(!t)return;sheet(`<h1>${esc(t.title)}</h1><p class="mute">First step</p><div class="card now"><h1>${esc(firstStep(t))}</h1></div>
  <div class="row"><button class="btn p" data-a="two" data-id="${id}">Start first step (2 min)</button><button class="btn" data-a="steps" data-id="${id}">Show all steps</button></div>`)}

/* ================= Focus ================= */
function startFocus(id,secs,mode){const t=byId(id);if(!t)return;S.level.starts++;t.startedAt=t.startedAt||new Date().toISOString();touch(t);
  F={id,total:secs,end:Date.now()+secs*1000,mode,paused:null};closeSheet();tab='focus';render();clearInterval(startFocus.i);startFocus.i=setInterval(tick,500)}
function tick(){if(!F||F.paused)return;const left=Math.max(0,Math.round((F.end-Date.now())/1000));
  if(left<=0){clearInterval(startFocus.i);F.over=true;if(F.mode==='two')sheetTwoDone();else toast('Time is up');if(tab==='focus')render();return}
  const b=$('#fb');if(b){b.textContent=mm(left);const c=$('#fc');c.style.strokeDashoffset=String(754*(1-left/F.total))}}
const mm=s=>String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
function sheetTwoDone(){const t=byId(F.id);sheet(`<h1>You’re already moving.</h1><p class="mute">Starting counts.</p><div class="row"><button class="btn p" data-a="keep" data-id="${t.id}">Keep going</button><button class="btn ok" data-a="finish" data-id="${t.id}">Done</button><button class="btn" data-a="brk">Take a break</button></div>`)}

/* ================= Reminders ================= */
async function notify(t){const body=S.cfg.priv?'You have a scheduled reminder.':(t.title+' · '+noteTxt(t)+(S.cfg.persona!=='minimal'?'':''));
  const o={body,tag:t.id,data:{id:t.id},actions:[{action:'start',title:'Start'},{action:'snooze',title:'Snooze'},{action:'done',title:'Done'}]};
  try{const r=await navigator.serviceWorker.ready;if(Notification.permission==='granted'){await r.showNotification(S.cfg.priv?'MOMENTUM':t.title,o);return}}catch(e){}
  toast(t.title+' — '+noteTxt(t))}
function checkReminders(){const now=Date.now(),max=S.cfg.mode==='gentle'?1:S.cfg.mode==='balanced'?Math.min(2,S.cfg.maxRem):S.cfg.maxRem,gap=15*60000;
  if(quiet())return;live().forEach(t=>{if(t.status!=='open'||!t.remindAt||F&&F.id===t.id)return;
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
      if(okT.length){const rows=okT.map(t=>({id:t.id,title:t.title,status:t.status,deadline:t.deadline,scheduled_at:t.scheduledAt,deleted:!!t.deleted,updated_at:t.updatedAt,data:strip(t)}));
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
  if(j.access_token){S.session={access_token:j.access_token,refresh_token:j.refresh_token,email};save();toast('Signed in');sync();render();return}
  toast(j.msg||j.error_description||'Check your email to confirm, then sign in')}

/* ================= UI ================= */
const sheetEl=()=>$('#sheet');
function sheet(h){const e=sheetEl();e.innerHTML='<div>'+h+'<div class="row"><button class="btn g" data-a="close">Close</button></div></div>';e.classList.add('on')}
function closeSheet(){sheetEl().classList.remove('on');sheetEl().innerHTML=''}
function go(t){tab=t;render();scrollTo(0,0)}
function sheetAdd(mode){sheet(`<h1>${mode==='dump'?t_('dump'):'Quick add'}</h1><p class="mute">${mode==='dump'?'Write everything in your head. Separate with commas or new lines.':'Paste a message or type it. One task or many.'}</p>
  <textarea id="qa" placeholder="${mode==='dump'?'wash shoes, call mum, buy shampoo…':'Tomorrow please check stock before 10 AM, then update Nurdin…'}" aria-label="Text"></textarea>
  <p class="small mute">Sent to AI only if you set an AI endpoint in You. Otherwise it is read on this device.</p>
  <div class="row"><button class="btn p" data-a="plan" data-m="${mode||'paste'}">Plan it</button><button class="btn" data-a="mic">🎙 Voice</button><button class="btn" data-a="clip">📋 Paste</button></div>`);setTimeout(()=>{const q=$('#qa');q&&q.focus()},50)}
function sheetPreview(){const o=PV.out;
  sheet(`<h1>I found ${o.tasks.length} thing${o.tasks.length===1?'':'s'} to do</h1><p class="small mute">Read by: ${PV.prov}. Nothing is saved until you press Create.</p>`+
  (o.tasks.length?o.tasks.map((p,i)=>`<div class="card pv"><input type="checkbox" data-a="tog" data-i="${i}" ${PV.on[i]?'checked':''} aria-label="Include"><div class="t">
    <input type="text" data-a="ttl" data-i="${i}" value="${esc(p.title)}" aria-label="Task title">
    <p class="small" style="margin-top:8px">${p.deadline?`<span class="tag ex">Deadline</span>${esc(due(p))}`:p.day||p.fuzzy?`${src(p.daySource)}${esc(due(p))}`:'<span class="tag">Deadline: not provided</span>'}</p>
    ${p.afterIdx!=null?`<p class="small mute">After: ${esc(o.tasks[p.afterIdx].title)}</p>`:''}${p.condition?`<p class="small"><span class="tag u">Only if</span>${esc(p.condition.text)}</p>`:''}${p.note?`<p class="small mute">${esc(p.note)}</p>`:''}
    ${p.remindAt?`<p class="small">${src(p.remindSource)}Reminder ${fmtT(p.remindAt)}</p>`:p.day?`<p class="small">Reminder: <select data-a="rem" data-i="${i}" aria-label="Reminder time"><option value="">None</option><option value="08:00">8:00</option><option value="09:00">9:00</option><option value="19:00">7:00 PM</option></select></p>`:''}
    </div></div>`).join(''):`<div class="card"><p>No tasks found. Try a clearer sentence, or use Brain dump.</p></div>`)+
  (o.uncertain.length?`<div class="card"><p class="small"><b>Not sure about</b></p>${o.uncertain.map(u=>`<p class="small mute">${esc(u)}</p>`).join('')}</div>`:'')+
  `<label class="small"><input type="checkbox" data-a="keep" ${PV.keep?'checked':''}> Keep the original text for reference</label>
  <div class="row"><button class="btn p" data-a="create">Create ${PV.on.filter(Boolean).length} tasks</button><button class="btn" data-a="cancelpv">Cancel</button></div>`)}
function card(t,big){const nowLbl=t.minutes?'About '+t.minutes+' min':'';return`<div class="card ${big?'now':''}"><${big?'h1':'p'} style="${big?'':'font-weight:700;margin:0'}">${esc(t.title)}</${big?'h1':'p'}><p class="small mute">${esc(due(t))}${nowLbl?' · '+nowLbl:''}</p></div>`}
function renderToday(){const r=ranked(),n=r[0],h=new Date().getHours();
  const hi=h<12?'Good morning.':h<18?'Hello.':'Good evening.';let x=`<h1>${hi}</h1><p class="mute">${S.level.done<1&&S.level.starts<1?'Let’s make today manageable.':'One small thing at a time.'}</p>`;
  x+=`<div class="chips" style="margin:10px 0"><span class="small mute">Energy</span>${['low','medium','high'].map(e=>`<button class="btn" data-a="en" data-v="${e}" aria-pressed="${S.cfg.energy===e}" style="${S.cfg.energy===e?'border-color:var(--pri);background:var(--priS)':''}">${e[0].toUpperCase()+e.slice(1)}</button>`).join('')}</div>`;
  if(n){x+=`<h2>${t_('now')}</h2><div class="card now"><h1>${esc(n.title)}</h1><p class="mute">${esc(due(n))}${n.deadline&&!n.dateOnly?' · '+mins(n.deadline):''}</p>
    ${n.deadline?`<div class="bar" aria-hidden="true"><i style="width:${pct(n)}%"></i></div>`:''}<p style="margin-top:12px"><b>First step:</b> ${esc(firstStep(n))}</p>
    <div class="row"><button class="btn p" data-a="go25" data-id="${n.id}">${t_('start')}</button><button class="btn" data-a="two" data-id="${n.id}">${t_('two')}</button></div>
    <div class="row"><button class="btn ok" data-a="fin" data-id="${n.id}">${t_('done')}</button><button class="btn" data-a="sm" data-id="${n.id}">${t_('smaller')}</button><button class="btn" data-a="skip" data-id="${n.id}">${t_('notthis')}</button><button class="btn" data-a="snz" data-id="${n.id}">Snooze</button></div></div>`;
    const nx=r.slice(1,3);if(nx.length)x+=`<h2>${t_('next')}</h2>`+nx.map(t=>card(t)).join('');
    if(r.length>3)x+=`<details><summary class="mute" style="min-height:48px;cursor:pointer">${t_('later')} (${r.length-3})</summary>${r.slice(3).map(t=>card(t)).join('')}</details>`}
  else x+=`<div class="card"><p>${t_('empty')}</p></div>`;
  x+=`<div class="row"><button class="btn p w" data-a="add">${t_('paste')}</button></div><p class="small mute">${t_('pasteSub')}</p>`;
  const lv=S.level.starts+S.level.done*2;x+=`<p class="small mute" style="margin-top:22px">${lv<5?'🌱 Starting':lv<25?'🌿 Growing':'🌳 Strong'} · ${S.level.starts} starts, ${S.level.done} done</p>`;return x}
const mins=d=>{const m=Math.round((Date.parse(d)-Date.now())/60000);return m<0?'time has passed':m<60?m+' minutes away':Math.round(m/60)+' hours away'};
const pct=t=>{const a=Date.parse(t.createdAt),b=Date.parse(t.deadline);return Math.max(2,Math.min(100,Math.round((Date.now()-a)/(b-a)*100)))};
function renderTasks(){const a=live().filter(t=>t.status!=='done'&&t.status!=='cancelled');let x='<h1>Tasks</h1>';
  x+=a.length?a.map(t=>`<div class="card"><p style="margin:0;font-weight:700">${esc(t.title)}</p><p class="small mute">${esc(due(t))}${t.status==='waiting'?' · waiting: '+esc(t.cond.text):''}${t.afterId&&byId(t.afterId)&&byId(t.afterId).status!=='done'?' · after: '+esc(byId(t.afterId).title):''}</p>
   <div class="row"><button class="btn ok" data-a="fin" data-id="${t.id}">Done</button><button class="btn" data-a="sm" data-id="${t.id}">Make smaller</button><button class="btn" data-a="del" data-id="${t.id}">Remove</button></div></div>`).join(''):`<div class="card"><p>${t_('empty')}</p></div>`;
  const d=live().filter(t=>t.status==='done').length;return x+`<p class="small mute">${d} finished</p>`}
function renderFocus(){if(!F)return`<h1>Focus</h1><div class="card"><p>Pick a task on Today, then press Start. Or try 2 minutes: you don’t need to finish, just begin.</p></div><div class="row"><button class="btn p w" data-a="go" data-t="today">Go to Today</button></div>`;
  const t=byId(F.id),left=F.paused!=null?Math.round(F.paused/1000):Math.max(0,Math.round((F.end-Date.now())/1000));
  return`<p class="mute" style="text-align:center">${F.mode==='two'?'You don’t need to finish. Just begin.':'Focus'}</p><h1 style="text-align:center">${esc(t.title)}</h1>
  <div class="ring"><svg width="240" height="240" viewBox="0 0 240 240" aria-hidden="true"><circle cx="120" cy="120" r="120" fill="none" stroke="var(--line)" stroke-width="14" transform="scale(.97) translate(4 4)"/><circle id="fc" cx="120" cy="120" r="120" fill="none" stroke="var(--pri)" stroke-width="14" stroke-linecap="round" stroke-dasharray="754" stroke-dashoffset="${754*(1-left/F.total)}" transform="scale(.97) translate(4 4)"/></svg><b id="fb">${mm(left)}</b></div>
  <div class="row"><button class="btn ok" data-a="fin" data-id="${t.id}">Done</button><button class="btn" data-a="pause">${F.paused!=null?'Resume':'Pause'}</button><button class="btn" data-a="stuck" data-id="${t.id}">I’m stuck</button></div>`}
function renderYou(){const c=S.cfg;const sel=(k,v,o)=>`<select data-a="cfg" data-k="${k}" aria-label="${k}">${o.map(x=>`<option value="${x[0]}" ${String(v)===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select>`;
  return`<h1>You</h1><div class="card"><p><b>Reminders</b></p><p class="small mute">Style</p>${sel('mode',c.mode,[['gentle','Gentle: one reminder'],['balanced','Balanced: a little follow-up'],['persistent','Persistent: up to your limit']])}
  <p class="small mute" style="margin-top:10px">Wording</p>${sel('persona',c.persona,[['minimal','Minimal'],['gentle','Gentle'],['direct','Direct'],['encouraging','Encouraging']])}
  <p class="small mute" style="margin-top:10px">Quiet hours</p><div class="row"><input type="time" data-a="cfg" data-k="qs" value="${c.qs}" aria-label="Quiet from"><input type="time" data-a="cfg" data-k="qe" value="${c.qe}" aria-label="Quiet until"></div>
  <p class="small mute" style="margin-top:10px">Most reminders per task</p>${sel('maxRem',c.maxRem,[['1','1'],['2','2'],['3','3'],['5','5']])}
  <label class="small" style="display:block;margin-top:10px"><input type="checkbox" data-a="cfg" data-k="priv" ${c.priv?'checked':''}> Hide details on the lock screen</label>
  <div class="row"><button class="btn p" data-a="perm">Allow notifications</button></div></div>
  <div class="card"><p><b>Look and language</b></p>${sel('lang',c.lang,[['en','English'],['ms','Bahasa Melayu']])}<p></p>${sel('theme',c.theme,[['system','System'],['light','Light'],['dark','Dark']])}
  <label class="small" style="display:block;margin-top:10px"><input type="checkbox" data-a="cfg" data-k="large" ${c.large?'checked':''}> Large text</label></div>
  <div class="card"><p><b>Sync and AI (your base)</b></p><p class="small mute">${S.session?'Signed in as '+esc(S.session.email)+'. Last sync '+(c.lastSync?new Date(c.lastSync).toLocaleString():'never'):'Works fully offline. Sign in to sync across devices.'}</p>
  <input type="text" data-a="cfg" data-k="sbUrl" value="${esc(c.sbUrl)}" placeholder="Supabase project URL" aria-label="Supabase URL"><p></p><input type="text" data-a="cfg" data-k="sbKey" value="${esc(c.sbKey)}" placeholder="Supabase anon key" aria-label="Supabase key"><p></p>
  <input type="text" data-a="cfg" data-k="aiUrl" value="${esc(c.aiUrl)}" placeholder="AI endpoint (optional)" aria-label="AI endpoint"><p></p>
  ${S.session?`<div class="row"><button class="btn p" data-a="syncnow">Sync now</button><button class="btn" data-a="out">Sign out</button></div>`:`<input type="email" id="em" placeholder="Email" aria-label="Email"><p></p><input type="password" id="pw" placeholder="Password" aria-label="Password"><div class="row"><button class="btn p" data-a="in">Sign in</button><button class="btn" data-a="up">Create account</button></div>`}</div>
  <div class="card"><p><b>Your data</b></p><div class="row"><button class="btn" data-a="exp">Export</button><button class="btn" data-a="wipe">Delete originals</button></div></div>`}
function render(){const v=$('#view');
  if(!S.onboarded){v.innerHTML=`<h1>MOMENTUM</h1><p class="mute">Don’t just remember it. Start it.</p><div class="card"><p>What usually gets in your way?</p><div class="chips">${['I forget','I procrastinate','I lose track of time','Tasks feel too big','I ignore notifications','I struggle to start','I get overwhelmed'].map(x=>`<label class="btn" style="display:flex;align-items:center;gap:8px"><input type="checkbox"> ${x}</label>`).join('')}</div></div>
  <div class="card"><p>How should I remind you?</p>${['gentle','balanced','persistent'].map(m=>`<button class="btn w" style="margin:4px 0" data-a="ob" data-m="${m}">${m[0].toUpperCase()+m.slice(1)}</button>`).join('')}</div>`;$('#nav').style.display='none';return}
  $('#nav').style.display='flex';
  v.innerHTML={today:renderToday,tasks:renderTasks,focus:renderFocus,you:renderYou}[tab]();
  $('#nav').innerHTML=[['today','◉',t_('today')],['tasks','☰',t_('tasks')],['add','+',''],['focus','◔',t_('focus')],['you','☺',t_('you')]].map(x=>x[0]==='add'?`<button class="plus" data-a="add" aria-label="Quick add">+</button>`:`<button data-a="go" data-t="${x[0]}" ${tab===x[0]?'aria-current="page"':''}><span aria-hidden="true">${x[1]}</span>${x[2]}</button>`).join('');
  document.documentElement.dataset.theme=S.cfg.theme==='system'?'':S.cfg.theme;document.documentElement.dataset.large=S.cfg.large?'on':'off';document.documentElement.lang=S.cfg.lang==='ms'?'ms':'en'}

/* ================= Events ================= */
document.addEventListener('click',async e=>{const b=e.target.closest('[data-a]');if(!b||b.tagName==='SELECT'||b.type==='checkbox'||b.type==='time'||b.type==='text')return;const a=b.dataset.a,id=b.dataset.id,t=id&&byId(id);
  const A={go:()=>go(b.dataset.t),add:()=>sheetAdd(),close:closeSheet,cancelpv:()=>{PV=null;closeSheet()},create:createFromPreview,
   plan:()=>{const v=$('#qa').value.trim();if(v)plan(v,b.dataset.m)},clip:async()=>{try{$('#qa').value=await navigator.clipboard.readText()}catch(x){toast('Paste with long-press instead')}},
   mic:()=>{const R=window.SpeechRecognition||window.webkitSpeechRecognition;if(!R)return toast('Voice not supported here');const r=new R();r.lang=S.cfg.lang==='ms'?'ms-MY':'en-MY';r.onresult=ev=>{$('#qa').value+=ev.results[0][0].transcript};r.start()},
   go25:()=>startFocus(id,25*60,'focus'),two:()=>startFocus(id,120,'two'),fin:()=>{closeSheet();if(F&&F.id===id){F=null;clearInterval(startFocus.i)}complete(id)},
   sm:()=>breakDown(id),steps:()=>sheet(`<h1>${esc(t.title)}</h1>`+t.steps.map((s,i)=>`<div class="card">${i+1}. ${esc(s)}</div>`).join('')),
   skip:()=>{S.skip.push(id);save();render()},snz:()=>snoozeSheet(id),
   sn:()=>{t.remindAt=new Date(Date.now()+b.dataset.m*60000).toISOString();t.remCount=0;t.snooze=(t.snooze||0)+1;touch(t);closeSheet();toast('Snoozed '+b.dataset.m+' min');render()},
   blk:()=>{t.blocker=b.dataset.b==='Too big'?'big':b.dataset.b;touch(t);toast(t.blocker==='big'?'Next time: just the first step':'Noted')},
   en:()=>{S.cfg.energy=S.cfg.energy===b.dataset.v?null:b.dataset.v;save();render()},
   yes:()=>{t.status='open';touch(t);closeSheet();render()},no:()=>{t.status='cancelled';touch(t);closeSheet();render()},
   keep:()=>{startFocus(id,25*60,'focus')},finish:()=>{closeSheet();F=null;complete(id)},brk:()=>{closeSheet();F=null;go('today')},
   pause:()=>{if(F.paused==null){F.paused=F.end-Date.now()}else{F.end=Date.now()+F.paused;F.paused=null}render()},
   stuck:()=>sheet(`<h1>Let’s unstick this</h1><div class="row"><button class="btn p" data-a="sm" data-id="${id}">Make it smaller</button><button class="btn" data-a="two" data-id="${id}">2-minute start</button><button class="btn" data-a="brk">Short break</button></div>`),
   del:()=>{if(confirm('Remove this task?')){t.deleted=true;touch(t);render()}},perm:async()=>{const p=await Notification.requestPermission();toast(p==='granted'?'Notifications on':'Notifications blocked')},
   ob:()=>{S.cfg.mode=b.dataset.m;S.onboarded=true;save();render();sheetAdd()},mine:()=>{t.conflict=false;t.baseV=null;touch(t);closeSheet()},theirs:()=>{Object.assign(t,t.remote||{});t.conflict=false;t.dirty=false;delete t.remote;save();closeSheet();render()},
   in:()=>auth('in',$('#em').value,$('#pw').value),up:()=>auth('up',$('#em').value,$('#pw').value),out:()=>{S.session=null;save();render()},syncnow:()=>{S.cfg.lastSync=null;sync()},
   exp:()=>{const u=URL.createObjectURL(new Blob([JSON.stringify(S.tasks,null,1)],{type:'application/json'}));const l=document.createElement('a');l.href=u;l.download='momentum-tasks.json';l.click()},
   wipe:()=>{if(confirm('Delete saved original texts?')){S.tasks.forEach(x=>{if(x.source){x.source=null;x.dirty=true}});save();toast('Originals deleted')}}};
  if(A[a]){e.preventDefault();A[a]()}});
document.addEventListener('change',e=>{const b=e.target,a=b.dataset.a;if(!a)return;
  if(a==='cfg'){const k=b.dataset.k;S.cfg[k]=b.type==='checkbox'?b.checked:(k==='maxRem'?+b.value:b.value);save();if(['lang','theme','large'].includes(k))render()}
  else if(PV){const i=+b.dataset.i;if(a==='tog'){PV.on[i]=b.checked;sheetPreview()}else if(a==='ttl')PV.out.tasks[i].title=b.value.slice(0,120);else if(a==='keep'){PV.keep=b.checked}
   else if(a==='rem'){PV.rem[i]=b.value?atTime(PV.out.tasks[i].day,...b.value.split(':').map(Number)).toISOString():null}}});
function route(m){if(!m||!m.id)return;const t=byId(m.id);if(!t)return;if(m.act==='start')startFocus(t.id,120,'two');else if(m.act==='done')complete(t.id);else if(m.act==='snooze'){tab='today';render();snoozeSheet(t.id)}}
if('serviceWorker'in navigator){navigator.serviceWorker.register('sw.js').catch(()=>{});navigator.serviceWorker.addEventListener('message',e=>e.data&&e.data.mm&&route(e.data))}
addEventListener('online',sync);addEventListener('hashchange',()=>{const p=new URLSearchParams(location.hash.slice(1));route({act:p.get('act'),id:p.get('id')})});
const today=dayStr(new Date());if(S.lastOpen&&S.lastOpen!==today)S.skip=[];S.lastOpen=today;save();
render();setInterval(checkReminders,20000);checkReminders();sync();
if(location.hash.includes('act=')){const p=new URLSearchParams(location.hash.slice(1));route({act:p.get('act'),id:p.get('id')})}
