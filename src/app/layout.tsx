import type {Metadata} from 'next';
import './globals.css';
import './accessibility.css';
import './workspace.css';
import './minimal.css';
import {Analytics} from '@vercel/analytics/next';
import {SpeedInsights} from '@vercel/speed-insights/next';
import {appearanceBootstrap} from '@/lib/appearance-preferences';
export const metadata:Metadata={title:'Bússola de Produto — decisões com direção',description:'Seu espaço pessoal para pensar produto. Copiloto, conceitos e uma biblioteca para decidir com mais clareza.',robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR" data-theme="dark" data-text-size="standard" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:appearanceBootstrap}}/></head><body>{children}<Analytics /><SpeedInsights /></body></html>;}
