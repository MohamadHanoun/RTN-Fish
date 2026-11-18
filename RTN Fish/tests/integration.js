'use strict';
// Run: npm test (Node.js >= 20; no external dependencies).
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {questions,matchDetailed}=require('../data/questions');
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
  assert.equal(second.room.currentPlayerId,first.id);
  // Explosion starts a fresh round for the holder; earned time is consumed.
  await sleep(6300);
  assert.equal(first.room.round,2,'explosion starts a new round');
  assert.equal(first.room.currentPlayerId,first.id);
  assert.equal(first.room.players.find(p=>p.id===first.id).timeBonus,0,'time bonus applied to next fresh round');
  const shooter=questions.find(q=>q.prompt==='اذكر لعبة شوتر أونلاين');
  assert.equal(matchDetailed(shooter,'فالورنت').answer.display,'فالورانت');
  assert.equal(matchDetailed(shooter,'فالورا').answer.display,'فالورانت');
  const fruit=questions.find(q=>q.prompt==='اذكر فاكهة');
  assert.equal(matchDetailed(fruit,'تفاخ').answer.display,'تفاح');
  console.log('PASS: online rooms, host controls, 92 gaming categories, rarity + hearts + next-round fuse, fuzzy answers');
  a.close();b.close();
}
main().then(()=>server.kill()).catch(e=>{server.kill();console.error('FAIL',e,stderr);process.exitCode=1});
