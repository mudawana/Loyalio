import {env} from 'cloudflare:workers';
const db=()=>env.DB!;
const out=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function demo(owner:string){
 const prior=await db().prepare('SELECT id FROM shops WHERE owner=? AND demo=1').bind(owner).first<{id:string}>();if(prior)return out(prior);
 const id=crypto.randomUUID(),now=new Date().toISOString();
 const tasks=[db().prepare('INSERT INTO shops(id,owner,name,color,reward,target,created,logo,demo) VALUES(?,?,?,?,?,?,?,?,1)').bind(id,owner,'Café Noma · demo','#214f40','Een koffie van het huis',10,now,'')];
 const names=['Sara','Youssef','Emma','Amir','Lina','Noah','Sofia','Adam'];
 for(let j=0;j<names.length;j++){const cid=crypto.randomUUID();tasks.push(db().prepare('INSERT INTO cards(id,shop,name,created,email,consent) VALUES(?,?,?,?,?,?)').bind(cid,id,names[j]+' (demo)',now,`demo${j}@example.invalid`,j%2));for(let i=0;i<j+4;i++){const date=new Date(Date.now()-(j+3-i)*86400000).toISOString();tasks.push(db().prepare('INSERT INTO ledger(id,card,delta,kind,actor,created) VALUES(?,?,1,?,?,?)').bind(crypto.randomUUID(),cid,'stamp',owner,date))}}
 for(const [name,cost] of [['Een croissant',6],['Een lunch van het huis',20]] as const)tasks.push(db().prepare('INSERT INTO rewards(id,shop,name,cost,active) VALUES(?,?,?,?,1)').bind(crypto.randomUUID(),id,name,cost));
 await db().batch(tasks);return out({id});
}
export async function features(b:any,shop:any,user:any):Promise<Response|null>{
 const now=new Date().toISOString();
 if(['reward','toggleReward','campaign','branding','undo','deleteCard'].includes(b.action)&&shop.owner!==user.userId)return out({error:'Alleen de eigenaar kan dit doen.'},403);
 if(b.action==='branding'){
  const logo=typeof b.logo==='string'?b.logo:'';
  if(logo.length>150000||logo&&!/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(logo))return out({error:'Gebruik een PNG-, JPEG- of WebP-logo kleiner dan 100 KB.'},400);
  await db().prepare('UPDATE shops SET logo=? WHERE id=?').bind(logo,shop.id).run();return out({ok:true});
 }
 if(b.action==='reward'){
  if(typeof b.name!=='string'||!b.name.trim()||b.name.length>120||!Number.isInteger(b.cost)||b.cost<1||b.cost>1000)return out({error:'Vul een beloning en 1–1000 stempels in.'},400);
  await db().prepare('INSERT INTO rewards(id,shop,name,cost,active) VALUES(?,?,?,?,1)').bind(crypto.randomUUID(),shop.id,b.name.trim(),b.cost).run();return out({ok:true});
 }
 if(b.action==='toggleReward'){
  await db().prepare('UPDATE rewards SET active=1-active WHERE id=? AND shop=?').bind(String(b.id),shop.id).run();return out({ok:true});
 }
 if(b.action==='campaign'){
  if(typeof b.subject!=='string'||!b.subject.trim()||b.subject.length>120||typeof b.body!=='string'||!b.body.trim()||b.body.length>2000||!['all','returning','inactive','reward'].includes(b.segment))return out({error:'Vul een onderwerp, bericht en doelgroep in.'},400);
  await db().prepare('INSERT INTO campaigns(id,shop,subject,body,segment,created) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),shop.id,b.subject.trim(),b.body.trim(),b.segment,now).run();return out({ok:true});
 }
 if(b.action==='undo'){
  const original=await db().prepare('SELECT l.* FROM ledger l JOIN cards c ON c.id=l.card WHERE l.id=? AND c.shop=? AND l.kind IN (\'stamp\',\'redeem\')').bind(String(b.id),shop.id).first<any>();
  if(!original)return out({error:'Transactie niet gevonden.'},404);
  const delta=-original.delta;
  const r=await db().prepare('INSERT OR IGNORE INTO ledger(id,card,delta,kind,actor,created) SELECT ?,?,?,?,?,? WHERE ?>=0 OR COALESCE((SELECT SUM(delta) FROM ledger WHERE card=?),0)>=?').bind('undo:'+original.id,original.card,delta,'correction',user.userId,now,delta,original.card,-delta).run();
  if(!r.meta.changes){const done=await db().prepare('SELECT id FROM ledger WHERE id=?').bind('undo:'+original.id).first();if(!done)return out({error:'De stempel is al verbruikt. Het saldo mag niet negatief worden.'},409)}return out({ok:true});
 }
 if(b.action==='deleteCard'){
  const card=await db().prepare('SELECT id FROM cards WHERE id=? AND shop=?').bind(String(b.id),shop.id).first();if(!card)return out({error:'Kaart niet gevonden.'},404);
  await db().batch([db().prepare('DELETE FROM ledger WHERE card=?').bind(b.id),db().prepare('DELETE FROM cards WHERE id=? AND shop=?').bind(b.id,shop.id)]);return out({ok:true});
 }
 return null;
}
