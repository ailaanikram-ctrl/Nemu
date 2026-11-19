// Runs the real app.js against a stubbed DOM and a mocked server. Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mk = () => ({ innerHTML: "", value: "", style: {}, classList: { add() {}, remove() {} }, dataset: {}, textContent: "", scrollTop: 0, scrollHeight: 0 });
const els = {};
globalThis.document = { querySelector: (q) => els[q] || (els[q] = mk()), addEventListener() {}, documentElement: { dataset: {} }, createElement: () => mk(), body: { appendChild() {} } };
const store = { _: {}, getItem(k) { return this._[k] || null; }, setItem(k, v) { this._[k] = v; }, removeItem() {} };
globalThis.localStorage = store; globalThis.sessionStorage = store;
Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });
Object.defineProperty(globalThis, "crypto", { value: { randomUUID: () => Math.random().toString(16).slice(2) + Date.now() }, configurable: true });
Object.assign(globalThis, { addEventListener() {}, location: { hash: "", search: "", pathname: "/nemu/index.html", origin: "https://x" }, setInterval: () => 0, setTimeout: () => 0, scrollTo() {}, window: globalThis });

const calls = []; let next = null;
globalThis.fetch = async (u, o) => { calls.push({ u, o }); if (next === "network") throw new TypeError("fail");
  const r = next ? next(u, o) : { status: 200, body: {} }; return { ok: r.status < 400, status: r.status, json: async () => r.body }; };

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const scenario = String.raw`
globalThis.__DONE=(async()=>{const R=[],ck=(l,c)=>R.push([l,!!c]);const V=()=>document.querySelector('#view').innerHTML,SH=()=>document.querySelector('#sheet').innerHTML;
S.onboarded=true;S.cfg.sbUrl='https://p.supabase.co';S.cfg.sbKey='anon';S.session={access_token:'user-jwt',email:'a@b.c'};
const reply=(status,body)=>{globalThis.__setNext(()=>({status,body}))};
// not configured server -> setup modal, no chat
reply(503,{error:{code:'not_configured',message:'The AI service is not configured yet. Ask the administrator to set it up.'}});await chatOpen();
ck('not configured -> Connect Qwen AI modal',SH().includes('Connect Qwen AI')&&SH().includes('Not configured')&&SH().includes('Test connection'));
ck('modal has no Microsoft fields',!/Tenant|Application \(client\)|Sign in with Microsoft|Copilot/i.test(SH()));
// configured
AIS.status='unknown';reply(200,{configured:true,provider:'qwen',model:'qwen-plus',host:'dashscope-intl.aliyuncs.com'});await chatOpen();
ck('configured -> chat opens',SH().includes('AI Assistant')&&SH().includes('Powered by Qwen')&&SH().includes('qwen-plus')===false);
// empty message
document.querySelector('#cin').value='   ';const before=globalThis.__calls.length;await chatSend();ck('empty message rejected, no request',globalThis.__calls.length===before&&CH.msgs.length===0);
// success + safe rendering
document.querySelector('#cin').value='Plan my morning';reply(200,{reply:'Do this **first**\n<img src=x onerror=alert(1)>'});await chatSend();
const last=globalThis.__calls[globalThis.__calls.length-1];
ck('request goes to own server /ai/chat with user JWT',last.u==='https://p.supabase.co/functions/v1/api/ai/chat'&&last.o.headers.Authorization==='Bearer user-jwt');
ck('request body has only role/content messages',JSON.parse(last.o.body).messages.every(m=>Object.keys(m).sort().join()==='content,role')&&!/qwen|api[_-]?key|sk-/i.test(last.o.body));
ck('reply shown in order, HTML escaped',CH.msgs.length===2&&CH.msgs[0].r==='u'&&CH.msgs[1].r==='c'&&SH().includes('&lt;img')&&!SH().includes('<img')&&SH().includes('<b>first</b>')&&AIS.status==='connected');
// errors are friendly + retry
for(const [st,code,msg] of [[502,'auth_failed','rejected its credentials'],[429,'rate_limited','limit was reached'],[504,'timeout','too long'],[502,'model_unavailable','model or endpoint was not found'],[502,'bad_response','unexpected reply']]){
  document.querySelector('#cin').value='hi '+code;reply(st,{error:{code,message:'The AI service '+msg+'.'}});await chatSend();ck('error '+code+' friendly',CH.err&&CH.err.includes(msg)&&SH().includes('Retry')&&!/stack|Bearer|sk-/i.test(SH()));}
globalThis.__setNext('network');document.querySelector('#cin').value='x';await chatSend();ck('network failure friendly',/reach the server|offline/.test(CH.err));
reply(200,{reply:'Recovered'});await chatSend(true);ck('retry works',CH.msgs[CH.msgs.length-1].text==='Recovered'&&CH.err===null);
// history trimming
CH.msgs=[];for(let i=0;i<40;i++){CH.msgs.push({r:'u',text:'q'+i});CH.msgs.push({r:'c',text:'a'+i})}CH.msgs.push({r:'u',text:'final'});
reply(200,{reply:'ok'});document.querySelector('#cin').value='';await chatSend(true);const h=JSON.parse(globalThis.__calls[globalThis.__calls.length-1].o.body).messages;
ck('history trimmed to <=20, starts and ends with user',h.length<=20&&h[0].role==='user'&&h[h.length-1].role==='user');
// busy state disables Send
CH.busy=true;chatSheet();ck('Send disabled while busy + loading indicator',/data-a="csend" disabled/.test(SH())&&SH().includes('Thinking'));CH.busy=false;
// task interpretation via Qwen, validated; falls back when AI fails
AIS.status='configured';reply(200,{interpretation:'single_task',task:{task:'Submit Geography Assignment',taskBrief:'Finish the map.',due:'2026-11-20T23:59:00+08:00',taskLink:'https://s.example/a',recurrence:null},confidence:{due:0.96}});
await plan('Submit geography Friday https://s.example/a','paste');ck('extract uses Qwen AI',PV.prov==='Qwen AI'&&PV.out.tasks[0].title==='Submit Geography Assignment');
reply(200,{interpretation:'single_task',task:{task:'x',taskLink:'javascript:alert(1)'}});await plan('Buy bread tomorrow','paste');ck('unsafe AI output rejected -> offline reader + notice',PV.prov==='Offline reader'&&SH().includes('temporarily unavailable'));
reply(503,{error:{code:'not_configured',message:'n'}});AIS.status='configured';await plan('Buy milk','paste');ck('not configured -> offline reader silently',PV.prov==='Offline reader'&&!SH().includes('temporarily unavailable'));
// no session -> no calls
S.session=null;const n0=globalThis.__calls.length;await plan('Buy tea','paste');ck('no session -> offline, no request',PV.prov==='Offline reader'&&globalThis.__calls.length===n0);
// settings + Today copy
tab='you';render();ck('Settings: AI Assistant Powered by Qwen',V().includes('AI Assistant')&&V().includes('Powered by Qwen')&&!/Copilot|Microsoft|Entra|Tenant/.test(V()));
tab='today';render();ck('Today has AI Assistant button',V().includes('AI Assistant')&&!/Copilot/.test(V()));
return R})();`;
globalThis.__calls = calls; globalThis.__setNext = (f) => { next = f; };
new Function(app + scenario)();

test("app + Qwen client behaviour (mocked server)", async () => {
  const R = await globalThis.__DONE;
  const failed = R.filter(([, ok]) => !ok).map(([l]) => l);
  console.log(R.map(([l, ok]) => (ok ? "  ok  " : " FAIL ") + l).join("\n"));
  assert.deepEqual(failed, []);
});
