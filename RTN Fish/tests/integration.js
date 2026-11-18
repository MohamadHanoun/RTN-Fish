'use strict';
// Run: npm test (Node.js >= 20; no external dependencies).
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {questions,matchDetailed}=require('../data/questions');
const {requiredAnswers}=require('../data/progression');
const PORT=34597;
const server=spawn(process.execPath,['server.js'],{cwd:require('path').join(__dirname,'..'),env:{...process.env,PORT:String(PORT)},stdio:['ignore','pipe','pipe']});
let stderr='';server.stderr.on('data',d=>stderr+=d);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
class Client {
  constructor(){this.seq=0;this.callbacks=new Map();this.room=null;this.id=null;this.ws=null;}
  async connect(){
    this.ws=new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    this.ws.addEventListener('message',e=>{
      const m=JSON.parse(e.data);
      if(m.t==='hello')this.id=m.id;
      if(m.t==='event'&&m.event==='state')this.room=m.data;
      if(m.t==='ack'&&this.callbacks.has(m.seq)){
        const callback=this.callbacks.get(m.seq);this.callbacks.delete(m.seq);callback(m.result);
      }
    });
    await new Promise((resolve,reject)=>{this.ws.addEventListener('open',resolve,{once:true});this.ws.addEventListener('error',reject,{once:true});});
  }
  send(event,data={}){
    const seq=++this.seq;
    return new Promise((resolve,reject)=>{
      this.callbacks.set(seq,resolve);
      setTimeout(()=>{if(this.callbacks.has(seq)){
        this.callbacks.delete(seq);reject(new Error('Timed out: '+event));
      }},4000).unref();
      this.ws.send(JSON.stringify({t:'event',event,data,seq}));
    });
  }
  close(){this.ws?.close();}
}
async function main(){
  for(let i=0;i<50;i++){
    try{const r=await fetch(`http://127.0.0.1:${PORT}/health`);if(r.ok)break;}catch(e){}
    if(i===49)throw new Error('server not ready: '+stderr);
    await sleep(70);
  }
  const a=new Client(),b=new Client();
  await a.connect();await b.connect();
  let r=await a.send('createRoom',{name:'ليلى',maxPlayers:3,hearts:3,fuseMinSec:6,fuseMaxSec:6,mode:'gaming'});
  assert.equal(r.ok,true);const code=r.code;
  assert.equal(a.room.settings.mode,'gaming');
  r=await b.send('joinRoom',{name:'رامي',code});assert.equal(r.ok,true);
  r=await b.send('updateSettings',{hearts:8});assert.equal(r.ok,false,'guest cannot edit host settings');
  r=await a.send('updateSettings',{hearts:2,maxPlayers:4,fuseMinSec:6,fuseMaxSec:6,mode:'gaming'});
  assert.equal(r.ok,true);
  await sleep(60);
  assert.equal(b.room.settings.hearts,2,'settings sync to guests');
  assert.equal(b.room.players[0].hearts,2,'changed hearts applied');
  r=await a.send('startGame',{});assert.equal(r.ok,true);
  await sleep(90);
  const first=a.room.currentPlayerId===a.id?a:b;
  const second=first===a?b:a;
  const q=questions.find(q=>q.prompt===a.room.question);
  assert.equal(q.category,'gaming','gaming only category');
  const legendary=q.answers.find(x=>x.rarity==='legendary'&&matchDetailed(q,x.display)?.answer===x);
  assert(legendary,'legendary answer exists');
  r=await first.send('previewAnswer',{answer:legendary.display});
  assert.equal(r.suggestion.rarity,'legendary');
  r=await first.send('submitAnswer',{answer:legendary.display});
  assert.equal(r.ok,true);assert.equal(r.rarity,'legendary');assert.equal(r.heartsGained,1);
  assert.equal(r.gainedTime,7);
  await sleep(100);
  assert.equal(first.room.players.find(p=>p.id===first.id).hearts,3);
  assert.equal(first.room.players.find(p=>p.id===first.id).timeBonus,7);
  assert.equal(first.room.currentPlayerId,second.id);
  const common=q.answers.find(x=>x.rarity==='common'&&matchDetailed(q,x.display)?.answer===x);
  assert(common);
  await sleep(250);
  r=await second.send('submitAnswer',{answer:common.display});
  assert.equal(r.ok,true);
  await sleep(60);
  assert.equal(second.room.currentPlayerId,first.id);
  assert.equal(first.room.usedAnswers.length,2,'accepted answers share one question');
  assert.equal(first.room.answerGoal,requiredAnswers(q.answers.length),'required answers depend on category size');
  // An explosion must cost the holder one heart and PASS the same question.
  const initialQuestion=first.room.question;
  await sleep(6300);
  assert.equal(first.room.round,1,'one failed player must not change the question');
  assert.equal(first.room.question,initialQuestion,'failed answers keep the current question');
  assert.equal(first.room.currentPlayerId,second.id,'fish passes to the next alive player after explosion');
  assert.equal(first.room.players.find(p=>p.id===first.id).hearts,2,'failure removes one heart');
  // After every survivor fails without a new correct answer, switch questions.
  await sleep(6300);
  assert.equal(first.room.round,2,'all players failing must unlock the next question');
  assert.notEqual(first.room.question,initialQuestion);
  assert.equal(first.room.usedAnswers.length,0,'new question resets used answers');
  assert.equal(first.room.currentPlayerId,first.id,'pass continues around the table');
  assert.equal(first.room.players.find(p=>p.id===second.id).hearts,1);
  assert.equal(first.room.players.find(p=>p.id===first.id).timeBonus,0,'time bonus applies to a new question');
  // The required fraction of distinct answers advances to a new question.
  const questionTwo=questions.find(x=>x.prompt===first.room.question);
  const goal=requiredAnswers(questionTwo.answers.length);
  assert.equal(first.room.answerGoal,goal);
  const accepted=questionTwo.answers.filter(x=>matchDetailed(questionTwo,x.display)?.answer===x).slice(0,goal);
  assert.equal(accepted.length,goal);
  for(let i=0;i<goal;i++) {
    const holder=first.room.currentPlayerId===a.id?a:b;
    await sleep(260);
    const response=await holder.send('submitAnswer',{answer:accepted[i].display});
    assert.equal(response.ok,true,`answer ${i+1} accepted`);
    await sleep(60);
    if(i<goal-1) {
      assert.equal(first.room.round,2);
      assert.equal(first.room.usedCount,i+1);
    }
  }
  assert.equal(first.room.round,3,'the required answer percentage changes the question');
  assert.equal(first.room.status,'playing','match continues after question changes');
  assert.notEqual(first.room.question,questionTwo.prompt);
  assert.equal(first.room.usedAnswers.length,0);
  const shooter=questions.find(q=>q.prompt==='اذكر لعبة شوتر أونلاين');
  assert.equal(matchDetailed(shooter,'فالورنت').answer.display,'فالورانت');
  assert.equal(matchDetailed(shooter,'فالورا').answer.display,'فالورانت');
  const fruit=questions.find(q=>q.prompt==='اذكر فاكهة');
  assert.equal(matchDetailed(fruit,'تفاخ').answer.display,'تفاح');
  // With one heart each, the first explosion immediately ends the match
  // and declares only the last surviving player as winner.
  r=await a.send('createRoom',{name:'ليلى',maxPlayers:2,hearts:1,fuseMinSec:6,fuseMaxSec:6,mode:'all'});
  assert.equal(r.ok,true);
  r=await b.send('joinRoom',{name:'رامي',code:r.code});assert.equal(r.ok,true);
  r=await a.send('startGame',{});assert.equal(r.ok,true);
  await sleep(90);
  const losingId=a.room.currentPlayerId;
  const winnerId=losingId===a.id?b.id:a.id;
  await sleep(6300);
  assert.equal(a.room.status,'ended','the match ends only with one surviving player');
  assert.equal(a.room.winnerId,winnerId,'last player with hearts wins');
  assert.equal(a.room.players.find(p=>p.id===losingId).hearts,0,'player with no hearts is eliminated');
  console.log('PASS: room settings authorization, continuous matches, proportional question goals, all-failed skips and turn passing');
  a.close();b.close();
}
main().then(()=>server.kill()).catch(e=>{server.kill();console.error('FAIL',e,stderr);process.exitCode=1});
