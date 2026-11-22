'use strict';

const assert = require('node:assert/strict');
const { questions, v4Summary, matchDetailed } = require('../data/questions');
const { match: v4Match, data } = require('../data/knowledge-v4');
const { matchDetailed: legacyMatch, norm } = require('../data/matcher');

assert.equal(questions.length,382);
assert.equal(v4Summary.version,'4.5.0-reviewed');
assert.equal(data.version,'4.0.0-geo-verified');
assert(v4Summary.cityAnswers > 500, 'expected conservative city additions');
assert(v4Summary.cityAnswers <= data.summary.acceptedSourceCandidates);
assert(v4Summary.exactKeys >= v4Summary.cityAnswers);
assert(v4Summary.questionCount > 20);

let checked = 0;
for (const [id,rows] of Object.entries(data.questions)) {
  const question = questions[Number(id)-1];
  assert(question && question.id === Number(id));
  const expectedCountry = data.countryQuestions[question.prompt];
  for (const row of rows) {
    assert(row[3] >= 100000);
    assert(/[؀-ۿ]/.test(row[1]));
    assert(/[a-z]/i.test(row[2]));
    assert(expectedCountry ? row[4] === expectedCountry : data.arabCountries.includes(row[4]));
    const result = v4Match(question,row[1]);
    if (!result) continue;
    assert.equal(result.kind,'v4-exact');
    assert.equal(result.answer.conceptId,'geo:'+row[0]);
    assert.equal(result.answer.rarity,'common');
    assert.equal(result.answer.value,10);
    assert.equal(v4Match(question,row[2])?.answer.conceptId,result.answer.conceptId);
    assert.equal(legacyMatch(question,row[1]),null);
    assert.equal(legacyMatch(question,row[2]),null);
    assert.equal(matchDetailed(question,row[1])?.answer.conceptId,result.answer.conceptId);
    checked++;
  }
}
assert.equal(checked,v4Summary.cityAnswers);
const sa = questions.find(q=>q.prompt==='اذكر مدينة في السعودية');
const us = questions.find(q=>q.prompt==='اذكر مدينة في الولايات المتحدة');
assert.equal(v4Match(sa,'Tokyo'),null);
assert.equal(v4Match(us,'الرياض'),null);
assert.equal(v4Match(sa,'apple'),null);
assert.equal(v4Match(sa,'Amman'),null);
assert.equal(v4Match(sa,'Oman'),null);
assert.equal(v4Match(sa,''),null);
assert.equal(v4Match(sa,'الخر'),null);
const q = questions.find(q=>q.prompt==='اذكر دولة عربية');
assert.equal(matchDetailed(q,'مصر')?.answer.display,'مصر');
assert.equal(matchDetailed(q,'Egypt')?.answer.display,'مصر');
assert.equal(matchDetailed(q,'Amman')?.answer?.display ?? null,null);
assert.equal(norm('الأردن'), 'الاردن');

const t0=process.hrtime.bigint();
for (let i=0;i<1000;i++) v4Match(us,'شبرا الخيمة');
const ms=Number(process.hrtime.bigint()-t0)/1e6;
assert(ms<200,`V4 1000 exact checks too slow: ${ms.toFixed(2)}ms`);
console.log(`PASS: V4 ${v4Summary.cityAnswers} scoped bilingual cities, ${v4Summary.exactKeys-v4Summary.wordnetExactKeys-v4Summary.v43ExactKeys-v4Summary.v44LandExactKeys-v4Summary.v44VerifiedAliases-v4Summary.v45ExactKeys} city keys, ${v4Summary.questionCount-v4Summary.wordnetQuestionCount-v4Summary.v43QuestionCount-v4Summary.v44LandQuestionCount} geography questions; 1000 lookups in ${ms.toFixed(2)}ms`);
