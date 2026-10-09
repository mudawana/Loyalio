import {env} from 'cloudflare:workers';
import {applePass,googlePass,WalletCard} from '../../../lib/wallet';
export async function GET(req:Request){
 const url=new URL(req.url),id=url.searchParams.get('card'),provider=url.searchParams.get('provider');
 if(!id||!['apple','google'].includes(provider||''))return Response.json({error:'Ongeldige kaart of provider.'},{status:400});
 const card=await env.DB!.prepare('SELECT c.id,s.name,s.color,s.reward,s.target,COALESCE((SELECT SUM(delta) FROM ledger WHERE card=c.id),0) AS balance FROM cards c JOIN shops s ON s.id=c.shop WHERE c.id=?').bind(id).first<WalletCard>();
 if(!card)return Response.json({error:'Kaart niet gevonden.'},{status:404});
 try{if(provider==='apple'){const bytes=applePass(card,url.origin);return new Response(bytes as unknown as BodyInit,{headers:{'Content-Type':'application/vnd.apple.pkpass','Content-Disposition':'attachment; filename="loyalio.pkpass"','Cache-Control':'no-store'}})}return Response.redirect(await googlePass(card,url.origin),302)}catch(e){return new Response('Wallet-uitgifte is nog niet beschikbaar. Open je webkaart voor het actuele saldo. De beheerder moet de uitgeversinstellingen activeren en testen.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}})}
}
