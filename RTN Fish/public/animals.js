// Original vector animal portraits for RTN Fish. No external images or runtime requests.
(function(root, factory) {
  const art = factory();
  if(typeof module === 'object' && module.exports) module.exports = art;
  else root.SamakaAnimals = art;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const animals = {
    dog:     { label:'كلب',    fur:'#bb855c', light:'#f5d5aa', dark:'#674236', inner:'#dc9e89', glow:'#ffce84' },
    wolf:    { label:'ذئب',    fur:'#8998ac', light:'#e6ebf4', dark:'#344b69', inner:'#c6a4bd', glow:'#a4c9f6' },
    fox:     { label:'ثعلب',   fur:'#f48b40', light:'#fff0d7', dark:'#925038', inner:'#f1ab99', glow:'#ffb66d' },
    cat:     { label:'قطة',    fur:'#a78acb', light:'#f6e5fa', dark:'#5b467f', inner:'#e5a7c9', glow:'#d7aff9' },
    bear:    { label:'دب',     fur:'#ae765d', light:'#eec49c', dark:'#684539', inner:'#d99c90', glow:'#dca380' },
    rabbit:  { label:'أرنب',   fur:'#f1e9ed', light:'#ffffff', dark:'#b77f9b', inner:'#ffb8cc', glow:'#ffd0e5' },
    lion:    { label:'أسد',    fur:'#ffd16e', light:'#fff0bd', dark:'#885332', inner:'#efaa5b', glow:'#ffcb57' },
    panda:   { label:'باندا',  fur:'#f3f3ef', light:'#ffffff', dark:'#343746', inner:'#b0b7c7', glow:'#c1e3ef' },
    tiger:   { label:'نمر',    fur:'#f8a143', light:'#ffe5aa', dark:'#693e2f', inner:'#e4a188', glow:'#ffc271' },
    owl:     { label:'بومة',   fur:'#b49a74', light:'#f6e8c4', dark:'#685273', inner:'#dac39c', glow:'#d3c6fa' },
    koala:   { label:'كوالا',  fur:'#99a6b3', light:'#e6f1f4', dark:'#4b6176', inner:'#d7a7c0', glow:'#b3d8e6' },
    raccoon: { label:'راكون',  fur:'#acaaad', light:'#f2e8d8', dark:'#4d5265', inner:'#c4a4ac', glow:'#d2cddd' }
  };
  let nextId = 0;

  function svg(name) {
    const type = animals[name] ? name : 'fox';
    const a = animals[type], id = `animal-${++nextId}`;
    const pointed = ['wolf','fox','cat','tiger','raccoon'].includes(type);
    const round = ['bear','panda','koala','lion'].includes(type);
    let ears = '';
    if(type === 'dog') ears = `
      <path d="M30 40 Q10 18 10 50 Q8 70 24 74 Q34 69 38 49Z" fill="${a.dark}" stroke="#322e3d" stroke-width="2.2"/>
      <path d="M90 40 Q110 18 110 50 Q112 70 96 74 Q86 69 82 49Z" fill="${a.dark}" stroke="#322e3d" stroke-width="2.2"/>
      <path d="M25 45 Q18 39 20 58" stroke="${a.inner}" stroke-width="7" stroke-linecap="round" fill="none"/>
      <path d="M95 45 Q102 39 100 58" stroke="${a.inner}" stroke-width="7" stroke-linecap="round" fill="none"/>`;
    if(pointed) ears = `
      <path d="M30 47 L${type==='fox'?10:18} 7 Q14 3 43 30 L77 30 Q106 3 ${type==='fox'?110:102} 7 L90 47Z" fill="${a.fur}" stroke="${a.dark}" stroke-width="3.2" stroke-linejoin="round"/>
      <path d="M26 33 L21 17 L43 39Z M94 33 L99 17 L77 39Z" fill="${a.inner}" opacity=".9"/>`;
    if(round) ears = `
      <circle cx="28" cy="39" r="17" fill="${type==='panda'?a.dark:a.fur}" stroke="${a.dark}" stroke-width="2.4"/>
      <circle cx="92" cy="39" r="17" fill="${type==='panda'?a.dark:a.fur}" stroke="${a.dark}" stroke-width="2.4"/>
      <circle cx="28" cy="39" r="10" fill="${a.inner}" opacity=".92"/>
      <circle cx="92" cy="39" r="10" fill="${a.inner}" opacity=".92"/>`;
    if(type==='koala') ears = `
      <circle cx="24" cy="48" r="23" fill="#b9c4ce" stroke="${a.dark}" stroke-width="2.4"/>
      <circle cx="96" cy="48" r="23" fill="#b9c4ce" stroke="${a.dark}" stroke-width="2.4"/>
      <circle cx="24" cy="48" r="15" fill="${a.inner}"/>
      <circle cx="96" cy="48" r="15" fill="${a.inner}"/>`;
    if(type==='rabbit') ears = `
      <path d="M34 44 Q19 0 30 0 Q46 -3 47 41 M73 42 Q75 0 89 0 Q103 5 86 47" fill="${a.fur}" stroke="${a.dark}" stroke-width="3"/>
      <path d="M36 38 Q27 6 34 7 Q40 6 40 37 M80 38 Q80 7 87 8 Q91 10 81 39" fill="${a.inner}"/>`;
    if(type==='owl') ears = `
      <path d="M29 39 L17 12 L47 29 M91 39 L103 12 L73 29" fill="${a.fur}" stroke="${a.dark}" stroke-width="3" stroke-linejoin="round"/>`;

    const mane = type==='lion' ? `<path d="M60 12 Q78 2 87 19 Q108 17 107 39 Q123 54 109 70 Q113 91 93 94 Q77 111 59 101 Q39 112 26 95 Q5 92 13 70 Q0 52 17 39 Q11 19 35 19 Q40 3 60 12Z" fill="#b86b3b" stroke="#844b2f" stroke-width="3"/><path d="M28 82 Q15 62 32 38 M91 82 Q105 61 89 38" stroke="#e4a04e" stroke-width="7" opacity=".7" fill="none" stroke-linecap="round"/>` : '';
    const patches = {
      dog:`<path d="M31 36 Q44 27 48 45 L49 66 Q25 67 27 48Z" fill="${a.dark}" opacity=".76"/>`,
      wolf:`<path d="M24 65 L38 79 L47 90 L60 103 L73 90 L82 79 L96 65 Q90 91 60 103 Q30 91 24 65Z" fill="${a.light}"/><path d="M31 46 L42 40 M78 40 L89 46" stroke="${a.dark}" stroke-width="3" stroke-linecap="round"/>`,
      fox:`<path d="M21 65 Q33 74 60 97 Q87 74 99 65 Q93 93 60 104 Q27 93 21 65Z" fill="${a.light}"/>`,
      cat:`<path d="M43 31 Q49 26 53 36" stroke="#fff" stroke-width="4" opacity=".65" fill="none"/>`,
      bear:`<path d="M23 72 Q22 91 43 95 M97 72 Q98 91 77 95" stroke="${a.dark}" stroke-width="3" opacity=".24" fill="none"/>`,
      rabbit:`<ellipse cx="60" cy="88" rx="25" ry="18" fill="${a.light}"/>`,
      lion:`<path d="M25 72 Q36 91 60 99 Q84 91 95 72" fill="${a.light}" opacity=".88"/>`,
      panda:`<ellipse cx="43" cy="62" rx="16" ry="20" fill="${a.dark}" transform="rotate(17 43 62)"/><ellipse cx="77" cy="62" rx="16" ry="20" fill="${a.dark}" transform="rotate(-17 77 62)"/>`,
      tiger:`<path d="M50 32 L56 49 L49 45 M70 32 L64 49 L71 45 M27 61 L39 67 L29 70 M93 61 L81 67 L91 70 M37 83 L46 80 M83 83 L74 80" fill="${a.dark}" stroke="${a.dark}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
      owl:`<ellipse cx="60" cy="79" rx="29" ry="24" fill="${a.light}"/><ellipse cx="42" cy="60" rx="23" ry="27" fill="#f5e5c8"/><ellipse cx="78" cy="60" rx="23" ry="27" fill="#f5e5c8"/>`,
      koala:`<path d="M27 68 Q31 95 57 102 Q89 97 93 70" fill="${a.light}" opacity=".55"/>`,
      raccoon:`<path d="M22 58 Q37 42 52 56 L60 62 L68 56 Q83 42 98 58 L89 78 Q75 82 60 74 Q45 82 31 78Z" fill="${a.dark}" opacity=".95"/>`
    };
    const eyes = type==='owl'
      ? `<circle cx="43" cy="62" r="13" fill="#e1a84b"/><circle cx="77" cy="62" r="13" fill="#e1a84b"/><circle cx="43" cy="62" r="7" fill="#252a3b"/><circle cx="77" cy="62" r="7" fill="#252a3b"/><circle cx="46" cy="58" r="3" fill="#fff"/><circle cx="80" cy="58" r="3" fill="#fff"/>`
      : `<ellipse cx="43" cy="64" rx="6" ry="8" fill="#292f40"/><ellipse cx="77" cy="64" rx="6" ry="8" fill="#292f40"/><circle cx="45" cy="61" r="2.4" fill="white"/><circle cx="79" cy="61" r="2.4" fill="white"/>`;
    let snout = `<ellipse cx="60" cy="84" rx="25" ry="17" fill="${a.light}" opacity=".96"/><path d="M52 83 Q60 88 68 83 Q63 94 60 94 Q56 93 52 83Z" fill="${a.dark}"/><path d="M60 91 Q55 100 48 95 M60 91 Q65 100 72 95" fill="none" stroke="${a.dark}" stroke-width="2.4" stroke-linecap="round"/>`;
    if(type==='rabbit') snout = `<ellipse cx="60" cy="84" rx="22" ry="15" fill="#fff"/><path d="M56 82 Q60 80 64 82 L60 88Z" fill="#d98eaa"/><path d="M60 89 L60 99" stroke="${a.dark}" stroke-width="2"/><rect x="54" y="95" width="6" height="9" rx="2" fill="#fff" stroke="#bd9ca7"/><rect x="60" y="95" width="6" height="9" rx="2" fill="#fff" stroke="#bd9ca7"/>`;
    if(type==='cat' || type==='fox' || type==='tiger') snout = `<ellipse cx="51" cy="85" rx="15" ry="12" fill="${a.light}"/><ellipse cx="69" cy="85" rx="15" ry="12" fill="${a.light}"/><path d="M54 82 Q60 79 66 82 L60 88Z" fill="${a.dark}"/><path d="M60 88 Q55 96 50 92 M60 88 Q65 96 70 92" fill="none" stroke="${a.dark}" stroke-width="2.2" stroke-linecap="round"/>`;
    if(type==='panda' || type==='koala') snout = `<ellipse cx="60" cy="87" rx="24" ry="16" fill="${a.light}"/><ellipse cx="60" cy="84" rx="${type==='koala'?13:9}" ry="${type==='koala'?15:7}" fill="${a.dark}"/><path d="M60 93 Q51 100 46 94 M60 93 Q69 100 74 94" fill="none" stroke="${a.dark}" stroke-width="2.5" stroke-linecap="round"/>`;
    if(type==='owl') snout = `<path d="M53 79 L67 79 L60 97Z" fill="#e7a447" stroke="#ac7038" stroke-width="1.8"/>`;
    const whiskers = ['cat','tiger','fox'].includes(type) ? `<path d="M34 85 L14 80 M34 91 L13 94 M86 85 L106 80 M86 91 L107 94" fill="none" stroke="${a.dark}" opacity=".75" stroke-width="1.7" stroke-linecap="round"/>` : '';
    const tongue = type==='dog'?`<path d="M54 99 Q60 112 66 99Z" fill="#e98596"/>`:'';
    return `<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
      <defs><radialGradient id="${id}" cx="38%" cy="28%" r="75%"><stop stop-color="${a.light}"/><stop offset=".45" stop-color="${a.fur}"/><stop offset="1" stop-color="${a.fur}"/></radialGradient></defs>
      <ellipse cx="60" cy="109" rx="34" ry="7" fill="#0a1224" opacity=".18"/>
      ${mane}${ears}
      <ellipse cx="60" cy="65" rx="41" ry="40" fill="url(#${id})" stroke="${a.dark}" stroke-width="2.8"/>
      <ellipse cx="42" cy="79" rx="10" ry="6" fill="#ed99a3" opacity=".24"/><ellipse cx="78" cy="79" rx="10" ry="6" fill="#ed99a3" opacity=".24"/>
      ${patches[type] || ''}${eyes}${snout}${whiskers}${tongue}
      <path d="M30 50 Q37 43 46 48" fill="none" stroke="#fff" stroke-width="2" opacity=".28" stroke-linecap="round"/>
    </svg>`;
  }

  return { animals, svg };
});
