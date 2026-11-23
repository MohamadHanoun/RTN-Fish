'use strict';
const assert=require('node:assert/strict');
const {questions,matchDetailed}=require('../data/questions');
const {matchDetailed:matchLegacy}=require('../data/matcher');

const scoped=prompt=>{
  const question=questions.find(q=>q.prompt===prompt);
  assert(question,`missing question: ${prompt}`);
  return question;
};
const round=scoped('اذكر شيئًا دائري الشكل');
const flying=scoped('اذكر شيئًا يطير');
const clash=scoped('اذكر بطاقة من كلاش رويال');
const arabCities=scoped('اذكر مدينة عربية');

for(const input of ['كرة','Ball','ball','BALL']){
  const matched=matchDetailed(round,input);
  assert.equal(matched?.answer.display,'كرة',`${input} must mean ball, not balloon`);
  assert(['exact','synonym'].includes(matched.kind),'ball must be a verified exact alias');
}
for(const input of ['بالون','Balloon','BALLOON']){
  assert.equal(matchDetailed(round,input)?.answer.display,'بالون',`${input} must remain balloon`);
}
assert.equal(matchDetailed(round,'Elephant'),null,'wrong category stays rejected');
assert.equal(matchDetailed(flying,'Ball'),null,'round ball does not fly as a balloon');
assert.equal(matchDetailed(clash,'Ball'),null,'a Clash Royale Balloon card is not Ball');
assert.equal(matchDetailed(clash,'Balloon')?.answer.display,'بالون','full card name remains accepted');
assert.equal(matchDetailed(arabCities,'جبيل')?.answer.display,'جبيل','Byblos is not Saudi Jubail');
assert.equal(matchDetailed(arabCities,'الجبيل')?.answer.display,'الجبيل','Jubail must retain its own identity');
assert.equal(matchDetailed(round,'Baloon')?.answer.display,'بالون','one-character English typo on longer words is supported');
assert.equal(matchDetailed(scoped('اذكر فاكهة'),'تفاخ')?.answer.display,'تفاح','one-character Arabic typo remains supported');
assert.equal(matchDetailed(scoped('اذكر لعبة شوتر أونلاين'),'فالورا')?.answer.display,'فالورانت','unambiguous long Arabic name completion remains supported');

const card={answers:[{display:'Card',aliases:['Card']}]};
const crown={answers:[{display:'Crown',aliases:['Crown']}]};
const elephant={answers:[{display:'Elephant',aliases:['Elephant']}]};
assert.equal(matchLegacy(card,'Car',{safe:true}),null,'Car is not Card');
assert.equal(matchLegacy(crown,'Crow',{safe:true}),null,'Crow is not Crown');
assert.equal(matchLegacy(elephant,'Ele',{safe:true}),null,'short word fragments cannot become a different concept');

let sharedAliasCanonical=0;
for(const question of questions){
  for(const answer of question.answers){
    const matched=matchDetailed(question,answer.display);
    assert(matched?.answer,`canonical answer rejected: ${question.prompt} / ${answer.display}`);
    if(matched.answer!==answer) {
      assert(matched.answer.aliases.some(alias=>require('../data/matcher').norm(alias)===require('../data/matcher').norm(answer.display)),
        `canonical answer reassigned without an explicit shared alias: ${question.prompt} / ${answer.display}`);
      sharedAliasCanonical++;
    }
  }
}
const t=process.hrtime.bigint();
for(let i=0;i<1000;i++){
  assert.equal(matchDetailed(round,'Ball')?.answer.display,'كرة');
  assert.equal(matchDetailed(round,'Elephant'),null);
}
const elapsedMs=Number(process.hrtime.bigint()-t)/1e6;
assert(elapsedMs<250,`safe lookup regression: ${elapsedMs.toFixed(2)}ms for 2000 matches`);
console.log(`PASS: 382-category canonical acceptance, bilingual ball/balloon separation, ${sharedAliasCanonical} pre-existing shared-alias entries, 2000 lookups in ${elapsedMs.toFixed(2)}ms`);
