'use strict';

const assert=require('node:assert/strict');
const {questions,matchDetailed,v4Summary}=require('../data/questions');
const {match,data}=require('../data/knowledge-v45');
const {matchDetailed:matchLegacy,norm}=require('../data/matcher');
const geography=require('../data/knowledge-v4');
const wordnet=require('../data/knowledge-v4-wordnet');
const v43=require('../data/knowledge-v43');
const v44Land=require('../data/knowledge-v44-land');
const v44Alias=require('../data/knowledge-v44-alias');

assert.equal(questions.length,382);
assert.equal(v4Summary.version,'4.5.2-reviewed-matcher');
assert.equal(v4Summary.questionCount,46,'Overlapping category additions must not inflate unique contexts');
assert.equal(v4Summary.exactKeys,3733);
assert.equal(v4Summary.cityAnswers,957);
assert.equal(v4Summary.wordnetAnswers,460);
assert.equal(v4Summary.v43Answers,72);
assert.equal(v4Summary.v44LandAnswers,18);
assert.equal(v4Summary.v44VerifiedAliases,111);
assert.equal(v4Summary.v45Answers,304);
assert.equal(v4Summary.v45ExactKeys,608);
assert.equal(v4Summary.v45QuestionCount,8);
assert.equal(v4Summary.v45RuntimeExclusions,0);
assert.equal(v4Summary.phase4Verified,394);
assert.equal(v4Summary.phase4Review,1600);
assert.equal(v4Summary.phase4Rejected,17);
assert.equal(v4Summary.v45ReviewRemaining,1600);
assert.equal(data.version,'4.5.0-wordnet-reviewed');
assert.equal(data.unverifiedExcluded,true);
assert.equal(data.summary.curatedPairs,304);
assert.equal(data.summary.sourceCandidates,2011);
assert.equal(Object.keys(data.questions).length,8);
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
  assert(question&&question.id===Number(id));
  const keys=new Set();
  for(const [conceptId,ar,en,synset,ili,status] of rows) {
    assert.equal(status,'Verified');
    assert(conceptId.startsWith('wn:')&&synset.startsWith('oewn-')&&ili);
    assert(/[\u0600-\u06ff]/.test(ar)&&/[a-z]/i.test(en));
    const arabic=match(question,ar)?.answer,english=match(question,en)?.answer;
    assert(arabic&&english,'Missing bilingual answer: '+en);
    assert.strictEqual(arabic,english,'Bilingual labels must resolve to the identical scoring object');
    assert.equal(arabic.conceptId,conceptId);
    assert.equal(arabic.value,10);
    assert.equal(matchDetailed(question,ar)?.answer,arabic);
    assert.equal(matchDetailed(question,en)?.answer,arabic);
    for(const label of [ar,en]) {
      const key=norm(label);
      assert(!keys.has(key),'V4.5 normalized duplicate in category '+id+': '+label);
      keys.add(key);
      assert.equal(matchLegacy(question,label),null);
      for(const layer of [geography,wordnet,v43,v44Land,v44Alias]) {
        assert.equal(layer.match(question,label),null,'Old layer collision: '+label);
      }
    }
    verified++;
  }
}
assert.equal(verified,304);
for(const [id,count] of Object.entries({9:124,57:12,58:30,66:7,70:13,75:20,84:6,85:92})) {
  assert.equal(data.questions[id]?.length,count,'Unexpected category count: '+id);
}
for(const [id,en,ar] of [
  [9,'gorilla','غوريلا'],
  [57,'Danish blue','جبن أزرق دنماركي'],
  [58,'garlic bread','خبز بالثوم'],
  [66,'grugru nut','جوز غروغرو'],
  [70,'snow pea','بازلاء ثلجية'],
  [75,'peridotite','بيريدوتيت'],
  [84,'Bengal tiger','ببر بنغالي'],
  [85,'snowdrop','قطرة الثلج'],
]) {
  assert.strictEqual(match(questions[id-1],en)?.answer,match(questions[id-1],ar)?.answer);
}
for(const [id,label] of [
  [9,'sea otter'],[57,'pot cheese'],[58,'meatloaf'],
  [65,'stick cinnamon'],[66,'coconut'],[75,'magma'],
  [84,'lioness'],[85,'sunflower']
])assert.equal(match(questions[id-1],label),null,'Unreviewed or inappropriate candidate activated');
assert.equal(match(questions[8],'snowdrop'),null,'Flower must not pass as terrestrial animal');
assert.equal(match(questions[84],'gorilla'),null,'Mammal must not pass as flower');
const t0=process.hrtime.bigint();
for(let i=0;i<1000;i++)match(questions[8],'gorilla');
const ms=Number(process.hrtime.bigint()-t0)/1e6;
assert(ms<200,`V4.5 lookups too slow: ${ms.toFixed(2)}ms`);
console.log(`PASS: V4.5 ${verified} vetted bilingual concepts in 8 question scopes, ${verified*2} exact keys, 1000 lookups in ${ms.toFixed(2)}ms`);
