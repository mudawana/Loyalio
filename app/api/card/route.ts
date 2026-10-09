import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {walletStatus} from '../../../lib/wallet';
export async function GET(req:Request){const id=new URL(req.url).searchParams.get('id');if(!id)return Response.json({error:'Kaart ontbreekt'},{status:400});
 const card=await env.DB!.prepare('SELECT c.id,c.consent,s.id AS shop,s.name,s.color,s.logo,s.reward,s.target,COALESCE((SELECT SUM(delta) FROM ledger WHERE card=c.id),0) AS balance FROM cards c JOIN shops s ON s.id=c.shop WHERE c.id=?').bind(id).first<any>();
 if(!card)return Response.json({error:'Deze kaart bestaat niet meer.'},{status:404});
 const rewards=await env.DB!.prepare('SELECT id,name,cost FROM rewards WHERE shop=? AND active=1 ORDER BY cost').bind(card.shop).all();const events=await env.DB!.prepare('SELECT id,delta,kind,created FROM ledger WHERE card=? ORDER BY created DESC LIMIT 20').bind(id).all();
 return Response.json({card,rewards:rewards.results,events:events.results,wallet:walletStatus()},{headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
export async function POST(req:Request){if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Ongeldige herkomst'},{status:403});const user=await getChatGPTUser();if(!user)return Response.json({error:'Meld je aan voor deze privétest.'},{status:401});let b:any;try{b=await req.json()}catch{return Response.json({error:'Ongeldig verzoek'},{status:400})}
 if(!b||typeof b.id!=='string')return Response.json({error:'Kaart ontbreekt'},{status:400});const card=await env.DB!.prepare('SELECT c.id FROM cards c JOIN shops s ON s.id=c.shop WHERE c.id=? AND s.owner=?').bind(b.id,user.userId).first();if(!card)return Response.json({error:'Geen toegang.'},{status:403});
 if(b.action==='unsubscribe'){await env.DB!.prepare('UPDATE cards SET consent=0 WHERE id=?').bind(b.id).run();return Response.json({ok:true})}
 if(b.action==='delete'&&b.confirm===true){await env.DB!.batch([env.DB!.prepare('DELETE FROM ledger WHERE card=?').bind(b.id),env.DB!.prepare('DELETE FROM cards WHERE id=?').bind(b.id)]);return Response.json({ok:true})}
 return Response.json({error:'Ongeldige actie'},{status:400});
}
