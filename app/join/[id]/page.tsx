import {env} from 'cloudflare:workers';
import Join from './join';
import {requireChatGPTUser} from '../../chatgpt-auth';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;const user=await requireChatGPTUser('/join/'+id);const shop=await env.DB!.prepare('SELECT id,name,color,logo,reward,target FROM shops WHERE id=? AND owner=?').bind(id,user.userId).first<any>();if(!shop)return <div className="cardpage"><h1>Zaak niet gevonden</h1></div>;return <Join shop={shop}/>}
