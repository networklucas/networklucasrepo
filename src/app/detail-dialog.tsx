'use client';
import {useEffect,useRef} from 'react';
import {X} from 'lucide-react';
export function DetailDialog({title,onClose,opener,children}:{title:string;onClose:()=>void;opener:HTMLElement|null;children:React.ReactNode}){
 const close=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  const overflow=document.body.style.overflow;document.body.style.overflow='hidden';close.current?.focus();
  return()=>{document.body.style.overflow=overflow;requestAnimationFrame(()=>{if(opener?.isConnected&&!opener.closest('[inert]'))opener.focus();});};
 },[opener]);
 return <div className="modal-backdrop" onClick={onClose}><section role="dialog" aria-modal="true" aria-label={title} className="detail-modal" onClick={e=>e.stopPropagation()} onKeyDown={e=>{
  if(e.key==='Escape'){e.stopPropagation();onClose();}
  if(e.key==='Tab'){
   const nodes=e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]');
   const first=nodes[0],last=nodes[nodes.length-1];
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
  }
 }}><button className="modal-close" ref={close} onClick={onClose} aria-label="Fechar detalhe"><X size={20}/></button>{children}</section></div>;
}
