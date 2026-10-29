// Ishga tushirish: npm install && node server.js   (Node 18+)
// DATABASE_URL berilsa  -> ma'lumot Postgres bazaga saqlanadi (Render uchun, yoʻqolmaydi)
// DATABASE_URL yoʻq boʻlsa -> data.json faylga (faqat kompyuterda sinash uchun)
const http=require('http'),fs=require('fs'),path=require('path'),os=require('os');
if(!globalThis.crypto)globalThis.crypto=require('crypto').webcrypto;
const Core=require('./core.js'),DB=path.join(__dirname,'data.json'),URL_=process.env.DATABASE_URL;
const PORT=process.env.PORT||3000;
let pool=null;
if(URL_){const {Pool}=require('pg');
 pool=new Pool({connectionString:URL_,ssl:/localhost|127\.0\.0\.1/.test(URL_)?false:{rejectUnauthorized:false},max:3})}
async function load(){
 if(pool){await pool.query('CREATE TABLE IF NOT EXISTS kv(k TEXT PRIMARY KEY, v JSONB NOT NULL, upd TIMESTAMPTZ DEFAULT now())');
  const r=await pool.query("SELECT v FROM kv WHERE k='state'");return r.rows[0]?r.rows[0].v:null}
 return fs.existsSync(DB)?JSON.parse(fs.readFileSync(DB,'utf8')):null}
async function save(st){
 if(pool){await pool.query("INSERT INTO kv(k,v) VALUES('state',$1) ON CONFLICT(k) DO UPDATE SET v=$1, upd=now()",[JSON.stringify(st)]);return}
 fs.writeFileSync(DB+'.tmp',JSON.stringify(st));fs.renameSync(DB+'.tmp',DB)} // avval vaqtincha faylga, keyin almashtiriladi: buzilmaydi
let st=null;
const clients=[],push=()=>clients.forEach(c=>c.write('data: u\n\n'));
let q=Promise.resolve();const run=f=>{const p=q.then(f);q=p.catch(()=>{});return p}; // soʻrovlar navbat bilan bajariladi
const J=(r,c,o)=>{r.writeHead(c,{'Content-Type':'application/json'});r.end(JSON.stringify(o))};
setInterval(()=>clients.forEach(c=>c.write(': ping\n\n')),25000);
(async()=>{
 st=await load();
 if(!st){st=await Core.fresh();await save(st);console.log('Yangi zanjir yaratildi')}
 else console.log('Saqlangan maʼlumot yuklandi: '+st.chain.length+' blok, '+Object.keys(st.users).length+' foydalanuvchi');
 console.log('Saqlash joyi: '+(pool?'Postgres':'data.json (vaqtincha, Render’da yoʻqoladi!)'));
 http.createServer((q2,r)=>{const u=q2.url.split('?')[0];
  if(u==='/healthz'){r.writeHead(200);return r.end('ok')}
  if(q2.method==='GET'&&u==='/'){r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return r.end(fs.readFileSync(path.join(__dirname,'index.html')))}
  if(u==='/api/state'){r.setHeader('Cache-Control','no-store');return J(r,200,st)}
  if(u==='/api/events'){r.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','X-Accel-Buffering':'no'});clients.push(r);
   q2.on('close',()=>{const i=clients.indexOf(r);if(i>=0)clients.splice(i,1)});return r.write(': ok\n\n')}
  if(q2.method==='POST'&&u==='/api/post'){let s='',big=false;q2.on('data',c=>{s+=c;if(s.length>8e6&&!big){big=true;J(r,413,{error:'Soʻrov juda katta'});q2.destroy()}});
   q2.on('end',()=>{if(big)return;let j;try{j=JSON.parse(s)}catch(e){return J(r,400,{error:'Notoʻgʻri soʻrov'})}
    run(async()=>{const x=await Core.handle(st,j.u,j.b);
     if(x.ok){try{await save(st)}catch(e){console.error('Saqlashda xato:',e.message)}push()}return x}).then(x=>J(r,200,x),e=>{console.error(e);J(r,500,{error:'Server xatosi'})})});return}
  J(r,404,{error:'Topilmadi'})
 }).listen(PORT,'0.0.0.0',()=>{console.log('Server ishga tushdi: http://localhost:'+PORT);
  for(const l of Object.values(os.networkInterfaces()))for(const i of l)if(i.family==='IPv4'&&!i.internal)console.log('Telefonlar uchun: http://'+i.address+':'+PORT)})
})().catch(e=>{console.error('Ishga tushmadi:',e.message);process.exit(1)});
