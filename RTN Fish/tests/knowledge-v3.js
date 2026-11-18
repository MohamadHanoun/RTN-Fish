'use strict';
const assert = require('node:assert/strict');
const { enhanceQuestions } = require('../data/knowledge-v3');
const catalog = require('../data/knowledge-v3.json');
const { matchDetailed } = require('../data/matcher');
assert.equal(catalog.length, 3786, 'V3 bilingual concepts should remain complete');
assert.equal(catalog.filter(row => row[4] === 'Verified').length, 1857);
const fixtures = [
  { prompt: 'اذكر دولة عربية', answers: [
    { display: 'مصر', aliases: ['مصر'] }, { display: 'عمان', aliases: ['عمان'] }
  ] },
  { prompt: 'اذكر مدينة عربية', answers: [{ display: 'عمان', aliases: ['عمان'] }] },
  { prompt: 'اذكر فاكهة', answers: [{ display: 'تفاح', aliases: ['تفاح'] }] },
  { prompt: 'اذكر شهراً من أشهر التقويم الميلادي', answers: [{ display: 'يناير', aliases: ['يناير'] }] }
];
const summary = enhanceQuestions(fixtures);
assert.equal(summary.catalogConcepts, 3786);
assert(summary.trustedConcepts > 1000);
assert(fixtures[0].answers[0].aliases.includes('Egypt'));
assert(!fixtures[0].answers[1].aliases.includes('Oman'));
assert(!fixtures[1].answers[0].aliases.includes('Oman'));
assert(!fixtures[2].answers[0].aliases.includes('Apple'));
assert(fixtures[3].answers[0].aliases.includes('January'));
const once = JSON.stringify(fixtures);
enhanceQuestions(fixtures);
assert.equal(JSON.stringify(fixtures), once, 'enrichment should be idempotent');
assert.equal(matchDetailed({answers:[{display:'Oman',aliases:['Oman']}]},'Amman'),null);
assert.equal(matchDetailed({answers:[{display:'Amman',aliases:['Amman']}]},'Oman'),null);
console.log('PASS: catalog quality, Arabic/English translation, context scopes and ambiguity protection');
