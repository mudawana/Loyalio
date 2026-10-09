import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Loyalio — klanten die terugkomen',description:'Jouw zaken, klantenkaarten en beloningen op één plek.',icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="nl"><body>{children}</body></html>}
