'use strict';

// The target scales with BOTH the answer pool and table size. Huge open-ended
// categories shouldn't trap friends answering hundreds of words in one topic.
function requiredAnswers(totalAnswers, playerCount = 2) {
  const total = Math.max(0, Math.floor(Number(totalAnswers) || 0));
  const players = Math.max(2, Math.min(10, Math.floor(Number(playerCount) || 2)));
  return Math.min(total, Math.max(4, Math.min(Math.ceil(total * 0.42), Math.max(12, players * 6))));
}

module.exports = { requiredAnswers };
