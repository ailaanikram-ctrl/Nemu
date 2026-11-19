/* Nemu service worker. Relative paths only, so it works under a GitHub Pages subpath (/repo/). */
const V='nemu-v3',FILES=['./','index.html','style.css','app.js','manifest.webmanifest','icon.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(FILES)))});   // no skipWaiting: the app asks the user to refresh
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>clients.claim()))});
self.addEventListener('message',e=>{if(e.data==='SKIP')self.skipWaiting()});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;
e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(V).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request,{ignoreSearch:true})))});
const ACTIONS=l=>[{action:'start',title:l?'Open & start':'Start'},{action:'snooze',title:'Later'}];
self.addEventListener('notificationclick',e=>{e.notification.close();const d=e.notification.data||{},act=e.action||'open';
e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(l=>{const m={mm:1,act,id:d.id};
if(act==='start'&&d.link){clients.openWindow(d.link);l.forEach(c=>c.postMessage(m));return}
if(l.length){l[0].postMessage(m);return l[0].focus()}return clients.openWindow('./index.html#act='+act+'&id='+d.id)}))});
self.addEventListener('push',e=>{let d={};try{d=e.data.json()}catch(x){}
e.waitUntil(self.registration.showNotification(d.title||'Nemu',{body:d.body||'',tag:d.id,data:{id:d.id,link:d.link||null},actions:ACTIONS(d.link)}))});
