const V='momentum-v2',FILES=['./','index.html','style.css','app.js','manifest.webmanifest','icon.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(FILES)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>clients.claim()))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;
e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(V).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request,{ignoreSearch:true})))});
self.addEventListener('notificationclick',e=>{e.notification.close();const id=e.notification.data&&e.notification.data.id;const act=e.action||'open';
e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(l=>{const m={mm:1,act,id};
if(l.length){l[0].postMessage(m);return l[0].focus()}return clients.openWindow('./index.html#act='+act+'&id='+id)}))});
self.addEventListener('push',e=>{let d={};try{d=e.data.json()}catch(x){}
e.waitUntil(self.registration.showNotification(d.title||'MOMENTUM',{body:d.body||'',tag:d.id,data:{id:d.id},actions:[{action:'start',title:'Start'},{action:'snooze',title:'Snooze'},{action:'done',title:'Done'}]}))});
