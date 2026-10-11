import React from 'react';

// Sixteen playful cat expressions, all drawn as scalable SVG with no external assets.
const moods=['happy','surprised','sleepy','serious','inspired','panicked','like','shy','love','sad','victory','thinking','tired','sly','excited','purr'];
export default function CatStickerArtwork({sticker,className='',style}){
 const n=Number(sticker?.number),m=moods[n-1]||'happy';
 const rare=sticker?.rarity==='LEGENDARY',epic=sticker?.rarity==='EPIC';
 const id='cat-'+n;
 const eyesClosed=['sleepy','tired','purr','love'].includes(m);
 const eyesWide=['surprised','panicked','excited'].includes(m);
 const eyesSad=['sad','panicked'].includes(m);
 const smile=['happy','inspired','like','victory','excited','purr','love'].includes(m);
 const ears=<><path d="M27 54L24 19Q22 12 32 18L51 32M77 32l19-14q10-6 9 6l-3 30" fill="#f7a45f" stroke="#7c3157" strokeWidth="4"/><path d="M30 26l4 18 12-11M97 26l-4 18-12-11" fill="#fb6aa4"/></>;
 return <svg className={className} style={style} viewBox="0 0 128 128" role="img" aria-label={sticker?.title||'Эмоция кота'}>
 <defs><linearGradient id={id+'fur'} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ffde9c"/><stop offset=".6" stopColor="#f9a45e"/><stop offset="1" stopColor="#ef73a1"/></linearGradient><radialGradient id={id+'bg'}><stop stopColor={rare?'#fef08a':epic?'#e9d5ff':'#fbcfe8'}/><stop offset="1" stopColor={rare?'#e879f9':'#a78bfa'}/></radialGradient></defs>
 <rect x="4" y="4" width="120" height="120" rx="30" fill={'url(#'+id+'bg)'}/>
 <circle cx="64" cy="64" r="53" fill="#fff" opacity=".12"/>
 {ears}
 <path d="M20 64Q20 28 64 27q44 1 44 37v15q-2 34-44 35Q22 113 20 79z" fill={'url(#'+id+'fur)'} stroke="#7c3157" strokeWidth="4"/>
 <path d="M47 38l-6 12m23-17v13m17-8 6 12" stroke="#c66a52" strokeWidth="4" strokeLinecap="round"/>
 <ellipse cx="39" cy="79" rx="12" ry="8" fill="#f06b9c" opacity=".6"/><ellipse cx="89" cy="79" rx="12" ry="8" fill="#f06b9c" opacity=".6"/>
 {eyesClosed?<g stroke="#432445" strokeWidth="4" strokeLinecap="round" fill="none"><path d="M36 66q10 10 20 0M73 66q10 10 20 0"/></g>:<g><ellipse cx="46" cy="66" rx={eyesWide?9:7} ry={eyesWide?13:10} fill="#432445"/><ellipse cx="82" cy="66" rx={eyesWide?9:7} ry={eyesWide?13:10} fill="#432445"/><circle cx="43" cy="62" r="3" fill="#fff"/><circle cx="79" cy="62" r="3" fill="#fff"/>{eyesSad&&<path d="M35 50l18 7m40-7-18 7" stroke="#7c3157" strokeWidth="4"/>}</g>}
 <path d="M58 79q6-5 12 0l-6 6z" fill="#c6467c"/>
 {eyesWide?<ellipse cx="64" cy="95" rx="9" ry="12" fill="#7c3157"/>:smile?<path d="M48 89q16 23 32 0" stroke="#7c3157" strokeWidth="4" fill="none" strokeLinecap="round"/>:<path d={m==='sad'?'M50 102q14-17 28 0':'M53 96q11-4 22 0'} stroke="#7c3157" strokeWidth="4" fill="none" strokeLinecap="round"/>}
 <path d="M29 87L12 83m17 12-17 3m87-11 17-4m-17 12 17 3" stroke="#7c3157" strokeWidth="2.5" strokeLinecap="round"/>
 {m==='love'&&<text x="91" y="29" fontSize="25">💗</text>}
 {m==='victory'&&<text x="86" y="31" fontSize="24">🏆</text>}
 {m==='thinking'&&<text x="92" y="30" fontSize="24">💭</text>}
 {m==='sleepy'&&<text x="89" y="31" fontSize="25">💤</text>}
 {m==='inspired'&&<text x="91" y="30" fontSize="23">✨</text>}
 {m==='like'&&<text x="91" y="30" fontSize="22">👍</text>}
 {m==='shy'&&<path d="M36 87q-12 10-6 18m62-18q12 10 6 18" stroke="#fff" strokeWidth="5" strokeLinecap="round"/>}
 {m==='sly'&&<path d="M35 55l19 7m39-7-19 7" stroke="#7c3157" strokeWidth="4" strokeLinecap="round"/>}
 {rare&&<path d="M64 10l4 9 10 2-8 6 2 10-8-5-8 5 2-10-8-6 10-2z" fill="#fde047" stroke="#b45309" strokeWidth="2"/>}
 <rect x="4" y="4" width="120" height="120" rx="30" stroke="#fff" strokeOpacity=".65" strokeWidth="2" fill="none"/>
 </svg>
}
