'use strict';

// A question with 10 accepted answers needs 4; 20 needs 8; 30 needs 12.
// Small categories still need up to four different answers before advancing.
function requiredAnswers(totalAnswers) {
  const total = Math.max(0, Math.floor(Number(totalAnswers) || 0));
  return Math.min(total, Math.max(4, Math.ceil(total * 0.4)));
}

module.exports = { requiredAnswers };
