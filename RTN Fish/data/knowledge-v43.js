'use strict';

const data = require('./knowledge-v43-runtime.json');
const {norm, matchDetailed:matchLegacy} = require('./matcher');
const geography = require('./knowledge-v4');
const wordnet = require('./knowledge-v4-wordnet');
const lookup = new Map();

function configure(questions) {
  lookup.clear();
  let answers=0, exactKeys=0, rejectedAtRuntime=0;
  for(const question of questions) {
    const rows=data.questions[String(question.id)]||[];
    if(!rows.length)continue;
    const existing=new Set(question.answers.flatMap(answer=>answer.aliases.map(norm)));
    const proposed=new Map(), collisions=new Set();
    for(const row of rows) {
      const [conceptId,ar,en,synset,ili,status]=row;
      if(status!=='Verified'||!conceptId?.startsWith('wn:')||!synset?.startsWith('oewn-')||!ili||
         !/[\u0600-\u06ff]/.test(ar)||!/[a-z]/i.test(en)) {
        rejectedAtRuntime++;
        continue;
      }
      const keys=[...new Set([norm(ar),norm(en)])];
      if(keys.length!==2||keys.some(key=>key.length<3||existing.has(key))||
         matchLegacy(question,ar)||matchLegacy(question,en)||
         geography.match(question,ar)||geography.match(question,en)||
         wordnet.match(question,ar)||wordnet.match(question,en)) {
        rejectedAtRuntime++;
        continue;
      }
      const answer=Object.freeze({
        display:ar,aliases:[ar,en],value:10,rarity:'common',rarityLabel:'كومون',
        timeBonus:0,conceptId
      });
      for(const key of keys) {
        if(proposed.has(key))collisions.add(key);
        else proposed.set(key,answer);
      }
    }
    const verified=new Map();
    for(const answer of new Set(proposed.values())) {
      const keys=answer.aliases.map(norm);
      if(keys.some(key=>collisions.has(key)||proposed.get(key)!==answer)) {
        rejectedAtRuntime++;
        continue;
      }
      for(const key of keys)verified.set(key,answer);
    }
    if(verified.size)lookup.set(question.id,verified);
    answers+=new Set(verified.values()).size;
    exactKeys+=verified.size;
  }
  return Object.freeze({version:data.version,questionCount:lookup.size,answers,exactKeys,
    sourceCandidates:data.summary.curatedPairs,rejectedAtRuntime});
}

function match(question,input) {
  if(!question?.id)return null;
  const answer=lookup.get(question.id)?.get(norm(input));
  return answer?{answer,kind:'v43-wordnet-exact'}:null;
}

module.exports={configure,match,data};
