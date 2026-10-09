import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createRequire} from 'node:module';
import {realpathSync,readFileSync,readdirSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(realpathSync('node_modules/drizzle-kit/bin.cjs'));
const {build}=require('esbuild');
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
for(const name of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+name,'utf8'));
class Statement{constructor(text){this.text=text;this.args=[]}bind(...args){this.args=args;return this}async all(){return{results:sql.prepare(this.text).all(...this.args)}}async first(){return sql.prepare(this.text).get(...this.args)||null}async run(){const r=sql.prepare(this.text).run(...this.args);return{meta:{changes:Number(r.changes)}}}}
globalThis.__db={prepare(text){return new Statement(text)},async batch(statements){sql.exec('BEGIN');try{const output=[];for(const s of statements)output.push(await s.run());sql.exec('COMMIT');return output}catch(e){sql.exec('ROLLBACK');throw e}}};
mkdirSync('.sites-runtime/api-tests',{recursive:true});
const routes={};
for(const name of ['data','enroll','card','wallet']){const file=resolve('.sites-runtime/api-tests/'+name+'.mjs');await build({entryPoints:['app/api/'+name+'/route.ts'],bundle:true,format:'esm',platform:'node',packages:'external',outfile:file,plugins:[{name:'test-boundaries',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'test'}));b.onResolve({filter:/chatgpt-auth$/},()=>({path:'auth',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},a=>({contents:a.path==='env'?'export const env={get DB(){return globalThis.__db}};':'export async function getChatGPTUser(){return globalThis.__user||null}'}))}}]});routes[name]=await import(pathToFileURL(file).href)}
const alice={userId:'alice',email:'alice@example.test'},bob={userId:'bob',email:'bob@example.test'},staff={userId:'staff',email:'staff@example.test'};
async function post(route,body,status=200,origin='https://loyalio.test'){const r=await routes[route].POST(new Request('https://loyalio.test/api/'+route,{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)}));const result=await r.json();assert.equal(r.status,status,JSON.stringify(result));return result}
async function data(){const r=await routes.data.GET();assert.equal(r.status,200);return r.json()}
assert.equal((await routes.data.GET()).status,401);
globalThis.__user=alice;
await post('data',{action:'shop',name:'bad origin'},403,'https://evil.test');
const shop=(await post('data',{action:'shop',name:'Alice Café'})).id;
const demo=(await post('data',{action:'demo'})).id;assert.equal((await post('data',{action:'demo'})).id,demo);
const cid=crypto.randomUUID();
await post('enroll',{id:cid,shop,name:'Test customer',terms:false},400);
await post('enroll',{id:cid,shop,name:'Test customer',terms:true,consent:true},400);
await post('enroll',{id:cid,shop,name:'Test customer',terms:true,email:'customer@example.test',consent:true});
await post('enroll',{id:cid,shop,name:'Test customer',terms:true,email:'customer@example.test',consent:true});
assert.equal((await data()).cards.filter(c=>c.id===cid).length,1);
await post('data',{action:'reward',shop,name:'Croissant',cost:3});
const reward=(await data()).rewards.find(r=>r.shop===shop);
const stamps=[];for(let i=0;i<4;i++){const requestId=crypto.randomUUID();stamps.push(requestId);await post('data',{action:'stamp',shop,card:cid,requestId});await post('data',{action:'stamp',shop,card:cid,requestId})}
assert.equal((await data()).cards.find(c=>c.id===cid).balance,4);
const redemption=crypto.randomUUID();await post('data',{action:'redeem',shop,card:cid,rewardId:reward.id,requestId:redemption});await post('data',{action:'redeem',shop,card:cid,rewardId:reward.id,requestId:redemption});
assert.equal((await data()).cards.find(c=>c.id===cid).balance,1);
await post('data',{action:'redeem',shop,card:cid,rewardId:reward.id,requestId:crypto.randomUUID()},409);
await post('data',{action:'undo',shop,id:redemption});await post('data',{action:'undo',shop,id:redemption});assert.equal((await data()).cards.find(c=>c.id===cid).balance,4);
await post('data',{action:'toggleReward',shop,id:reward.id});await post('data',{action:'redeem',shop,card:cid,rewardId:reward.id,requestId:crypto.randomUUID()},400);
await post('data',{action:'staff',shop,email:staff.email});globalThis.__user=staff;
await post('data',{action:'stamp',shop,card:cid,requestId:crypto.randomUUID()});
await post('data',{action:'reward',shop,name:'Forbidden',cost:2},403);
await post('data',{action:'campaign',shop,subject:'Forbidden',body:'body',segment:'all'},403);
await post('card',{action:'delete',id:cid,confirm:true},403);
globalThis.__user=bob;assert.equal((await data()).shops.length,0);await post('data',{action:'stamp',shop,card:cid,requestId:crypto.randomUUID()},403);
await post('enroll',{id:crypto.randomUUID(),shop,name:'Forbidden',terms:true},403);
globalThis.__user=alice;const entry=(await data()).staff.find(x=>x.shop===shop);await post('data',{action:'removeStaff',shop,id:entry.id});globalThis.__user=staff;await post('data',{action:'stamp',shop,card:cid,requestId:crypto.randomUUID()},403);
globalThis.__user=alice;await post('data',{action:'campaign',shop,subject:'Welcome',body:'A demonstration.',segment:'all'});assert.equal((await data()).campaigns.length,1);
const customer=await(await routes.card.GET(new Request('https://loyalio.test/api/card?id='+cid))).json();assert.equal(customer.card.balance,5);assert.equal(customer.card.email,undefined);assert.equal(customer.card.name,'Alice Café');assert.equal(customer.wallet.apple,false);
assert.equal((await routes.wallet.GET(new Request('https://loyalio.test/api/wallet?card='+cid+'&provider=apple'))).status,503);
await post('card',{action:'unsubscribe',id:cid});assert.equal((await data()).cards.find(c=>c.id===cid).consent,0);
await post('card',{action:'delete',id:cid,confirm:true});assert.equal((await data()).cards.some(c=>c.id===cid),false);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM ledger WHERE card=?').get(cid).n,0);
console.log('PASS: authentication, origin checks, tenant isolation, demo setup, enrollment retries, reward tiers, redemption balance, transaction idempotency, corrections, staff permissions/revocation, campaign drafts, Wallet inactive status, consent withdrawal and deletion.');
