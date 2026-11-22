'use strict';

const assert=require('node:assert/strict');
const {questions,matchDetailed,v4Summary}=require('../data/questions');
const {data,match}=require('../data/knowledge-v44-alias');
const wordnet=require('../data/knowledge-v4-wordnet');
const {matchDetailed:matchLegacy,norm}=require('../data/matcher');

assert.equal(v4Summary.version,'4.4.0-reviewed');
assert.equal(v4Summary.questionCount,46,'aliases must not count as new question categories');
assert.equal(v4Summary.cityAnswers,959);
assert.equal(v4Summary.wordnetAnswers,460);
assert.equal(v4Summary.v43Answers,72);
assert.equal(v4Summary.v44VerifiedAliases,111);
assert.equal(v4Summary.v44AliasQuestionCount,9);
assert.equal(v4Summary.v44RuntimeExclusions,0);
assert.equal(v4Summary.exactKeys,3129);
assert.equal(v4Summary.v44AliasReview,346);
assert.equal(v4Summary.v44AliasRejected,6);
assert.equal(data.unverifiedExcluded,true);
assert.equal(data.summary.sourceAliases,463);
assert.equal(data.summary.sourceConcepts,460);
assert.equal(data.summary.reviewedAliases,111);
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
  assert(question&&question.id===Number(id));
  const usedKeys=new Set();
  for(const [conceptId,canonicalAr,canonicalEn,lang,label,sourceId,status] of rows) {
    assert.equal(status,'Verified');
    assert(['ar','en'].includes(lang));
    assert(['awn4','oewn2024'].includes(sourceId));
    assert.equal(matchLegacy(question,label),null);
    const original=wordnet.match(question,canonicalAr)?.answer;
    const originalEnglish=wordnet.match(question,canonicalEn)?.answer;
    const alias=match(question,label)?.answer;
    assert(original&&alias&&originalEnglish,'Alias must link to existing WordNet answer');
    assert.strictEqual(original,originalEnglish,'Original bilingual labels must share object identity');
    assert.strictEqual(alias,original,'New alias must return same object, not clone it');
    assert.equal(alias.conceptId,conceptId);
    assert.equal(matchDetailed(question,label).answer.conceptId,conceptId);
    assert.equal(alias.value,10);
    assert.equal(alias.rarity,'common');
    const key=norm(label);
    assert(!usedKeys.has(key),'Duplicate normalized alias within question: '+key);
    usedKeys.add(key);
    verified++;
  }
}
assert.equal(verified,111);
for(const [qid,label,canonicalAr] of [
  [7,'ackee','آكي'],[7,'Yellow Delicious','تفاح ذهبي'],
  [8,'bok choy','بوك تشوي'],[8,'haricots verts','فاصولياء فرنسية'],
  [10,'سمان','سلوى'],[10,'budgerigar','بادجي'],
  [12,'صرصور الليل','جدجد'],[12,'house fly','ذبابة منزلية'],
  [24,'synthesizer','سينثسيزر'],[24,'upright piano','بيانو قائم'],
  [35,'ميرمية','قصعين'],[35,'ورد دمشقي','ورد جوري'],
  [74,'كوارتز','مرو'],[74,"fool's gold",'بايريت'],
  [82,'psittacosaurus','بسيتاكوصور'],
  [83,'king salmon','سلمون ملكي'],[83,'قرش ماكو','ماكو']
]) {
  assert.strictEqual(match(questions[qid-1],label).answer,
    wordnet.match(questions[qid-1],canonicalAr).answer,
    `Synonym identity error: ${qid}/${label}`);
}
for(const [id,label] of [
  [10,'lovebird'],[12,'كلب الماء'],[24,'إكسيليفون'],
  [24,'sweet potato'],[82,'superslasher'],[8,'خيار مخلل'],
  [9,'سمان'],[10,'كوارتز'],[74,'smarter fool gold'],
  [83,'king salm'],[83,'random invented fish']
]) {
  assert.equal(match(questions[id-1],label),null,'Invalid unreviewed alias was accepted');
}
assert.equal(matchDetailed(questions[9],'lovebird'),null);
assert.equal(matchDetailed(questions[23],'إكسيليفون'),null);
const used=new Set([norm(wordnet.match(questions[9],'سلوى').answer.display)]);
assert(used.has(norm(match(questions[9],'سمان').answer.display)),
  'Original Arabic and new alias must share a single score/usage slot');
const t0=process.hrtime.bigint();
for(let i=0;i<1000;i++)match(questions[9],'budgerigar');
const ms=Number(process.hrtime.bigint()-t0)/1e6;
assert(ms<200,'1000 alias lookups too slow: '+ms.toFixed(2));
console.log(`PASS: V4.4 ${verified} same-concept bilingual aliases, 9 scoped questions, no duplicate points; 1000 lookups in ${ms.toFixed(2)}ms`);
