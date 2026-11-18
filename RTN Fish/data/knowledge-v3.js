'use strict';

// The V3 catalog is bilingual reference data, not a global allow-list.
// Review rows are indexed for future curation but are never enabled here.
const entries = require('./knowledge-v3.json');
const { norm } = require('./matcher');
const scopes = Object.freeze({
  country_or_territory: /(?:دولة|دول|بلد|بلدان)/,
  language: /(?:لغة|لغات)/,
  currency: /(?:عملة|عملات)/,
  month: /(?:شهر|شهور|أشهر)/,
  weekday: /(?:يوم|أيام|اسبوع|أسبوع)/,
  measurement_unit: /(?:وحدة قياس|وحدات قياس)/,
  writing_script: /(?:أبجدية|نظام كتابة)/,
  world_region: /(?:إقليم|منطقة جغرافية|قارة)/
});

function addIndex(index, key, record) {
  if (!key) return;
  if (!index.has(key)) index.set(key, new Map());
  index.get(key).set(record[0], record);
}

const trusted = entries.filter(record =>
  record[4] === 'Verified' && record[5] >= 0.9 && scopes[record[3]]
  && /[\u0600-\u06ff]/.test(record[1]) && /[a-z]/i.test(record[2]));
const arabic = new Map(), english = new Map();
for (const record of trusted) {
  addIndex(arabic, norm(record[1]), record);
  addIndex(english, norm(record[2]), record);
}

function enhanceQuestions(questions) {
  let attached = 0;
  for (const question of questions) {
    const aliasOwners = new Map();
    for (let i = 0; i < question.answers.length; i++) {
      for (const alias of question.answers[i].aliases) {
        const key = norm(alias);
        if (!aliasOwners.has(key)) aliasOwners.set(key, new Set());
        aliasOwners.get(key).add(i);
      }
    }
    const proposals = [];
    for (let i = 0; i < question.answers.length; i++) {
      const answer = question.answers[i];
      const matches = new Map();
      for (const alias of answer.aliases) {
        for (const rec of arabic.get(norm(alias))?.values() || []) matches.set(rec[0], rec);
        for (const rec of english.get(norm(alias))?.values() || []) matches.set(rec[0], rec);
      }
      for (const rec of matches.values()) {
        if (!scopes[rec[3]].test(question.prompt)) continue;
        // Arabic without diacritics cannot distinguish the country Oman from Amman.
        if (norm(rec[1]) === 'عمان' && !answer.aliases.some(a => norm(a) === norm(rec[2]))) continue;
        for (const candidate of [rec[1], rec[2]]) {
          const key = norm(candidate);
          if (key.length < 3) continue;
          const claimed = aliasOwners.get(key);
          if (claimed && (claimed.size !== 1 || !claimed.has(i))) continue;
          proposals.push({ index: i, key, candidate });
        }
      }
    }
    const proposedOwners = new Map();
    for (const p of proposals) {
      if (!proposedOwners.has(p.key)) proposedOwners.set(p.key, new Set());
      proposedOwners.get(p.key).add(p.index);
    }
    for (const p of proposals) {
      if (proposedOwners.get(p.key).size !== 1) continue;
      const answer = question.answers[p.index];
      if (answer.aliases.some(value => norm(value) === p.key)) continue;
      answer.aliases.push(p.candidate);
      attached++;
    }
  }
  return { catalogConcepts: entries.length, trustedConcepts: trusted.length, newAliasBindings: attached };
}
module.exports = { enhanceQuestions };
