'use strict';

const assert=require('node:assert/strict');
const {questions,matchDetailed,v4Summary}=require('../data/questions');
const {match,data}=require('../data/knowledge-v43');
const {matchDetailed:matchLegacy,norm}=require('../data/matcher');

assert.equal(questions.length,382);
assert.equal(v4Summary.version,'4.5.2-reviewed-matcher');
assert.equal(v4Summary.cityAnswers,957);
assert.equal(v4Summary.wordnetAnswers,460);
assert.equal(v4Summary.v43Answers,72);
assert.equal(v4Summary.v43ExactKeys,144);
assert.equal(v4Summary.v43QuestionCount,8);
assert.equal(v4Summary.v43RuntimeExclusions,0);
assert.equal(v4Summary.exactKeys,3733);
assert.equal(v4Summary.phase4Verified,394);
assert.equal(v4Summary.phase4Review,1600);
assert.equal(v4Summary.phase4Rejected,17);
assert.equal(v4Summary.phase4AliasReview,463);
assert.equal(data.version,'4.3.0-wordnet-reviewed');
assert.equal(data.unverifiedExcluded,true);
assert.equal(data.summary.curatedPairs,72);
assert.equal(data.summary.sourceCandidates,2011);
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
    assert(conceptId.startsWith('wn:')&&synset.startsWith('oewn-')&&ili);
    assert(/[\u0600-\u06ff]/.test(ar)&&/[a-z]/i.test(en));
    assert.equal(matchLegacy(question,ar),null);
    assert.equal(matchLegacy(question,en),null);
    const matchAr=match(question,ar),matchEn=match(question,en);
    assert(matchAr&&matchEn,'Both language labels must match');
    assert.equal(matchAr.kind,'v43-wordnet-exact');
    assert.equal(matchAr.answer.conceptId,conceptId);
    assert.equal(matchEn.answer.conceptId,conceptId);
    assert.equal(matchAr.answer.display,matchEn.answer.display);
    assert.equal(matchDetailed(question,ar).answer.conceptId,conceptId);
    assert.equal(matchDetailed(question,en).answer.conceptId,conceptId);
    assert.equal(matchAr.answer.value,10);
    assert.equal(matchAr.answer.rarity,'common');
    assert.equal(matchAr.answer.timeBonus,0);
    for(const alias of [ar,en]) {
      const normalized=norm(alias);
      assert(!aliasOwners.has(normalized),'Alias collision: '+normalized);
      aliasOwners.set(normalized,conceptId);
    }
    verified++;
  }
}
assert.equal(verified,72);
for(const [id,count] of Object.entries({57:10,58:14,65:5,66:6,70:7,75:12,84:8,85:10})) {
  assert.equal(data.questions[id].length,count,'Wrong selected count: '+id);
}

const q=id=>questions[id-1];
for(const [id,en,ar] of [
  [57,'Edam','إيدام'],[57,'gorgonzola','غورغونزولا'],
  [58,'chapati','شباتي'],[58,'bagel','بيغل'],
  [65,'star anise','ينسون نجمي'],[65,'allspice','بهار حلو'],
  [66,'pecan','بيكان'],[66,'macadamia nut','مكسرات المكاديميا'],
  [70,'kidney bean','فاصولياء حمراء'],[70,'black bean','فاصولياء سوداء'],
  [75,'pumice','خفاف'],[75,'gneiss','نايس'],
  [84,'ocelot','أصلوت'],[84,'Canada lynx','وشق كندي'],
  [85,'petunia','بيتونيا'],[85,'peony','فاوانيا']
]) {
  assert.equal(matchDetailed(q(id),en)?.answer.conceptId,matchDetailed(q(id),ar)?.answer.conceptId,
    'Bilingual mismatch: '+id+' '+en+' '+ar);
}
for(const [id,wrong] of [
  [57,'petunia'],[58,'Edam'],[65,'gneiss'],[66,'marigold'],
  [70,'gorgonzola'],[75,'magma'],[75,'bycatch'],[84,'Persian cat'],
  [84,'Siamese'],[85,'panther'],[11,'bycatch'],[9,'female mammal'],
  [57,'Edamm'],[84,'ocelo'],[75,'solid-rock-made-up']
]) {
  assert.equal(match(q(id),wrong),null,'Invalid V4.3 answer accepted: '+id+' / '+wrong);
}
assert.equal(matchDetailed(q(75),'magma'),null);
assert.equal(matchDetailed(q(84),'Persian cat'),null);
assert.equal(matchDetailed(q(11),'bycatch'),null);
const usedConcepts=new Set([match(q(57),'Edam').answer.conceptId]);
assert(usedConcepts.has(match(q(57),'إيدام').answer.conceptId),
  'Arabic and English must share one usage/score slot');
const t0=process.hrtime.bigint();
for(let i=0;i<1000;i++)match(q(84),'Canada lynx');
const ms=Number(process.hrtime.bigint()-t0)/1e6;
assert(ms<200,'1000 scoped lookups too slow: '+ms.toFixed(2)+'ms');
console.log(`PASS: V4.3 ${verified} scoped bilingual concepts in 8 questions, 144 exact keys; 1000 lookups in ${ms.toFixed(2)}ms`);
