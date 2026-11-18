'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { questions, matchDetailed, norm } = require('../data/questions');
const { requiredAnswers } = require('../data/progression');
const animalArt = require('../public/animals');
const checkTranslation=(prompt,typed,expected)=>{
  const q=questions.find(question=>question.prompt===prompt);
  assert(q,`missing question: ${prompt}`);
  assert.equal(matchDetailed(q,typed)?.answer.display,expected,`translation mismatch: ${typed}`);
};

const countries = [
  'السعودية', 'مصر', 'سوريا', 'العراق', 'الأردن', 'فلسطين', 'لبنان',
  'الإمارات', 'قطر', 'الكويت', 'البحرين', 'عمان', 'اليمن', 'المغرب',
  'الجزائر', 'تونس', 'ليبيا', 'السودان', 'موريتانيا', 'الصومال',
  'جيبوتي', 'جزر القمر'
];

assert.equal(new Set(questions.map(q => q.prompt)).size, questions.length, 'question prompts must be unique');
for (const [total,expected] of [[0,0],[3,3],[5,4],[10,4],[20,8],[30,12],[100,40]]) {
  assert.equal(requiredAnswers(total),expected,`answer goal for ${total} choices`);
}
assert(questions.length >= 380, 'expanded question collection should be loaded');
const answerTotal=questions.reduce((total,q)=>total+q.answers.length,0);
const englishTotal=questions.reduce((total,q)=>total+q.answers.reduce((sum,a)=>sum+a.aliases.filter(word=>/[a-z]/i.test(word)).length,0),0);
assert(answerTotal>=8500,`expected thousands of new answers, only ${answerTotal}`);
assert(englishTotal>=13000,`expected massive bilingual support, only ${englishTotal}`);
assert(new Set(questions.map(q=>q.theme)).size>=12,'questions need diverse themes');
for (const country of countries) {
  const q = questions.find(question => question.prompt === `اذكر معلمًا أو مكانًا مشهورًا في ${country}`);
  assert(q, `missing Arab country: ${country}`);
  assert(q.answers.length >= 7, `not enough choices for ${country}`);
  assert.equal(q.category, 'mixed', `${country} should be in general mode`);
  for (const answer of q.answers) {
    assert.equal(matchDetailed(q, answer.display)?.answer.display, answer.display, `answer mismatch: ${country} / ${answer.display}`);
  }
}
for (const q of questions) {
  assert(q.answers.length >= 5, `too few valid answers: ${q.prompt}`);
  assert.equal(new Set(q.answers.map(a => norm(a.display))).size, q.answers.length, `duplicate answers: ${q.prompt}`);
}

const app = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../public/style.css'), 'utf8');
assert(app.includes("new Intl.NumberFormat('en-US-u-nu-latn')"), 'live scores must use Latin digits');
assert(!/[٠-٩۰-۹]/.test(html), 'static HTML must not show Eastern Arabic digits');
assert(html.includes(`${questions.length} فئة`), 'home page question count must be current');
assert.equal(Object.keys(animalArt.animals).length,12,'game needs twelve animal characters');
for (const name of Object.keys(animalArt.animals)) {
  const art = animalArt.svg(name);
  assert(art.includes('<svg') && art.includes('</svg>') && art.includes('radialGradient'),`missing illustrated animal: ${name}`);
  assert(!/onload=|<script|<image /i.test(art),'animal art should contain only trusted vector shapes');
}
assert(html.includes('id="arenaPlayers"') && html.includes('src="/animals.js"'),'arena artwork must load in the game');
assert(app.includes('renderArena(room)') && app.includes('animalAvatar(p,'),'players need illustrated animal seats');
for(const [prompt,english,arabic] of [
  ['اذكر حيوانًا أليفًا','dog','كلب'],
  ['اذكر حيوانًا أليفًا','cat','قط'],
  ['اذكر فاكهة','apple','تفاح'],
  ['اذكر دولة عربية','Egypt','مصر'],
  ['اذكر مدينة عربية','Cairo','القاهرة'],
  ['اذكر لونًا','red','أحمر'],
  ['اذكر معلمًا أو مكانًا مشهورًا في مصر','pyramids','أهرامات الجيزة']
])checkTranslation(prompt,english,arabic);
assert(html.includes('id="inviteForm"') && html.includes('id="inviteName"'), 'invite needs a name-only entry form');
assert(app.includes('enterInviteRoom(true)'), 'saved-name invite must autojoin');
assert(app.includes("$('hostSettingsPanel').hidden = !isHost"), 'guest controls must stay hidden');
assert(app.includes('room.usedCount ?? room.usedAnswers.length'), 'progress must support more than 30 used answers');
assert(!html.includes('id="maxPlayers"') && !html.includes('id="hostMaxPlayers"'),'player count must be automatic');
assert(html.includes('id="timerValue"') && app.includes('updateCountdown()'),'all players should see the countdown');
assert(html.includes('id="arenaPlayers"') && app.includes('arena-last-word'),'players need their latest words beside their seats');
assert(css.includes('/underwater.svg'),'underwater artwork must be loaded');
assert(css.includes('[hidden]{display:none!important}'),'hidden host-only and turn controls must stay invisible');
for(const [prompt,english,arabic] of [
  ['اذكر فاكهة','dragon fruit','فاكهة التنين'],
  ['اذكر مهنة','paramedic','مسعف'],
  ['اذكر مدينة عربية','Aleppo','حلب'],
  ['اذكر لغة يتحدث بها الناس','Icelandic','الآيسلندية'],
  ['اذكر نوعًا من الأسماك','catfish','سمك السلور'],
  ['اذكر مشروبًا','iced coffee','قهوة باردة'],
  ['اذكر طبقًا من المطبخ العالمي','koshari','كشري'],
  ['اذكر شيئًا يمكن شراؤه من السوبرماركت','green apple','تفاح أخضر'],
  ['اذكر لعبة فيديو','Minecraft','ماينكرافت']
])checkTranslation(prompt,english,arabic);

console.log(`PASS: ${questions.length} categories, ${answerTotal} answers, ${englishTotal} Latin aliases, immersive arena`);
