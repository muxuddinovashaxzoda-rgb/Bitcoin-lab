// Ishga tushirish: node server.js   (Node 18+, paket oʻrnatish shart emas)
const http=require('http'),fs=require('fs'),path=require('path'),os=require('os');
if(!globalThis.crypto)globalThis.crypto=require('crypto').webcrypto;
const Core=require('./core.js'),DB=path.join(__dirname,'data.json');
let st=fs.existsSync(DB)?JSON.parse(fs.readFileSync(DB,'utf8')):null;
const clients=[],push=()=>clients.forEach(c=>c.write('data: u\n\n'));
let q=Promise.resolve();const run=f=>{const p=q.then(f);q=p.catch(()=>{});return p}; // soʻrovlar navbat bilan bajariladi
const J=(r,c,o)=>{r.writeHead(c,{'Content-Type':'application/json'});r.end(JSON.stringify(o))};
setInterval(()=>clients.forEach(c=>c.write(': ping\n\n')),25000);
(async()=>{
 if(!st){st=await Core.fresh();fs.writeFileSync(DB,JSON.stringify(st))}
 http.createServer((q2,r)=>{const u=q2.url.split('?')[0];
  if(q2.method==='GET'&&u==='/'){r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return r.end(fs.readFileSync(path.join(__dirname,'index.html')))}
  if(u==='/api/state')return J(r,200,st);
  if(u==='/api/events'){r.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache'});clients.push(r);
   q2.on('close',()=>clients.splice(clients.indexOf(r),1));return r.write(': ok\n\n')}
  if(q2.method==='POST'&&u==='/api/post'){let s='';q2.on('data',c=>{s+=c;if(s.length>8e6)q2.destroy()});
   q2.on('end',()=>{let j;try{j=JSON.parse(s)}catch(e){return J(r,400,{error:'Notoʻgʻri soʻrov'})}
    run(async()=>{const x=await Core.handle(st,j.u,j.b);if(x.ok){fs.writeFileSync(DB,JSON.stringify(st));push()}return x}).then(x=>J(r,200,x),()=>J(r,500,{error:'Server xatosi'}))});return}
  J(r,404,{error:'Topilmadi'})
 }).listen(process.env.PORT||3000,'0.0.0.0',()=>{console.log('Server ishga tushdi: http://localhost:3000');
  for(const l of Object.values(os.networkInterfaces()))for(const i of l)if(i.family==='IPv4'&&!i.internal)console.log('Telefonlar uchun: http://'+i.address+':3000')})
})();
