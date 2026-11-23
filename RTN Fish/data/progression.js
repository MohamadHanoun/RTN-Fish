'use strict';

function requiredAnswers(totalAnswers, playerCount = 2) {
  const total = Math.max(0, Math.floor(Number(totalAnswers) || 0));
  const players = Math.max(2, Math.min(10, Math.floor(Number(playerCount) || 2)));
  return Math.min(total, players + 2, 8);
}

function advanceAfterExplosion(used, goal, explosions, random = Math.random) {
  if (explosions >= 2 || used * 8 >= goal * 5) return true;
  if (used * 8 < goal * 3) return false;
  return random() < 0.5;
}

module.exports = { requiredAnswers, advanceAfterExplosion };
