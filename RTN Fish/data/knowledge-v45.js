'use strict';

const data=require('./knowledge-v45-runtime.json');
const {norm,matchDetailed:matchLegacy}=require('./matcher');
const geography=require('./knowledge-v4');
const wordnet=require('./knowledge-v4-wordnet');
const v43=require('./knowledge-v43');
const v44Land=require('./knowledge-v44-land');
const v44Alias=require('./knowledge-v44-alias');
const expectedPrompts=new Map([
  [9,'اذكر حيوانًا يعيش في البر'],
  [57,'اذكر نوع جبن'],
  [58,'اذكر نوع خبز'],
  [65,'اذكر نوع توابل أو بهارات'],
  [66,'اذكر صنفًا من المكسرات'],
  [70,'اذكر نوع حبوب أو بقوليات'],
  [75,'اذكر نوع صخر'],
  [84,'اذكر نوعًا من القطط البرية'],
  [85,'اذكر نوع زهور'],
]);
const lookup=new Map();

function configure(questions) {
  lookup.clear();
  let answers=0,exactKeys=0,rejectedAtRuntime=0;
  for(const question of questions) {
    const rows=data.questions[String(question.id)]||[];
    if(!rows.length)continue;
    if(expectedPrompts.get(question.id)!==question.prompt) {
      rejectedAtRuntime+=rows.length;
      continue;
    }
    const existing=new Set(question.answers.flatMap(answer=>answer.aliases.map(norm)));
    const proposed=new Map(),collisions=new Set();
    for(const row of rows) {
      const [conceptId,ar,en,synset,ili,status]=row;
      const keys=[...new Set([norm(ar),norm(en)])];
      if(status!=='Verified'||!conceptId?.startsWith('wn:')||
         !synset?.startsWith('oewn-')||!ili||
         !/[\u0600-\u06ff]/.test(ar)||!/[a-z]/i.test(en)||
         keys.length!==2||keys.some(key=>key.length<3||existing.has(key))||
         matchLegacy(question,ar)||matchLegacy(question,en)||
         geography.match(question,ar)||geography.match(question,en)||
         wordnet.match(question,ar)||wordnet.match(question,en)||
         v43.match(question,ar)||v43.match(question,en)||
         v44Land.match(question,ar)||v44Land.match(question,en)||
         v44Alias.match(question,ar)||v44Alias.match(question,en)) {
        rejectedAtRuntime++;
        continue;
      }
      const answer=Object.freeze({display:ar,aliases:[ar,en],value:10,
        rarity:'common',rarityLabel:'كومون',timeBonus:0,conceptId});
      for(const key of keys) {
        if(proposed.has(key))collisions.add(key);
        else proposed.set(key,answer);
      }
    }
    const verified=new Map();
    for(const answer of new Set(proposed.values())) {
      if(answer.aliases.some(alias=>collisions.has(norm(alias))||
         proposed.get(norm(alias))!==answer)) {
        rejectedAtRuntime++;
        continue;
      }
      for(const alias of answer.aliases)verified.set(norm(alias),answer);
    }
    if(verified.size)lookup.set(question.id,verified);
    answers+=new Set(verified.values()).size;
    exactKeys+=verified.size;
  }
  return Object.freeze({version:data.version,questionCount:lookup.size,
    answers,exactKeys,rejectedAtRuntime});
}

function match(question,input) {
  if(!question?.id)return null;
  const answer=lookup.get(question.id)?.get(norm(input));
  return answer?{answer,kind:'v45-wordnet-exact'}:null;
}

module.exports={configure,match,data};
