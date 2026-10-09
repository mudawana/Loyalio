import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
export async function POST(req:Request){
 if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Ongeldige herkomst.'},{status:403});
 // Owner-operated demonstration only. Public enrollment requires a separate launch/access review.
 const user=await getChatGPTUser();if(!user)return Response.json({error:'De inschrijving is momenteel alleen beschikbaar in de privétest.'},{status:401});
 let b:any;try{b=await req.json()}catch{return Response.json({error:'Ongeldig verzoek.'},{status:400})}
 if(!b||typeof b.name!=='string'||!b.name.trim()||b.name.length>80||typeof b.shop!=='string'||b.terms!==true)return Response.json({error:'Vul je naam in en bevestig de testvoorwaarden.'},{status:400});
 const shop=await env.DB!.prepare('SELECT id FROM shops WHERE id=? AND owner=?').bind(b.shop,user.userId).first();if(!shop)return Response.json({error:'Geen toegang tot deze testzaak.'},{status:403});
 const email=typeof b.email==='string'?b.email.trim().toLowerCase():'';
 if(email&&(!/^\S+@\S+\.\S+$/.test(email)||email.length>254)||b.consent&&!email)return Response.json({error:'Vul een geldig e-mailadres in voor berichten.'},{status:400});
 if(typeof b.id!=='string'||! /^[a-f0-9-]{36}$/i.test(b.id))return Response.json({error:'Ongeldig inschrijvingsnummer.'},{status:400});
 await env.DB!.prepare('INSERT OR IGNORE INTO cards(id,shop,name,created,email,consent) VALUES(?,?,?,?,?,?)').bind(b.id,b.shop,b.name.trim(),new Date().toISOString(),email,b.consent?1:0).run();
 const result=await env.DB!.prepare('SELECT id FROM cards WHERE id=? AND shop=?').bind(b.id,b.shop).first();if(!result)return Response.json({error:'Inschrijving niet gelukt.'},{status:409});
 return Response.json({id:b.id});
}
