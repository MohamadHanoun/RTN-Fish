'use strict';

const data=require('./knowledge-v44-alias-runtime.json');
const {norm,matchDetailed:matchLegacy}=require('./matcher');
const geography=require('./knowledge-v4');
const wordnet=require('./knowledge-v4-wordnet');
const v43=require('./knowledge-v43');
const lookup=new Map();

function configure(questions) {
  lookup.clear();
  let aliases=0,rejectedAtRuntime=0;
  for(const question of questions) {
    const rows=data.questions[String(question.id)]||[];
    if(!rows.length)continue;
    const existing=new Set(question.answers.flatMap(answer=>answer.aliases.map(norm)));
    const proposed=new Map(),collisions=new Set();
    for(const row of rows) {
      const [conceptId,canonicalAr,canonicalEn,language,label,sourceId,status]=row;
      const canonical=wordnet.match(question,canonicalAr)?.answer;
      const sameEnglish=wordnet.match(question,canonicalEn)?.answer;
      const key=norm(label);
      if(status!=='Verified'||!['ar','en'].includes(language)||
         !['awn4','oewn2024'].includes(sourceId)||
         !conceptId?.startsWith('wn:')||!canonical||!sameEnglish||
         canonical!==sameEnglish||canonical.conceptId!==conceptId||
         (language==='ar'&&!/[\u0600-\u06ff]/.test(label))||
         (language==='en'&&!/[a-z]/i.test(label))||key.length<3||
         existing.has(key)||matchLegacy(question,label)||
         geography.match(question,label)||wordnet.match(question,label)||
         v43.match(question,label)) {
        rejectedAtRuntime++;
        continue;
      }
      if(proposed.has(key))collisions.add(key);
      else proposed.set(key,canonical);
    }
    const verified=new Map();
    for(const [key,answer] of proposed) {
      if(collisions.has(key)) {
        rejectedAtRuntime++;
        continue;
      }
      verified.set(key,answer);
    }
    if(verified.size)lookup.set(question.id,verified);
    aliases+=verified.size;
  }
  return Object.freeze({version:data.version,questionCount:lookup.size,aliases,
    sourceCandidates:data.summary.reviewedAliases,rejectedAtRuntime});
}

function match(question,input) {
  if(!question?.id)return null;
  const answer=lookup.get(question.id)?.get(norm(input));
  return answer?{answer,kind:'v44-wordnet-alias-exact'}:null;
}

module.exports={configure,match,data};
