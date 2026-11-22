'use strict';

const assert=require('node:assert/strict');
const {questions,matchDetailed,v4Summary}=require('../data/questions');
const {match,data}=require('../data/knowledge-v44-land');
const {matchDetailed:matchLegacy,norm}=require('../data/matcher');

assert.equal(v4Summary.version,'4.4.0-reviewed');
assert.equal(v4Summary.v44LandAnswers,18);
assert.equal(v4Summary.v44LandExactKeys,36);
assert.equal(v4Summary.v44LandQuestionCount,1);
assert.equal(v4Summary.v44LandRuntimeExclusions,0);
assert.equal(v4Summary.v44LandReviewRemaining,1904);
assert.equal(v4Summary.questionCount,46);
assert.equal(v4Summary.exactKeys,3129);
assert.equal(data.unverifiedExcluded,true);
assert.equal(data.summary.curatedPairs,18);
assert.equal(data.summary.totalPhase4Verified,90);
assert.equal(data.summary.totalPhase4Rejected,17);
assert.equal(Object.keys(data.questions).length,1);
assert.equal(data.sources.length,2);
const land=questions[8];
assert.equal(land.prompt,'اذكر حيوانًا يعيش في البر');
let verified=0;
const keys=new Set();
for(const [conceptId,ar,en,synset,ili,status] of data.questions[9]) {
  assert.equal(status,'Verified');
  assert(conceptId.startsWith('wn:')&&synset.startsWith('oewn-')&&ili);
  assert(/[\u0600-\u06ff]/.test(ar)&&/[a-z]/i.test(en));
  assert.equal(matchLegacy(land,ar),null);
  assert.equal(matchLegacy(land,en),null);
  const arabic=match(land,ar)?.answer,english=match(land,en)?.answer;
  assert(arabic&&english,'Bilingual terrestrial animal missing');
  assert.strictEqual(arabic,english,'Same concept must have same scoring identity');
  assert.equal(arabic.conceptId,conceptId);
  assert.equal(matchDetailed(land,ar).answer.conceptId,conceptId);
  assert.equal(matchDetailed(land,en).answer.conceptId,conceptId);
  for(const label of [ar,en]) {
    const key=norm(label);
    assert(!keys.has(key),'Duplicate normalized alias');
    keys.add(key);
  }
  verified++;
}
assert.equal(verified,18);
for(const [en,ar] of [
  ['aardvark','آردفارك'],['jackal','ابن آوى'],
  ['armadillo','مدرع'],['badger','غرير'],
  ['gray wolf','ذئب رمادي'],['alpaca','ألبكة'],
  ['antelope','ظبي'],['ibex','وعل']
]) {
  assert.equal(match(land,en)?.answer.conceptId,match(land,ar)?.answer.conceptId);
}
for(const bad of ['sea otter','aquatic mammal','magma','bycatch','marmoset','random mammal']) {
  assert.equal(match(land,bad),null,'Inappropriate land animal accepted: '+bad);
}
assert.equal(match(questions[10],'aardvark'),null,'Land animal must not enter marine question');
assert.equal(match(questions[9],'aardvark'),null,'Land animal must not enter bird question');
const t0=process.hrtime.bigint();
for(let i=0;i<1000;i++)match(land,'aardvark');
const ms=Number(process.hrtime.bigint()-t0)/1e6;
assert(ms<200,'1000 terrestrial lookups too slow');
console.log(`PASS: V4.4 ${verified} terrestrial named mammals, bilingual exact matching; 1000 lookups in ${ms.toFixed(2)}ms`);
