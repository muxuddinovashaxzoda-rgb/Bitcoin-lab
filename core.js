// Umumiy yadro: telefonda (brauzerda) ham, serverda (Node) ham bir xil ishlaydi.
(function(g){
const enc=new TextEncoder(),HALVING=210000,START=840000,I=Number.isSafeInteger;
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
const sha=async s=>hex(await crypto.subtle.digest('SHA-256',enc.encode(s)));
const dsha=async s=>hex(await crypto.subtle.digest('SHA-256',await crypto.subtle.digest('SHA-256',enc.encode(s))));
const subsidy=i=>Math.floor(5e9/2**Math.floor((START+i)/HALVING)); // satoshi: 840000-blokdan boshlab 3.125 BTC
const txData=t=>`${t.from}>${t.to}:${t.amount}:${t.fee}:${t.ts}:${t.l||''}:${t.n||0}`;
const header=b=>`${b.i}|${b.prev}|${b.time}|${b.merkle}|${b.diff}|${b.nonce}`;
const shopMsg=o=>`${o.kind}|${o.from}|${o.name||''}|${o.pid||''}|${o.id||''}|${o.qty||0}|${o.price||0}|${o.ts}`;
async function merkle(txs){if(!txs.length)return dsha('');let l=await Promise.all(txs.map(t=>dsha(txData(t))));
 while(l.length>1){if(l.length%2)l.push(l[l.length-1]);const n=[];for(let i=0;i<l.length;i+=2)n.push(await dsha(l[i]+l[i+1]));l=n}return l[0]}
// p=true: kutilayotgan (mempool) tranzaksiyalar ham hisobga olinadi
const bal=(st,a,p)=>{let s=0;const f=t=>{if(t.to===a)s+=t.amount;if(t.from===a)s-=t.amount+t.fee};st.chain.forEach(b=>b.txs.forEach(f));if(p)st.mempool.forEach(f);return s};
const chainSigs=st=>new Set(st.chain.flatMap(b=>b.txs.map(t=>t.sig)));
const pickTx=t=>({from:String(t.from),to:String(t.to),amount:t.amount,fee:t.fee,ts:t.ts,sig:String(t.sig||''),l:String(t.l||''),n:t.n||0});
async function sigOk(st,addr,msg,sig){const u=st.users[addr];if(!u)return false;
 try{const k=await crypto.subtle.importKey('jwk',{kty:'EC',crv:'P-256',x:u.pub.x,y:u.pub.y,ext:true},{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  return await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},k,Uint8Array.from(atob(sig),c=>c.charCodeAt(0)),enc.encode(msg))}catch(e){return false}}
async function txErr(st,t,avail,seen){
 if(!st.users[t.from]||!st.users[t.to]||t.from===t.to)return'Foydalanuvchi notoʻgʻri';
 if(!I(t.amount)||t.amount<=0||!I(t.fee)||t.fee<0||!I(t.ts)||!I(t.n))return'Miqdor notoʻgʻri';
 if(t.amount+t.fee>avail)return'Balans yetarli emas';
 if(seen.has(t.sig))return'Takroriy tranzaksiya';
 return await sigOk(st,t.from,txData(t),t.sig)?null:'Imzo notoʻgʻri'}
async function blockErr(st,b){const tip=st.chain[st.chain.length-1];
 if(!I(b.i)||b.i!==st.chain.length||b.prev!==tip.hash)return'Blok eskirgan: boshqa konchi oldinroq topdi';
 if(b.diff!==st.diff)return'Qiyinchilik oʻzgargan, qayta qazing';
 if(!b.txs.length||b.txs.length>200||!I(b.nonce)||!I(b.time))return'Blok parametrlari notoʻgʻri';
 if(await merkle(b.txs)!==b.merkle)return'Merkle ildizi mos emas';
 const h=await dsha(header(b));if(h!==b.hash||!h.startsWith('0'.repeat(b.diff)))return'Proof of Work notoʻgʻri';
 const [cb,...rest]=b.txs,bl={},seen=chainSigs(st),B=a=>bl[a]??(bl[a]=bal(st,a,0));let fees=0;
 for(const t of rest){const e=await txErr(st,t,B(t.from),seen);if(e)return e;seen.add(t.sig);bl[t.from]-=t.amount+t.fee;bl[t.to]=B(t.to)+t.amount;fees+=t.fee}
 if(cb.from!=='COINBASE'||!st.users[cb.to]||cb.amount!==subsidy(b.i)+fees||cb.fee!==0)return'Mukofot miqdori notoʻgʻri';return null}
async function fresh(){const g={i:0,prev:'0'.repeat(64),time:Date.now(),merkle:await dsha(''),diff:1,nonce:0,txs:[]};
 while(!(g.hash=await dsha(header(g))).startsWith('0'))g.nonce++;
 return{chain:[g],users:{},mempool:[],shop:{products:{},listings:{},inv:{}},diff:3,seq:0,opsig:{}}}
async function handle(st,u,b){b=b||{};
 if(u==='/api/register'){const p=b.pub||{},n=String(b.name||'').trim().slice(0,40),f=String(b.surname||'').trim().slice(0,40);
  if(!n||!f||typeof p.x!=='string'||p.x.length!==43||typeof p.y!=='string'||p.y.length!==43)return{error:'Ism, familiya yoki kalit notoʻgʻri'};
  const a=(await sha(p.x+p.y)).slice(0,20);if(!st.users[a])st.users[a]={name:n,surname:f,pub:{x:p.x,y:p.y},at:Date.now()};return{ok:1,addr:a}}
 if(u==='/api/diff'){const d=b.d|0;if(d<1||d>6)return{error:'Qiyinchilik 1 dan 6 gacha'};st.diff=d;return{ok:1}}
 if(u==='/api/tx'){const t=pickTx(b),e=await txErr(st,t,bal(st,t.from,1),new Set([...chainSigs(st),...st.mempool.map(m=>m.sig)]));if(e)return{error:e};
  if(t.l){const L=st.shop.listings[t.l];if(!L||L.seller!==t.to||t.n<1||t.n>L.qty||t.amount!==L.price*t.n)return{error:'Mahsulot narxi yoki soni mos emas'};
   L.qty-=t.n;const iv=st.shop.inv[t.from]=st.shop.inv[t.from]||{};iv[L.pid]=(iv[L.pid]||0)+t.n;if(L.qty===0)delete st.shop.listings[t.l]}
  st.mempool.push(t);return{ok:1}}
 if(u==='/api/shop'){const o={kind:String(b.kind),from:String(b.from),name:String(b.name||'').trim().slice(0,40),pid:String(b.pid||''),id:String(b.id||''),qty:b.qty,price:b.price,ts:b.ts},sig=String(b.sig||'');
  if(!st.users[o.from]||st.opsig[sig]||!await sigOk(st,o.from,shopMsg(o),sig))return{error:'Imzo notoʻgʻri'};
  const S=st.shop,inv=S.inv[o.from]=S.inv[o.from]||{};
  if(o.kind==='new'){if(!o.name||!I(o.qty)||o.qty<1||!I(o.price)||o.price<1)return{error:'Nom, son yoki narx notoʻgʻri'};
   const pid='p'+(++st.seq),id='l'+(++st.seq);S.products[pid]={name:o.name,creator:o.from};S.listings[id]={id,pid,seller:o.from,price:o.price,qty:o.qty}}
  else if(o.kind==='relist'){if(!S.products[o.pid]||!I(o.qty)||o.qty<1||(inv[o.pid]||0)<o.qty||!I(o.price)||o.price<1)return{error:'Sizda bu miqdorda mahsulot yoʻq yoki narx notoʻgʻri'};
   inv[o.pid]-=o.qty;const id='l'+(++st.seq);S.listings[id]={id,pid:o.pid,seller:o.from,price:o.price,qty:o.qty}}
  else if(o.kind==='unlist'){const L=S.listings[o.id];if(!L||L.seller!==o.from)return{error:'Topilmadi'};inv[L.pid]=(inv[L.pid]||0)+L.qty;delete S.listings[o.id]}
  else return{error:'Nomaʼlum amal'};
  st.opsig[sig]=1;return{ok:1}}
 if(u==='/api/restore'){ // Server uyqudan uygʻonib boʻsh qolganda, telefondagi nusxadan tiklash. Zanjir toʻliq qayta tekshiriladi.
  if(st.chain.length>1||Object.keys(st.users).length)return{error:'Server boʻsh emas'};
  const c=b.chain;if(!Array.isArray(c)||c.length<2||!b.users||typeof b.users!=='object')return{error:'Nusxa notoʻgʻri'};
  const g=c[0];if(!g||g.i!==0||g.prev!=='0'.repeat(64)||(g.txs||[]).length||!I(g.nonce)||!I(g.diff)||g.hash!==await dsha(header(g))||!g.hash.startsWith('0'.repeat(g.diff)))return{error:'Genesis notoʻgʻri'};
  const users={};for(const[a,x]of Object.entries(b.users))if(x&&x.pub&&typeof x.pub.x==='string'&&typeof x.pub.y==='string'&&(await sha(x.pub.x+x.pub.y)).slice(0,20)===a)users[a]={name:String(x.name).slice(0,40),surname:String(x.surname).slice(0,40),pub:{x:x.pub.x,y:x.pub.y},at:x.at};
  const T={chain:[g],users,mempool:[],diff:1};
  for(const x of c.slice(1)){const k={i:x.i,prev:String(x.prev),time:x.time,merkle:String(x.merkle),diff:x.diff,nonce:x.nonce,hash:String(x.hash),txs:(x.txs||[]).map(pickTx)};T.diff=k.diff;const e=await blockErr(T,k);if(e)return{error:'Zanjir yaroqsiz: '+e};T.chain.push(k)}
  const sh=b.shop&&b.shop.products&&b.shop.listings&&b.shop.inv?b.shop:st.shop;
  st.chain=T.chain;st.users=users;st.shop=sh;st.diff=I(b.diff)&&b.diff>=1&&b.diff<=6?b.diff:3;st.seq=I(b.seq)?b.seq:0;st.opsig=b.opsig&&typeof b.opsig==='object'?b.opsig:{};st.mempool=[];
  for(const t of(Array.isArray(b.mempool)?b.mempool:[]).map(pickTx))if(!await txErr(st,t,bal(st,t.from,1),new Set([...chainSigs(st),...st.mempool.map(m=>m.sig)])))st.mempool.push(t);
  return{ok:1}}
 if(u==='/api/block'){if(!Array.isArray(b.txs))return{error:'Blok notoʻgʻri'};
  const k={i:b.i,prev:String(b.prev),time:b.time,merkle:String(b.merkle),diff:b.diff,nonce:b.nonce,hash:String(b.hash),txs:b.txs.map(pickTx)};
  const e=await blockErr(st,k);if(e)return{error:e};st.chain.push(k);const sg=new Set(k.txs.map(t=>t.sig));st.mempool=st.mempool.filter(t=>!sg.has(t.sig));return{ok:1}}
 return{error:'Nomaʼlum soʻrov'}}
const API={fresh,handle,bal,sha,dsha,merkle,header,txData,shopMsg,subsidy,HALVING,START};
if(typeof module!=='undefined')module.exports=API;else g.Core=API;
})(typeof window!=='undefined'?window:globalThis);
