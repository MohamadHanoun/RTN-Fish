'use strict';

const data = require('./knowledge-v4-runtime.json');
const { norm, matchDetailed: matchLegacy } = require('./matcher');
const lookup = new Map();

function createAnswer(row) {
  return Object.freeze({
    display: row[1], aliases: [row[1],row[2]],
    value: 10, rarity: 'common', rarityLabel: 'كومون', timeBonus: 0,
    conceptId: `geo:${row[0]}`
  });
}

function configure(questions) {
  lookup.clear();
  let total = 0, cityAnswers = 0;
  for (const question of questions) {
    const sourceRows = data.questions[String(question.id)] || [];
    if (!sourceRows.length) continue;
    const existing = new Set(question.answers.flatMap(answer => answer.aliases.map(norm)));
    const proposed = new Map(), collisions = new Set();
    for (const row of sourceRows) {
      if (row[3] < data.minPopulation) continue;
      const answer = createAnswer(row);
      const keys = [...new Set(answer.aliases.map(norm))];
      if (keys.some(key => !key || existing.has(key))) continue;
      if (answer.aliases.some(alias => matchLegacy(question,alias))) continue;
      for (const key of keys) {
        if (proposed.has(key)) collisions.add(key);
        else proposed.set(key,answer);
      }
    }
    const verified = new Map();
    for (const answer of new Set(proposed.values())) {
      const keys = [...new Set(answer.aliases.map(norm))];
      if (keys.some(key => collisions.has(key) || proposed.get(key) !== answer)) continue;
      for (const key of keys) verified.set(key,answer);
    }
    if (verified.size) lookup.set(question.id,verified);
    total += verified.size;
    cityAnswers += new Set(verified.values()).size;
  }
  return Object.freeze({ version:data.version, questionCount:lookup.size, exactKeys:total, cityAnswers, sourceCandidates:data.summary.acceptedSourceCandidates });
}

function match(question,input) {
  if (!question || !question.id) return null;
  const answer = lookup.get(question.id)?.get(norm(input));
  return answer ? { answer, kind:'v4-exact' } : null;
}

module.exports = { configure, match, data };
