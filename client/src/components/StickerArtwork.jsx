import React from 'react';

// Original, self-contained vector illustrations for all 16 Media Days stickers.
// Custom artwork uploaded by an admin always takes precedence.
const icons = [
 <><rect x="24" y="51" width="80" height="49" rx="9"/><path d="M24 51l9-22 79 0-8 22z"/><path d="M41 30l-9 20m36-20-9 20m36-20-9 20"/><path d="M58 63l22 13-22 13z" fill="#fff"/></>,
 <><rect x="26" y="33" width="76" height="70" rx="10"/><path d="M26 51h76M45 24v18m38-18v18M43 67h12m17 0h12M43 83h12m17 0h12"/></>,
 <><circle cx="64" cy="69" r="37"/><path d="M64 43v28l19 11M46 23h36M43 18l-9 11m51-11 9 11"/><circle cx="64" cy="69" r="5" fill="#fff"/></>,
 <><path d="M36 21h42l18 18v67H36z"/><path d="M78 21v18h18M47 54h38M47 69h38M47 84h27"/></>,
 <><rect x="20" y="44" width="66" height="52" rx="9"/><path d="M86 58l25-15v52L86 81z"/><circle cx="49" cy="70" r="16"/><circle cx="49" cy="70" r="6" fill="#fff"/></>,
 <><rect x="22" y="32" width="84" height="65" rx="11"/><rect x="32" y="42" width="64" height="43" rx="4"/><path d="M53 97v11m22-11v11M52 59l10 10 17-19" stroke="#a7f3d0"/></>,
 <><path d="M26 25h76v78H26zM38 39h52M38 51h52M38 64h22v26H38zM69 65h21M69 77h21M69 89h21"/></>,
 <><circle cx="42" cy="44" r="14"/><circle cx="42" cy="84" r="14"/><path d="M53 54l49 48M53 74l49-48M80 82l22 20"/></>,
 <><rect x="25" y="27" width="78" height="77" rx="7"/><path d="M25 45h78M25 86h78M42 27v18m20-18v18m20-18v18M42 86v18m20-18v18m20-18v18"/><path d="M51 57l27 12-27 12z" fill="#fff"/></>,
 <><rect x="52" y="22" width="24" height="57" rx="12"/><path d="M40 60a24 24 0 0 0 48 0M64 84v23m-20 0h40"/></>,
 <><path d="M36 49h52v34a26 26 0 0 1-52 0zM88 56h8a13 13 0 0 1 0 26h-8M28 109h72M47 25q-10 12 0 20m18-20q-10 12 0 20m18-20q-10 12 0 20"/></>,
 <><path d="M64 23l10 22 24 4-18 17 5 24-21-11-21 11 5-24-18-17 24-4z"/><path d="M32 100h64M41 110h46"/><circle cx="64" cy="58" r="8" fill="#fff"/></>,
 <><rect x="29" y="28" width="70" height="78" rx="9"/><path d="M45 28v-8h38v8M41 48h46M41 62h30M41 78h46M41 91h23"/><circle cx="83" cy="91" r="6" fill="#fff"/></>,
 <><circle cx="64" cy="33" r="12"/><path d="M64 45v51M64 60l-28 45M64 60l28 45M39 105h-12m74 0H89M47 52h34"/></>,
 <><rect x="52" y="20" width="24" height="62" rx="12"/><path d="M40 64a24 24 0 0 0 48 0M64 88v19M45 107h38"/><path d="M57 37h14M57 49h14M57 61h14"/></>,
 <><circle cx="44" cy="49" r="15"/><circle cx="84" cy="49" r="15"/><circle cx="64" cy="37" r="17"/><path d="M18 98q0-29 26-29 12 0 20 10 8-10 20-10 26 0 26 29v9H18z"/><path d="M53 91l11 9 11-9" stroke="#fff"/></>
];
const palettes = {
 COMMON:['#5b21b6','#2563eb','#67e8f9'],
 RARE:['#7e22ce','#db2777','#f0abfc'],
 EPIC:['#4c1d95','#7c3aed','#fde68a'],
 LEGENDARY:['#92400e','#d97706','#fef08a']
};
export function isMediaDaysArtwork(sticker){return sticker?.pack?.slug==='media-days'||sticker?.packSlug==='media-days'}
export default function StickerArtwork({sticker,className='',style}){
 const number=Number(sticker?.number);
 if(!isMediaDaysArtwork(sticker)||!Number.isInteger(number)||number<1||number>16)return <span className={className} style={style}>{sticker?.emoji||'🎴'}</span>;
 const [base,accent,light]=palettes[sticker.rarity]||palettes.COMMON;
 const id='art-'+number;
 return <svg className={className} style={style} viewBox="0 0 128 128" role="img" aria-label={sticker.title||'Коллекционный стикер'} xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id={id+'bg'} x1="0" y1="0" x2="1" y2="1"><stop stopColor={base}/><stop offset="1" stopColor="#100c29"/></linearGradient><linearGradient id={id+'fg'} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff"/><stop offset=".42" stopColor={light}/><stop offset="1" stopColor={accent}/></linearGradient><filter id={id+'glow'} x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5"/></filter></defs>
  <rect x="4" y="4" width="120" height="120" rx="28" fill={'url(#'+id+'bg)'}/>
  <circle cx="99" cy="28" r="28" fill={accent} opacity=".22" filter={'url(#'+id+'glow)'}/>
  <circle cx="29" cy="99" r="24" fill={light} opacity=".13"/>
  <path d="M19 21l4 6 7 2-7 3-4 6-3-6-7-3 7-2zM106 88l3 5 5 2-5 2-3 5-3-5-5-2 5-2z" fill={light} opacity=".8"/>
  <g fill={'url(#'+id+'fg)'} stroke="#f8f4ff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">{icons[number-1]}</g>
  <rect x="4" y="4" width="120" height="120" rx="28" fill="none" stroke={light} strokeOpacity=".45" strokeWidth="2"/>
 </svg>
}
