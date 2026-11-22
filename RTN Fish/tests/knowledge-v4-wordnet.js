'use strict';

const assert=require('node:assert/strict');
const {questions,matchDetailed,v4Summary}=require('../data/questions');
const {match,data}=require('../data/knowledge-v4-wordnet');
const {matchDetailed:matchLegacy,norm}=require('../data/matcher');

assert.equal(questions.length,382);
assert.equal(v4Summary.version,'4.4.0-reviewed');
assert.equal(v4Summary.wordnetQuestionCount,9);
assert.equal(v4Summary.wordnetAnswers,460);
assert.equal(v4Summary.wordnetExactKeys,920);
assert.equal(v4Summary.wordnetRuntimeExclusions,0);
assert.equal(v4Summary.cityAnswers,959);
assert.equal(v4Summary.exactKeys,3129);
assert.equal(v4Summary.phase3Verified,320);
assert.equal(v4Summary.phase3Review,5436);
assert.equal(v4Summary.phase3Rejected,11);
assert.equal(data.summary.curatedPairs,460);
assert.equal(data.unverifiedExcluded,true);
assert.equal(Object.keys(data.questions).length,9);
assert.equal(data.sources.length,2);
for(const source of data.sources) {
  assert(['oewn2024','awn4'].includes(source.source_id));
  assert.equal(source.sha256.length,64);
  assert(source.license.includes('CC BY 4.0'));
  assert(source.url.startsWith('https://github.com/'));
  assert(Number.isFinite(Date.parse(source.imported_utc)));
}

let verified=0;
for(const [id,rows] of Object.entries(data.questions)) {
  const question=questions[Number(id)-1];
  assert(question && question.id===Number(id));
  const aliasOwners=new Map();
  for(const row of rows) {
    const [conceptId,ar,en,synset,ili,status]=row;
    assert.equal(status,'Verified');
    assert(conceptId.startsWith('wn:') && synset.startsWith('oewn-') && ili);
    assert(/[؀-ۿ]/.test(ar) && /[a-z]/i.test(en));
    assert.equal(matchLegacy(question,ar),null,'no fuzzy legacy collision for '+ar);
    assert.equal(matchLegacy(question,en),null,'no fuzzy legacy collision for '+en);
    const arMatch=match(question,ar),enMatch=match(question,en);
    assert(arMatch && enMatch,'both language labels must work');
    assert.equal(arMatch.kind,'v4-wordnet-exact');
    assert.equal(arMatch.answer.conceptId,conceptId);
    assert.equal(enMatch.answer.conceptId,conceptId);
    assert.equal(arMatch.answer.display,enMatch.answer.display);
    assert.equal(matchDetailed(question,ar).answer.conceptId,conceptId);
    assert.equal(matchDetailed(question,en).answer.conceptId,conceptId);
    assert.equal(arMatch.answer.rarity,'common');
    assert.equal(arMatch.answer.value,10);
    assert.equal(arMatch.answer.timeBonus,0);
    for(const alias of [ar,en]) {
      const normalized=norm(alias);
      assert(!aliasOwners.has(normalized),'two concepts claim '+normalized+' within question');
      aliasOwners.set(normalized,conceptId);
    }
    verified++;
  }
}
assert.equal(verified,460);
const bird=questions.find(q=>q.prompt==='اذكر طائرًا');
const insect=questions.find(q=>q.prompt==='اذكر حشرة');
const instrument=questions.find(q=>q.prompt==='اذكر آلة موسيقية');
const city=questions.find(q=>q.prompt==='اذكر مدينة في السعودية');
assert.equal(match(bird,'albatross')?.answer.display,'قطرس');
assert.equal(match(insect,'honeybee')?.answer.display,'نحل العسل');
assert.equal(match(instrument,'bagpipe')?.answer.display,'مزمار القربة');
assert.equal(match(bird,'bagpipe'),null);
assert.equal(match(instrument,'albatross'),null);
assert.equal(match(insect,'kingfisher'),null);
assert.equal(match(city,'albatross'),null);
assert.equal(match(bird,'albatro'),null);
assert.equal(match(insect,'pollinator'),null);
assert.equal(match(bird,'cassowary'),null);
assert.equal(match(bird,'mallard'),null);
assert.equal(match(bird,'random made up bird'),null);
assert.equal(match(instrument,''),null);
const answer=match(bird,'albatross').answer;
const used=new Set([norm(answer.display)]);
assert(used.has(norm(match(bird,'قطرس').answer.display)),'Arabic and English share one use slot');
const fruit=questions.find(q=>q.prompt==='اذكر فاكهة');
const vegetables=questions.find(q=>q.prompt==='اذكر نوعًا من الخضار');
const plants=questions.find(q=>q.prompt==='اذكر نباتًا أو شجرة');
const minerals=questions.find(q=>q.prompt==='اذكر معدنًا');
const dinosaur=questions.find(q=>q.prompt==='اذكر نوع ديناصور');
const fish=questions.find(q=>q.prompt==='اذكر نوعًا من الأسماك');
for(const [q,en,ar] of [
  [fruit,'loquat','اسكدنيا'],[fruit,'satsuma','ساتسوما'],
  [vegetables,'kohlrabi','كولرابي'],[vegetables,'snow pea','بازلاء ثلجية'],
  [plants,'baobab','تبلدي'],[plants,'fern','سرخس'],
  [minerals,'quartz','مرو'],[minerals,'magnetite','ماغنيتيت'],
  [dinosaur,'deinonychus','داينونيكوس'],[dinosaur,'utahraptor','يوتارابتور'],
  [fish,'whale shark','قرش حوت'],[fish,'Atlantic cod','قد أطلسي']
]) {
  const english=matchDetailed(q,en),arabic=matchDetailed(q,ar);
  assert(english && arabic,`new bilingual pair not matched: ${en} / ${ar}`);
  assert.equal(english.answer.conceptId,arabic.answer.conceptId);
  assert.equal(english.answer.value,10);
}
for(const [q,wrong] of [
  [fruit,'quartz'],[fruit,'cherry tomato'],
  [vegetables,'Chinese celery'],[vegetables,'julienne'],[vegetables,'rabbit food'],
  [plants,'magnetite'],[minerals,'earth color'],[minerals,'rhinestone'],
  [dinosaur,'whale shark'],[fish,'bottom-feeder'],[fish,'two-wing flying fish'],
  [fish,'deinonychus'],[fruit,'a made-up fruit']
]) assert.equal(matchDetailed(q,wrong),null,`Invalid answer accepted: ${q.prompt} / ${wrong}`);
assert.equal(matchDetailed(fish,'قرش حُوت')?.answer.conceptId,match(fish,'قرش حوت')?.answer.conceptId);
for(const [id,count] of Object.entries({7:55,8:56,35:30,74:74,82:15,83:90})) {
  assert.equal(data.questions[id].length,count,`Unexpected approvals for question ${id}`);
}
const t0=process.hrtime.bigint();
for(let i=0;i<1000;i++)match(instrument,'bagpipe');
const ms=Number(process.hrtime.bigint()-t0)/1e6;
assert(ms<200,`WordNet V4 1000 exact lookups too slow: ${ms.toFixed(2)}ms`);
console.log(`PASS: V4.2 ${verified} editorially scoped bilingual entries in 9 categories, 920 exact keys; 1000 lookups in ${ms.toFixed(2)}ms`);
