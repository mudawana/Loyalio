import {demo,features} from '../../../lib/features';
import {walletStatus} from '../../../lib/wallet';
import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
const db=()=>env.DB!;
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){
 const user=await getChatGPTUser(); if(!user)return reply({error:'Meld je eerst aan.'},401);
 const shops=await db().prepare('SELECT DISTINCT s.*, CASE WHEN s.owner=? THEN 1 ELSE 0 END AS isOwner FROM shops s LEFT JOIN staff t ON t.shop=s.id WHERE s.owner=? OR t.email=? ORDER BY s.created').bind(user.userId,user.userId,user.email.toLowerCase()).all();
 const cards=await db().prepare('SELECT c.*, COALESCE(SUM(l.delta),0) AS balance, COUNT(CASE WHEN l.kind=\'stamp\' THEN 1 END) AS visits, MAX(CASE WHEN l.kind=\'stamp\' THEN l.created END) AS lastVisit FROM cards c LEFT JOIN ledger l ON l.card=c.id WHERE c.shop IN (SELECT s.id FROM shops s WHERE s.owner=? OR EXISTS(SELECT 1 FROM staff t WHERE t.shop=s.id AND t.email=?)) GROUP BY c.id ORDER BY c.created DESC').bind(user.userId,user.email.toLowerCase()).all();
 const events=await db().prepare('SELECT l.*, c.name, c.shop FROM ledger l JOIN cards c ON c.id=l.card JOIN shops s ON s.id=c.shop WHERE s.owner=? OR EXISTS(SELECT 1 FROM staff t WHERE t.shop=s.id AND t.email=?) ORDER BY l.created DESC LIMIT 100').bind(user.userId,user.email.toLowerCase()).all();
 const staff=await db().prepare('SELECT t.* FROM staff t JOIN shops s ON s.id=t.shop WHERE s.owner=?').bind(user.userId).all();
 const rewards=await db().prepare('SELECT r.* FROM rewards r JOIN shops s ON s.id=r.shop WHERE s.owner=? OR EXISTS(SELECT 1 FROM staff t WHERE t.shop=s.id AND t.email=?) ORDER BY r.cost').bind(user.userId,user.email.toLowerCase()).all();
 const campaigns=await db().prepare('SELECT c.* FROM campaigns c JOIN shops s ON s.id=c.shop WHERE s.owner=? ORDER BY c.created DESC').bind(user.userId).all();
 return reply({shops:shops.results,cards:cards.results,events:events.results,staff:staff.results,rewards:rewards.results,campaigns:campaigns.results,wallet:walletStatus()});
}
export async function POST(req:Request){
 if(req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'Ongeldige herkomst.'},403);
 const user=await getChatGPTUser();if(!user)return reply({error:'Meld je eerst aan.'},401);
 let b:any;try{b=await req.json()}catch{return reply({error:'Ongeldig verzoek.'},400)}
 if(!b||typeof b!=='object')return reply({error:'Ongeldig verzoek.'},400);
 const clean=(x:unknown,max=80)=>typeof x==='string'&&x.trim().length>0&&x.trim().length<=max?x.trim():null;
 const now=new Date().toISOString();
 if(b.action==='demo')return demo(user.userId);
 if(b.action==='shop'){
  const name=clean(b.name);if(!name)return reply({error:'Vul een naam in (maximaal 80 tekens).'},400);
  const id=crypto.randomUUID();await db().prepare('INSERT INTO shops (id,owner,name,color,reward,target,created) VALUES (?,?,?,?,?,?,?)').bind(id,user.userId,name,'#214f40','Een gratis koffie',10,now).run();return reply({id});
 }
 const shop=await db().prepare('SELECT * FROM shops WHERE id=? AND (owner=? OR EXISTS(SELECT 1 FROM staff WHERE staff.shop=shops.id AND staff.email=?))').bind(String(b.shop||''),user.userId,user.email.toLowerCase()).first<any>();
 if(!shop)return reply({error:'Geen toegang tot deze zaak.'},403);
 if(['settings','staff','removeStaff'].includes(b.action)&&shop.owner!==user.userId)return reply({error:'Alleen de eigenaar kan dit wijzigen.'},403);
 const extra=await features(b,shop,user);if(extra)return extra;
 if(b.action==='card'){
  const name=clean(b.name);if(!name)return reply({error:'Vul een naam of klantalias in.'},400);
  const id=crypto.randomUUID();await db().prepare('INSERT INTO cards(id,shop,name,created) VALUES(?,?,?,?)').bind(id,shop.id,name,now).run();return reply({id});
 }
 if(b.action==='settings'){
  const name=clean(b.name), reward=clean(b.reward,120);if(!name||!reward||!Number.isInteger(b.target)||b.target<1||b.target>100||!/^#[0-9a-f]{6}$/i.test(b.color))return reply({error:'Controleer de naam, beloning, kleur en het aantal stempels (1–100).'},400);
  await db().prepare('UPDATE shops SET name=?,color=?,reward=?,target=? WHERE id=?').bind(name,b.color,reward,b.target,shop.id).run();return reply({ok:true});
 }
 if(b.action==='staff'){
  const email=clean(b.email,254)?.toLowerCase();if(!email||!/^\S+@\S+\.\S+$/.test(email))return reply({error:'Vul een geldig e-mailadres in.'},400);
  await db().prepare('INSERT INTO staff(id,shop,email,created) SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM staff WHERE shop=? AND email=?)').bind(crypto.randomUUID(),shop.id,email,now,shop.id,email).run();return reply({ok:true});
 }
 if(b.action==='removeStaff'){await db().prepare('DELETE FROM staff WHERE id=? AND shop=?').bind(String(b.id),shop.id).run();return reply({ok:true})}
 if(b.action==='stamp'||b.action==='redeem'){
  if(typeof b.requestId!=='string'||! /^[a-f0-9-]{36}$/i.test(b.requestId))return reply({error:'Ongeldig transactienummer.'},400);
  const card=await db().prepare('SELECT id FROM cards WHERE id=? AND shop=?').bind(String(b.card),shop.id).first();if(!card)return reply({error:'Kaart niet gevonden in deze zaak.'},404);
  let cost=shop.target;
  if(b.action==='redeem'&&b.rewardId){const reward=await db().prepare('SELECT cost FROM rewards WHERE id=? AND shop=? AND active=1').bind(String(b.rewardId),shop.id).first<{cost:number}>();if(!reward)return reply({error:'Deze beloning is niet beschikbaar.'},400);cost=reward.cost}
  const delta=b.action==='stamp'?1:-cost;
  // One atomic INSERT computes the balance and guards redemption. A unique key prevents retries from awarding twice.
  const result=await db().prepare('INSERT OR IGNORE INTO ledger(id,card,delta,kind,actor,created) SELECT ?,?,?,?,?,? WHERE ? > 0 OR COALESCE((SELECT SUM(delta) FROM ledger WHERE card=?),0) >= ?').bind(b.requestId,b.card,delta,b.action,user.userId,now,delta,b.card,cost).run();
  if(!result.meta.changes){const prior=await db().prepare('SELECT id FROM ledger WHERE id=? AND card=? AND kind=?').bind(b.requestId,b.card,b.action).first();if(!prior)return reply({error:'Nog niet genoeg stempels voor deze beloning.'},409)}
  return reply({ok:true});
 }
 return reply({error:'Onbekende actie.'},400);
}
