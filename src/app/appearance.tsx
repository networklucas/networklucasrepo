'use client';
import {useEffect,useState} from 'react';
type Theme='system'|'light'|'dark';
type TextSize='standard'|'large';
export function Appearance(){
 const [theme,setTheme]=useState<Theme>('dark'),[textSize,setTextSize]=useState<TextSize>('standard');
 useEffect(()=>{setTheme((document.documentElement.dataset.theme as Theme)||'dark');setTextSize((document.documentElement.dataset.textSize as TextSize)||'standard');},[]);
 function apply(nextTheme:Theme,nextSize:TextSize){
  setTheme(nextTheme);setTextSize(nextSize);document.documentElement.dataset.theme=nextTheme;document.documentElement.dataset.textSize=nextSize;
  try{localStorage.setItem('bussola:appearance:v1',JSON.stringify({theme:nextTheme,textSize:nextSize}));}catch{/* Preferences remain usable when storage is unavailable. */}
 }
 return <div className="appearance" role="group" aria-label="Preferências de leitura">
  <label>Tema<select aria-label="Tema" value={theme} onChange={e=>apply(e.target.value as Theme,textSize)}><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Escuro</option></select></label>
  <label>Texto<select aria-label="Texto" value={textSize} onChange={e=>apply(theme,e.target.value as TextSize)}><option value="standard">Padrão</option><option value="large">Ampliado</option></select></label>
 </div>;
}
