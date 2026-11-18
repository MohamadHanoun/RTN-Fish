'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { questions, matchDetailed, norm } = require('../data/questions');
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
assert(questions.length >= 380, 'expanded question collection should be loaded');
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
assert(app.includes("new Intl.NumberFormat('en-US-u-nu-latn')"), 'live scores must use Latin digits');
assert(!/[٠-٩۰-۹]/.test(html), 'static HTML must not show Eastern Arabic digits');
assert(html.includes(`${questions.length} فئة`), 'home page question count must be current');
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

console.log(`PASS: ${questions.length} question categories, ${countries.length} Arab countries, Arabic/English answers, invite UI, Latin digits`);
