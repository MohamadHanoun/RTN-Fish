'use strict';
// Run: npm test (Node.js >= 20; no external dependencies).
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {questions,matchDetailed}=require('../data/questions');
const {requiredAnswers}=require('../data/progression');
const PORT=34597;
const server=spawn(process.execPath,['server.js'],{cwd:require('path').join(__dirname,'..'),env:{...process.env,PORT:String(PORT),RECONNECT_GRACE_MS:'1200'},stdio:['ignore','pipe','pipe']});
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
  const health=await (await fetch(`http://127.0.0.1:${PORT}/health`)).json();
  assert.equal(health.ok,true);
  assert.equal(health.knowledgeV4.version,'4.5.2-reviewed-matcher');
  assert(health.knowledgeV4.cityAnswers>500);
  assert.equal(health.knowledgeV4.wordnetAnswers,460);
  assert.equal(health.knowledgeV4.wordnetExactKeys,920);
  assert.equal(health.knowledgeV4.v43Answers,72);
  assert.equal(health.knowledgeV4.v43ExactKeys,144);
  assert.equal(health.knowledgeV4.phase4Verified,394);
  assert.equal(health.knowledgeV4.phase4Review,1600);
  assert.equal(health.knowledgeV4.phase4Rejected,17);
  assert.equal(health.knowledgeV4.v44VerifiedAliases,111);
  assert.equal(health.knowledgeV4.v44AliasReview,346);
  assert.equal(health.knowledgeV4.v44AliasRejected,6);
  assert.equal(health.knowledgeV4.v44RuntimeExclusions,0);
  assert.equal(health.knowledgeV4.v44LandAnswers,18);
  assert.equal(health.knowledgeV4.v44LandExactKeys,36);
  assert.equal(health.knowledgeV4.v44LandRuntimeExclusions,0);
  assert.equal(health.knowledgeV4.v45Answers,304);
  assert.equal(health.knowledgeV4.v45ExactKeys,608);
  assert.equal(health.knowledgeV4.v45QuestionCount,8);
  assert.equal(health.knowledgeV4.v45RuntimeExclusions,0);
  assert.equal(health.knowledgeV4.exactKeys,3733);
  assert.equal(health.knowledgeV4.phase3Verified,320);
  assert.equal(health.knowledgeV4.phase3Review,5436);
  assert.equal(health.knowledgeV4.phase3Rejected,11);
  const a=new Client(),b=new Client();
  await a.connect();await b.connect();
  let r=await a.send('createRoom',{name:'ليلى',maxPlayers:3,hearts:3,fuseMinSec:6,fuseMaxSec:8,mode:'gaming'});
  assert.equal(r.ok,true);const code=r.code;
  assert.equal(a.room.settings.mode,'gaming');
  assert.equal(a.room.maxPlayers,10,'rooms should fill automatically without a player-count setting');
  r=await b.send('joinRoom',{name:'رامي',code});assert.equal(r.ok,true);
  await sleep(60);
  assert(a.room.players.every(p=>p.avatar),'every player gets an animal avatar');
  assert.equal(new Set(a.room.players.map(p=>p.avatar)).size,a.room.players.length,'animal avatars are unique within a room');
  const initialAvatars=new Map(a.room.players.map(p=>[p.id,p.avatar]));
  r=await b.send('updateSettings',{hearts:8});assert.equal(r.ok,false,'guest cannot edit host settings');
  r=await a.send('updateSettings',{hearts:2,maxPlayers:4,fuseMinSec:6,fuseMaxSec:8,mode:'gaming'});
  assert.equal(r.ok,true);
  await sleep(60);
  assert.equal(b.room.settings.hearts,2,'settings sync to guests');
  assert.equal(b.room.players[0].hearts,2,'changed hearts applied');
  r=await a.send('startGame',{});assert.equal(r.ok,true);
  await sleep(90);
  assert(a.room.fuseEndsAt>Date.now(),'every player receives a visible server countdown');
  assert(a.room.fuseDurationMs>=6000&&a.room.fuseDurationMs<=8000,'timer duration must stay within room settings');
  const firstAllowance=a.room.fuseDurationMs;
  assert(typeof a.room.theme==='string','questions should include their diversity theme');
  assert(a.room.players.every(p=>p.avatar===initialAvatars.get(p.id)),'avatars stay unchanged on game start');
  const first=a.room.currentPlayerId===a.id?a:b;
  const second=first===a?b:a;
  const q=questions.find(q=>q.prompt===a.room.question);
  assert.equal(q.category,'gaming','gaming only category');
  const legendary=q.answers.find(x=>x.rarity==='legendary'&&matchDetailed(q,x.display)?.answer===x);
  assert(legendary,'legendary answer exists');
  const questionTheme=a.room.theme;
  r=await first.send('submitAnswer',{answer:'this is not a real answer xyzxyz'});
  assert.equal(r.ok,false,'wrong answers must be explicitly rejected');
  assert.equal(first.room.currentPlayerId,first.id,'wrong words must not skip the player');
  await sleep(260);
  r=await first.send('previewAnswer',{answer:legendary.display});
  assert.equal(r.suggestion.rarity,'legendary');
  // A valid answer near the end of a turn must not leave the next player
  // with just the remaining seconds from the outgoing player's timer.
  await sleep(Math.max(0,first.room.fuseEndsAt-Date.now()-3000));
  assert(first.room.fuseEndsAt-Date.now()<4000,'the first player should have used most of their time');
  r=await first.send('submitAnswer',{answer:legendary.display});
  assert.equal(r.ok,true);assert.equal(r.rarity,'legendary');assert.equal(r.heartsGained,1);
  assert.equal(r.gainedTime,7);
  await sleep(100);
  assert.equal(first.room.players.find(p=>p.id===first.id).lastAnswer,legendary.display,'the submitted word is shown beside the player');
  assert.equal(first.room.players.find(p=>p.id===first.id).hearts,3);
  assert.equal(first.room.players.find(p=>p.id===first.id).timeBonus,7);
  assert.equal(first.room.currentPlayerId,second.id);
  assert(second.room.fuseDurationMs>=6000&&second.room.fuseDurationMs<=8000,'a correct answer must give the next player a fresh full timer');
  const secondAllowance=second.room.fuseDurationMs;
  assert(second.room.fuseEndsAt-Date.now()>5600,'the next player gets a full turn, not the previous player\'s remainder');
  const common=q.answers.find(x=>x.rarity==='common'&&matchDetailed(q,x.display)?.answer===x);
  assert(common);
  await sleep(Math.max(0,second.room.fuseEndsAt-Date.now()-3000));
  r=await second.send('submitAnswer',{answer:common.display});
  assert.equal(r.ok,true);
  await sleep(60);
  assert.equal(second.room.currentPlayerId,first.id);
  assert.equal(first.room.fuseDurationMs,firstAllowance,'the original player must regain their own full allowance on return');
  assert(first.room.fuseEndsAt-Date.now()>5600,'returning to a player renews their entire turn');
  assert.equal(first.room.usedAnswers.length,2,'accepted answers share one question');
  assert.equal(first.room.answerGoal,requiredAnswers(q.answers.length,2),'required answers depend on category size');
  // An explosion must cost the holder one heart and PASS the same question.
  const initialQuestion=first.room.question;
  await sleep(Math.max(0,first.room.fuseEndsAt-Date.now())+300);
  assert.equal(first.room.round,1,'one failed player must not change the question');
  assert.equal(first.room.question,initialQuestion,'failed answers keep the current question');
  assert.equal(first.room.currentPlayerId,second.id,'fish passes to the next alive player after explosion');
  assert.equal(second.room.fuseDurationMs,secondAllowance,'an explosion also renews the next player\'s personal time');
  assert.equal(first.room.players.find(p=>p.id===first.id).hearts,2,'failure removes one heart');
  // After every survivor fails without a new correct answer, switch questions.
  await sleep(Math.max(0,second.room.fuseEndsAt-Date.now())+300);
  assert.equal(first.room.round,2,'all players failing must unlock the next question');
  assert.notEqual(first.room.question,initialQuestion);
  assert.notEqual(first.room.theme,questionTheme,'consecutive questions should rotate themes when available');
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
  assert.equal(a.room.players.find(p=>p.id===losingId).explosions,1,'final losing explosion counts in match awards');
  // A refresh/disconnect must NOT steal a seat, hearts, host rights or a turn.
  const c=new Client(),d=new Client(),rejoined=new Client();
  await c.connect();await d.connect();
  r=await c.send('createRoom',{name:'منى',hearts:3,fuseMinSec:6,fuseMaxSec:8,mode:'all'});
  const reconnectCode=r.code,secret=r.sessionToken,originalId=c.id;
  assert(secret?.length>=24,'room creation gives a strong private resume token');
  assert(!JSON.stringify(c.room).includes(secret),'resume secrets must never appear in broadcast states');
  const dJoin=await d.send('joinRoom',{name:'سمير',code:reconnectCode});
  assert(dJoin.sessionToken?.length>=24,'guest can resume too');
  assert.notEqual(dJoin.sessionToken,secret,'every player has their own secret');
  c.close();await sleep(170);
  assert.equal(d.room.players.find(p=>p.id===originalId).connected,false,'a disconnected seat is preserved during grace');
  assert.equal(d.room.hostId,originalId,'temporary disconnection does not immediately lose host');
  await rejoined.connect();
  let restored=await rejoined.send('resumeRoom',{code:reconnectCode,sessionToken:secret});
  assert.equal(restored.ok,true,'refresh can recover the exact player seat');
  await sleep(80);
  assert.equal(d.room.hostId,rejoined.id,'host ownership transfers to the new socket ID');
  assert.equal(d.room.players.length,2,'resuming never creates a duplicate player');
  assert.equal(d.room.players.find(p=>p.id===rejoined.id).hearts,3,'reconnect preserves hearts');
  assert.equal((await d.send('resumeRoom',{code:reconnectCode,sessionToken:secret})).ok,false,'an active seat cannot be hijacked');
  r=await rejoined.send('startGame',{});assert.equal(r.ok,true,'restored host can start the game');
  await sleep(80);
  assert.equal((await d.send('react',{emoji:'👏'})).ok,true,'valid emoji reaction succeeds');
  assert.equal((await d.send('react',{emoji:'🚫'})).ok,false,'arbitrary reactions are rejected');
  assert.equal((await d.send('suggestAnswer',{answer:'mystery made-up phrase xyzxyz'})).ok,true,'missing answer can be reported');
  const currentId=rejoined.room.currentPlayerId;
  const offline=currentId===rejoined.id?rejoined:d;
  const online=offline===rejoined?d:rejoined;
  offline.close();await sleep(190);
  assert.equal(online.room.currentPlayerId,online.id,'disconnecting holder passes the fish immediately');
  assert(online.room.fuseEndsAt-Date.now()>5000,'next holder gets a completely fresh timer');
  assert.equal(online.room.players.find(p=>p.id===currentId).hearts,3,'disconnected holder never loses a heart just for disconnecting');
  const backInGame=new Client();await backInGame.connect();
  const playingSecret=offline===rejoined?secret:dJoin.sessionToken;
  restored=await backInGame.send('resumeRoom',{code:reconnectCode,sessionToken:playingSecret});
  assert.equal(restored.ok,true,'a running match can be resumed after a disconnect');
  await sleep(70);
  assert.equal(online.room.players.find(p=>p.id===backInGame.id).hearts,3,'game recovery keeps all lives');
  assert.equal(online.room.players.filter(p=>p.connected).length,2,'both players are back online');
  backInGame.close();rejoined.close();d.close();
  // If a host never returns, the game must recover instead of trapping guests.
  const f=new Client(),g=new Client();await f.connect();await g.connect();
  r=await f.send('createRoom',{name:'الهوست',hearts:3,fuseMinSec:6,fuseMaxSec:6});
  const lostHostCode=r.code;
  await g.send('joinRoom',{name:'الضيف',code:lostHostCode});
  f.close();await sleep(1600);
  assert.equal(g.room.players.length,1,'unrecovered lobby players are removed after grace');
  assert.equal(g.room.hostId,g.id,'host rights transfer to a remaining connected player');
  assert.equal(g.room.players[0].name,'الضيف');
  g.close();
  console.log('PASS: room settings authorization, continuous matches, proportional question goals, all-failed skips and turn passing');
  a.close();b.close();
}
main().then(()=>server.kill()).catch(e=>{server.kill();console.error('FAIL',e,stderr);process.exitCode=1});
